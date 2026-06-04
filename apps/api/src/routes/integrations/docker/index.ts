import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { requireAdmin } from "@hously/api/middleware/auth";
import { logActivity } from "@hously/api/utils/activityLogs";
import { nowUtc } from "@hously/api/utils";
import { normalizeDockerConfig } from "@hously/api/utils/integrations/normalizers";
import { invalidateIntegrationConfigCache } from "@hously/api/services/integrationConfigCache";
import { badRequest, serverError } from "@hously/api/errors";

const DEFAULT_DOCKER_SOCKET_PATH = "/var/run/docker.sock";

const normalizeEndpoint = (value: string): string => {
  const trimmed = value.trim();
  return trimmed || DEFAULT_DOCKER_SOCKET_PATH;
};

const isValidDockerEndpoint = (value: string): boolean => {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeIconNameOverrides = (
  value: Record<string, string> | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(value ?? {})
      .map(([key, iconName]) => [key.trim(), iconName.trim()])
      .filter(([key, iconName]) => key && iconName),
  );

export const dockerIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/docker", async ({ user: _user, set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "docker" },
      });
      const config = normalizeDockerConfig(integration?.config);

      return {
        integration: {
          type: "docker",
          enabled: integration?.enabled || false,
          socket_path: config?.socket_path || DEFAULT_DOCKER_SOCKET_PATH,
          endpoint: config?.endpoint || "",
          compose_project: config?.compose_project || "",
          icon_name_overrides: config?.icon_name_overrides || {},
        },
      };
    } catch (error) {
      console.error("Error fetching Docker integration config:", error);
      return serverError(set, "Failed to fetch Docker integration config");
    }
  })
  .put(
    "/docker",
    async ({ user, body, set }) => {
      const endpoint = normalizeEndpoint(body.socket_path);
      const composeProject = body.compose_project.trim();
      const iconNameOverrides = normalizeIconNameOverrides(
        body.icon_name_overrides,
      );
      const enabled = body.enabled ?? true;

      if (!isValidDockerEndpoint(endpoint)) {
        return badRequest(
          set,
          "socket_path must be an absolute path or http(s) Docker API endpoint",
        );
      }

      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
          where: { type: "docker" },
          update: {
            enabled,
            config: {
              socket_path: endpoint,
              endpoint: /^https?:\/\//i.test(endpoint) ? endpoint : "",
              compose_project: composeProject,
              icon_name_overrides: iconNameOverrides,
            },
            updatedAt: now,
          },
          create: {
            type: "docker",
            enabled,
            config: {
              socket_path: endpoint,
              endpoint: /^https?:\/\//i.test(endpoint) ? endpoint : "",
              compose_project: composeProject,
              icon_name_overrides: iconNameOverrides,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "docker" },
        });
        invalidateIntegrationConfigCache("docker");

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            socket_path: endpoint,
            endpoint: /^https?:\/\//i.test(endpoint) ? endpoint : "",
            compose_project: composeProject,
            icon_name_overrides: iconNameOverrides,
          },
        };
      } catch (error) {
        console.error("Error saving Docker integration config:", error);
        return serverError(set, "Failed to save Docker integration config");
      }
    },
    {
      body: t.Object({
        socket_path: t.String(),
        compose_project: t.String(),
        icon_name_overrides: t.Optional(t.Record(t.String(), t.String())),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
