import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl } from "@hously/api/utils/plugins/utils";
import { normalizeOllamaConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const ollamaPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/ollama", async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "ollama" },
      });
      const config = normalizeOllamaConfig(plugin?.config);

      return {
        plugin: {
          type: "ollama" as const,
          enabled: plugin?.enabled || false,
          base_url: config?.base_url || "",
          model: config?.model || "llama3.2",
        },
      };
    } catch (error) {
      console.error("Error fetching Ollama plugin config:", error);
      return serverError(set, "Failed to fetch Ollama plugin config");
    }
  })
  .put(
    "/ollama",
    async ({ user, body, set }) => {
      const baseUrl = body.base_url.trim().replace(/\/+$/, "");
      const model = (body.model ?? "").trim() || "llama3.2";
      const enabled = body.enabled ?? true;

      if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return badRequest(
          set,
          "Invalid base_url. Must be a valid http(s) URL (e.g. http://127.0.0.1:11434).",
        );
      }

      try {
        const now = nowUtc();
        const configPayload = {
          base_url: baseUrl,
          model,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: "ollama" },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: "ollama",
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "ollama" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            base_url: baseUrl,
            model,
          },
        };
      } catch (error) {
        console.error("Error saving Ollama plugin config:", error);
        return serverError(set, "Failed to save Ollama plugin config");
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        model: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
