import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { normalizeWeatherConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const weatherIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/weather", async ({ user, set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "weather" },
      });
      const config = normalizeWeatherConfig(integration?.config);

      return {
        integration: {
          type: "weather",
          enabled: integration?.enabled || false,
          address: config?.address || "",
          temperature_unit: config?.temperature_unit || "fahrenheit",
        },
      };
    } catch (error) {
      console.error("Error fetching Weather integration config:", error);
      return serverError(set, "Failed to fetch Weather integration config");
    }
  })
  .put(
    "/weather",
    async ({ user, body, set }) => {
      const address = body.address.trim();
      const temperatureUnit =
        body.temperature_unit === "celsius" ? "celsius" : "fahrenheit";
      const enabled = body.enabled ?? true;

      if (!address) {
        return badRequest(set, "address is required");
      }

      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
          where: { type: "weather" },
          update: {
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            updatedAt: now,
          },
          create: {
            type: "weather",
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "weather" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            address,
            temperature_unit: temperatureUnit,
          },
        };
      } catch (error) {
        console.error("Error saving Weather integration config:", error);
        return serverError(set, "Failed to save Weather integration config");
      }
    },
    {
      body: t.Object({
        address: t.String(),
        temperature_unit: t.Union([
          t.Literal("fahrenheit"),
          t.Literal("celsius"),
        ]),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
