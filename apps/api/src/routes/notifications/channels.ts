import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { dispatchToChannel } from "@hously/api/utils/notifications/channelDispatchers";
import type { NotificationChannel } from "@hously/shared";

// Add new provider keys here when implementing them.
const VALID_TYPES = ["ntfy"] as const;

function mapChannel(row: {
  id: number;
  type: string;
  label: string;
  config: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NotificationChannel {
  return {
    id: row.id,
    type: row.type as NotificationChannel["type"],
    label: row.label,
    config: row.config as NotificationChannel["config"],
    enabled: row.enabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const notificationChannelsRoutes = new Elysia({ prefix: "/channels" })
  .use(auth)
  .use(requireUser)

  // GET /api/notifications/channels
  .get("/", async ({ user, set }) => {
    try {
      const channels = await prisma.notificationChannel.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: "asc" },
      });
      return { channels: channels.map(mapChannel) };
    } catch {
      return serverError(set, "Failed to fetch notification channels");
    }
  })

  // POST /api/notifications/channels
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])) {
        return badRequest(
          set,
          `type must be one of: ${VALID_TYPES.join(", ")}`,
        );
      }
      try {
        const channel = await prisma.notificationChannel.create({
          data: {
            userId: user!.id,
            type: body.type,
            label: body.label,
            config: body.config as object,
            enabled: true,
          },
        });
        return { channel: mapChannel(channel) };
      } catch {
        return serverError(set, "Failed to create notification channel");
      }
    },
    {
      body: t.Object({
        type: t.String(),
        label: t.String({ maxLength: 100 }),
        config: t.Any(),
      }),
    },
  )

  // PATCH /api/notifications/channels/:id
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const existing = await prisma.notificationChannel.findFirst({
          where: { id, userId: user!.id },
        });
        if (!existing) return notFound(set, "Channel not found");

        const channel = await prisma.notificationChannel.update({
          where: { id },
          data: {
            ...(body.label !== undefined ? { label: body.label } : {}),
            ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
            ...(body.config !== undefined
              ? { config: body.config as object }
              : {}),
          },
        });
        return { channel: mapChannel(channel) };
      } catch {
        return serverError(set, "Failed to update notification channel");
      }
    },
    {
      body: t.Object({
        label: t.Optional(t.String({ maxLength: 100 })),
        enabled: t.Optional(t.Boolean()),
        config: t.Optional(t.Any()),
      }),
    },
  )

  // DELETE /api/notifications/channels/:id
  .delete("/:id", async ({ user, params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const existing = await prisma.notificationChannel.findFirst({
        where: { id, userId: user!.id },
      });
      if (!existing) return notFound(set, "Channel not found");
      await prisma.notificationChannel.delete({ where: { id } });
      return { success: true };
    } catch {
      return serverError(set, "Failed to delete notification channel");
    }
  })

  // POST /api/notifications/channels/:id/test
  .post("/:id/test", async ({ user, params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const channel = await prisma.notificationChannel.findFirst({
        where: { id, userId: user!.id },
      });
      if (!channel) return notFound(set, "Channel not found");

      await dispatchToChannel(mapChannel(channel), {
        title: "Hously test notification",
        body: "If you see this, your notification channel is working.",
      });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dispatch failed";
      return badRequest(set, msg);
    }
  });
