import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { db } from "../db";
import {
  externalNotificationServices,
  externalNotificationServiceLogs,
  notificationTemplates,
} from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateServiceToken } from "../services/externalNotificationService";

// Helper to get base URL
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const externalNotificationsRoutes = new Elysia({
  prefix: "/api/external-notifications",
})
  .use(auth)
  // GET /api/external-notifications/services - Get all services with templates
  .get("/services", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    try {
      const services = await db
        .select()
        .from(externalNotificationServices)
        .orderBy(externalNotificationServices.serviceName);

      const baseUrl = getBaseUrl();
      const servicesList = [];

      for (const service of services) {
        const webhookUrl =
          service.enabled && service.token
            ? `${baseUrl}/api/webhooks/${service.serviceName}?token=${service.token}`
            : null;

        // Get templates for this service
        const templates = await db
          .select()
          .from(notificationTemplates)
          .where(eq(notificationTemplates.serviceId, service.id))
          .orderBy(
            notificationTemplates.eventType,
            notificationTemplates.language
          );

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
      set.status = 500;
      return { error: "Failed to get services" };
    }
  })
  // POST /api/external-notifications/services/:id/enable - Enable service
  .post("/services/:id/enable", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    const serviceId = parseInt(params.id, 10);

    try {
      const service = await db.query.externalNotificationServices.findFirst({
        where: eq(externalNotificationServices.id, serviceId),
      });

      if (!service) {
        set.status = 404;
        return { error: "Service not found" };
      }

      const newToken = generateServiceToken();
      const now = new Date().toISOString();

      await db
        .update(externalNotificationServices)
        .set({
          enabled: true,
          token: newToken,
          updatedAt: now,
        })
        .where(eq(externalNotificationServices.id, serviceId));

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
      set.status = 500;
      return { error: "Failed to enable service" };
    }
  })
  // POST /api/external-notifications/services/:id/disable - Disable service
  .post("/services/:id/disable", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    const serviceId = parseInt(params.id, 10);

    try {
      const service = await db.query.externalNotificationServices.findFirst({
        where: eq(externalNotificationServices.id, serviceId),
      });

      if (!service) {
        set.status = 404;
        return { error: "Service not found" };
      }

      await db
        .update(externalNotificationServices)
        .set({
          enabled: false,
          token: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(externalNotificationServices.id, serviceId));

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
      set.status = 500;
      return { error: "Failed to disable service" };
    }
  })
  // POST /api/external-notifications/services/:id/regenerate-token
  .post("/services/:id/regenerate-token", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    const serviceId = parseInt(params.id, 10);

    try {
      const service = await db.query.externalNotificationServices.findFirst({
        where: eq(externalNotificationServices.id, serviceId),
      });

      if (!service) {
        set.status = 404;
        return { error: "Service not found" };
      }

      const newToken = generateServiceToken();

      await db
        .update(externalNotificationServices)
        .set({
          token: newToken,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(externalNotificationServices.id, serviceId));

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
      set.status = 500;
      return { error: "Failed to regenerate token" };
    }
  })
  // POST /api/external-notifications/services/:id/notify-admins-only
  .post(
    "/services/:id/notify-admins-only",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: "Admin privileges required" };
      }

      const serviceId = parseInt(params.id, 10);
      const { notify_admins_only } = body;

      if (typeof notify_admins_only !== "boolean") {
        set.status = 400;
        return { error: "notify_admins_only must be a boolean" };
      }

      try {
        const service = await db.query.externalNotificationServices.findFirst({
          where: eq(externalNotificationServices.id, serviceId),
        });

        if (!service) {
          set.status = 404;
          return { error: "Service not found" };
        }

        await db
          .update(externalNotificationServices)
          .set({
            notifyAdminsOnly: notify_admins_only,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(externalNotificationServices.id, serviceId));

        console.log(
          `Updated notify_admins_only=${notify_admins_only} for service ${service.serviceName}`
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
        set.status = 500;
        return { error: "Failed to update notify_admins_only setting" };
      }
    },
    {
      body: t.Object({
        notify_admins_only: t.Boolean(),
      }),
    }
  )
  // GET /api/external-notifications/services/logs - Get service logs
  .get("/services/logs", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    try {
      const logs = await db
        .select({
          id: externalNotificationServiceLogs.id,
          serviceId: externalNotificationServiceLogs.serviceId,
          eventType: externalNotificationServiceLogs.eventType,
          status: externalNotificationServiceLogs.status,
          payload: externalNotificationServiceLogs.payload,
          createdAt: externalNotificationServiceLogs.createdAt,
          serviceName: externalNotificationServices.serviceName,
        })
        .from(externalNotificationServiceLogs)
        .leftJoin(
          externalNotificationServices,
          eq(
            externalNotificationServiceLogs.serviceId,
            externalNotificationServices.id
          )
        )
        .orderBy(desc(externalNotificationServiceLogs.createdAt))
        .limit(100);

      return {
        logs: logs.map((log) => ({
          id: log.id,
          service_id: log.serviceId,
          service_name: log.serviceName,
          event_type: log.eventType,
          status: log.status,
          payload: log.payload,
          created_at: log.createdAt,
        })),
      };
    } catch (error) {
      console.error("Error fetching logs:", error);
      set.status = 500;
      return { error: "Failed to fetch logs" };
    }
  })
  // GET /api/external-notifications/templates - Get all templates
  .get("/templates", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: "Admin privileges required" };
    }

    try {
      const templates = await db
        .select({
          id: notificationTemplates.id,
          serviceId: notificationTemplates.serviceId,
          eventType: notificationTemplates.eventType,
          language: notificationTemplates.language,
          titleTemplate: notificationTemplates.titleTemplate,
          bodyTemplate: notificationTemplates.bodyTemplate,
          createdAt: notificationTemplates.createdAt,
          updatedAt: notificationTemplates.updatedAt,
          serviceName: externalNotificationServices.serviceName,
        })
        .from(notificationTemplates)
        .leftJoin(
          externalNotificationServices,
          eq(notificationTemplates.serviceId, externalNotificationServices.id)
        )
        .orderBy(
          notificationTemplates.serviceId,
          notificationTemplates.eventType,
          notificationTemplates.language
        );

      return {
        templates: templates.map((t) => ({
          id: t.id,
          service_id: t.serviceId,
          service_name: t.serviceName,
          event_type: t.eventType,
          language: t.language,
          title_template: t.titleTemplate,
          body_template: t.bodyTemplate,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Error fetching templates:", error);
      set.status = 500;
      return { error: "Failed to fetch templates" };
    }
  })
  // PUT /api/external-notifications/templates/:id - Update a template
  .put(
    "/templates/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: "Admin privileges required" };
      }

      const templateId = parseInt(params.id, 10);
      const { title_template, body_template } = body;

      // At least one field must be provided
      if (title_template === undefined && body_template === undefined) {
        set.status = 400;
        return { error: "At least one of title_template or body_template is required" };
      }

      try {
        const template = await db.query.notificationTemplates.findFirst({
          where: eq(notificationTemplates.id, templateId),
        });

        if (!template) {
          set.status = 404;
          return { error: "Template not found" };
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

        const [updatedTemplate] = await db
          .update(notificationTemplates)
          .set(updateData)
          .where(eq(notificationTemplates.id, templateId))
          .returning();

        // Get service name for response
        const service = await db.query.externalNotificationServices.findFirst({
          where: eq(externalNotificationServices.id, updatedTemplate.serviceId),
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
            created_at: updatedTemplate.createdAt,
            updated_at: updatedTemplate.updatedAt,
          },
        };
      } catch (error) {
        console.error("Error updating template:", error);
        set.status = 500;
        return { error: "Failed to update template" };
      }
    },
    {
      body: t.Object({
        title_template: t.Optional(t.String()),
        body_template: t.Optional(t.String()),
      }),
    }
  );
