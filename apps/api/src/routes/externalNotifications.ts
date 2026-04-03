import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { prisma } from "../db";
import { generateServiceToken } from "../services/externalNotificationService";
import { requireAdmin } from "../middleware/auth";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "../utils/errors";

// Helper to get base URL
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const externalNotificationsRoutes = new Elysia({
  prefix: "/api/external-notifications",
})
  .use(auth)
  .use(requireAdmin)
  // GET /api/external-notifications/services - Get all services with templates
  .get("/services", async ({ user, set }) => {
    try {
      const services = await prisma.externalNotificationService.findMany({
        orderBy: { serviceName: "asc" },
      });

      const baseUrl = getBaseUrl();
      const servicesList = [];

      for (const service of services) {
        const webhookUrl =
          service.enabled && service.token
            ? `${baseUrl}/api/webhooks/${service.serviceName}?token=${service.token}`
            : null;

        // Get templates for this service
        const templates = await prisma.notificationTemplate.findMany({
          where: { serviceId: service.id },
          orderBy: [{ eventType: "asc" }, { language: "asc" }],
        });

        servicesList.push({
          id: service.id,
          service_name: service.serviceName,
          enabled: service.enabled,
          token: service.token,
          notify_admins_only: service.notifyAdminsOnly,
          webhook_url: webhookUrl,
          templates: templates.map((t) => ({
            id: t.id,
            service_id: t.serviceId,
            event_type: t.eventType,
            language: t.language,
            title_template: t.titleTemplate,
            body_template: t.bodyTemplate,
            enabled: t.enabled,
            created_at: t.createdAt,
            updated_at: t.updatedAt,
          })),
          created_at: service.createdAt,
          updated_at: service.updatedAt,
        });
      }

      return { services: servicesList };
    } catch (error) {
      console.error("Error getting services:", error);
      return serverError(set, "Failed to get services");
    }
  })
  // POST /api/external-notifications/services/:id/enable - Enable service
  .post("/services/:id/enable", async ({ user, params, set }) => {
    const serviceId = parseInt(params.id, 10);

    try {
      const service = await prisma.externalNotificationService.findFirst({
        where: { id: serviceId },
      });

      if (!service) {
        return notFound(set, "Service not found");
      }

      const newToken = generateServiceToken();
      const now = new Date().toISOString();

      await prisma.externalNotificationService.update({
        where: { id: serviceId },
        data: {
          enabled: true,
          token: newToken,
          updatedAt: now,
        },
      });

      const baseUrl = getBaseUrl();
      const webhookUrl = `${baseUrl}/api/webhooks/${service.serviceName}?token=${newToken}`;

      console.log(`Service ${service.serviceName} enabled with new token`);

      return {
        success: true,
        service: {
          id: service.id,
          service_name: service.serviceName,
          enabled: true,
          token: newToken,
          webhook_url: webhookUrl,
        },
      };
    } catch (error) {
      console.error("Error enabling service:", error);
      return serverError(set, "Failed to enable service");
    }
  })
  // POST /api/external-notifications/services/:id/disable - Disable service
  .post("/services/:id/disable", async ({ user, params, set }) => {
    const serviceId = parseInt(params.id, 10);

    try {
      const service = await prisma.externalNotificationService.findFirst({
        where: { id: serviceId },
      });

      if (!service) {
        return notFound(set, "Service not found");
      }

      await prisma.externalNotificationService.update({
        where: { id: serviceId },
        data: {
          enabled: false,
          token: null,
          updatedAt: new Date().toISOString(),
        },
      });

      console.log(`Service ${service.serviceName} disabled and token deleted`);

      return {
        success: true,
        service: {
          id: service.id,
          service_name: service.serviceName,
          enabled: false,
          token: null,
        },
      };
    } catch (error) {
      console.error("Error disabling service:", error);
      return serverError(set, "Failed to disable service");
    }
  })
  // POST /api/external-notifications/services/:id/regenerate-token
  .post("/services/:id/regenerate-token", async ({ user, params, set }) => {
    const serviceId = parseInt(params.id, 10);

    try {
      const service = await prisma.externalNotificationService.findFirst({
        where: { id: serviceId },
      });

      if (!service) {
        return notFound(set, "Service not found");
      }

      const newToken = generateServiceToken();

      await prisma.externalNotificationService.update({
        where: { id: serviceId },
        data: {
          token: newToken,
          updatedAt: new Date().toISOString(),
        },
      });

      const baseUrl = getBaseUrl();
      const webhookUrl = `${baseUrl}/api/webhooks/${service.serviceName}?token=${newToken}`;

      console.log(`Token regenerated for service ${service.serviceName}`);

      return {
        success: true,
        service: {
          id: service.id,
          service_name: service.serviceName,
          token: newToken,
          webhook_url: webhookUrl,
        },
      };
    } catch (error) {
      console.error("Error regenerating token:", error);
      return serverError(set, "Failed to regenerate token");
    }
  })
  // POST /api/external-notifications/services/:id/notify-admins-only
  .post(
    "/services/:id/notify-admins-only",
    async ({ user, params, body, set }) => {
      const serviceId = parseInt(params.id, 10);
      const { notify_admins_only } = body;

      if (typeof notify_admins_only !== "boolean") {
        return badRequest(set, "notify_admins_only must be a boolean");
      }

      try {
        const service = await prisma.externalNotificationService.findFirst({
          where: { id: serviceId },
        });

        if (!service) {
          return notFound(set, "Service not found");
        }

        await prisma.externalNotificationService.update({
          where: { id: serviceId },
          data: {
            notifyAdminsOnly: notify_admins_only,
            updatedAt: new Date().toISOString(),
          },
        });

        console.log(
          `Updated notify_admins_only=${notify_admins_only} for service ${service.serviceName}`,
        );

        return {
          success: true,
          service: {
            id: service.id,
            service_name: service.serviceName,
            notify_admins_only,
          },
        };
      } catch (error) {
        console.error("Error updating notify_admins_only:", error);
        return serverError(set, "Failed to update notify_admins_only setting");
      }
    },
    {
      body: t.Object({
        notify_admins_only: t.Boolean(),
      }),
    },
  )
  // GET /api/external-notifications/services/logs - Get service logs
  .get("/services/logs", async ({ user, set }) => {
    try {
      const logs = await prisma.externalNotificationServiceLog.findMany({
        include: {
          service: {
            select: {
              serviceName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return {
        logs: logs.map((log) => ({
          id: log.id,
          service_id: log.serviceId,
          service_name: log.service?.serviceName || null,
          event_type: log.eventType,
          status: log.status,
          payload: log.payload,
          created_at: log.createdAt,
        })),
      };
    } catch (error) {
      console.error("Error fetching logs:", error);
      return serverError(set, "Failed to fetch logs");
    }
  })
  // POST /api/external-notifications/templates/toggle - Toggle all templates for a service + event type
  .post(
    "/templates/toggle",
    async ({ user, body, set }) => {
      const { service_id, event_type, enabled } = body;

      try {
        const result = await prisma.notificationTemplate.updateMany({
          where: {
            serviceId: service_id,
            eventType: event_type,
          },
          data: {
            enabled,
            updatedAt: new Date().toISOString(),
          },
        });

        console.log(
          `Toggled ${result.count} templates for service ${service_id}/${event_type} to enabled=${enabled}`,
        );

        return { success: true, updated: result.count };
      } catch (error) {
        console.error("Error toggling templates:", error);
        return serverError(set, "Failed to toggle templates");
      }
    },
    {
      body: t.Object({
        service_id: t.Number(),
        event_type: t.String(),
        enabled: t.Boolean(),
      }),
    },
  )
  // GET /api/external-notifications/templates - Get all templates
  .get("/templates", async ({ user, set }) => {
    try {
      const templates = await prisma.notificationTemplate.findMany({
        include: {
          service: {
            select: {
              serviceName: true,
            },
          },
        },
        orderBy: [
          { serviceId: "asc" },
          { eventType: "asc" },
          { language: "asc" },
        ],
      });

      return {
        templates: templates.map((t) => ({
          id: t.id,
          service_id: t.serviceId,
          service_name: t.service?.serviceName || null,
          event_type: t.eventType,
          language: t.language,
          title_template: t.titleTemplate,
          body_template: t.bodyTemplate,
          enabled: t.enabled,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Error fetching templates:", error);
      return serverError(set, "Failed to fetch templates");
    }
  })
  // PUT /api/external-notifications/templates/:id - Update a template
  .put(
    "/templates/:id",
    async ({ user, params, body, set }) => {
      const templateId = parseInt(params.id, 10);
      const { title_template, body_template } = body;

      // At least one field must be provided
      if (title_template === undefined && body_template === undefined) {
        return badRequest(
          set,
          "At least one of title_template or body_template is required",
        );
      }

      try {
        const template = await prisma.notificationTemplate.findFirst({
          where: { id: templateId },
        });

        if (!template) {
          return notFound(set, "Template not found");
        }

        // Build update object
        const updateData: {
          titleTemplate?: string;
          bodyTemplate?: string;
          updatedAt: string;
        } = {
          updatedAt: new Date().toISOString(),
        };

        if (title_template !== undefined) {
          updateData.titleTemplate = title_template;
        }
        if (body_template !== undefined) {
          updateData.bodyTemplate = body_template;
        }

        const updatedTemplate = await prisma.notificationTemplate.update({
          where: { id: templateId },
          data: updateData,
        });

        // Get service name for response
        const service = await prisma.externalNotificationService.findFirst({
          where: { id: updatedTemplate.serviceId },
        });

        console.log(`Updated template ${templateId}`);

        return {
          success: true,
          template: {
            id: updatedTemplate.id,
            service_id: updatedTemplate.serviceId,
            service_name: service?.serviceName || null,
            event_type: updatedTemplate.eventType,
            language: updatedTemplate.language,
            title_template: updatedTemplate.titleTemplate,
            body_template: updatedTemplate.bodyTemplate,
            enabled: updatedTemplate.enabled,
            created_at: updatedTemplate.createdAt,
            updated_at: updatedTemplate.updatedAt,
          },
        };
      } catch (error) {
        console.error("Error updating template:", error);
        return serverError(set, "Failed to update template");
      }
    },
    {
      body: t.Object({
        title_template: t.Optional(t.String()),
        body_template: t.Optional(t.String()),
      }),
    },
  );
