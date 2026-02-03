import { Elysia } from "elysia";
import { db } from "../db";
import {
  externalNotificationServices,
  externalNotificationServiceLogs,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { webhookHandlers } from "../services/webhookHandlers";
import { sendExternalNotification } from "../services/externalNotificationService";

export const webhooksRoutes = new Elysia({ prefix: "/api/webhooks" })
  // POST /api/webhooks/:serviceName - Receive webhook from external service
  .post("/:serviceName", async ({ params, query, body, set }) => {
    const { serviceName } = params;
    const token = query.token as string | undefined;

    // Validate token is provided
    if (!token) {
      console.warn(`${serviceName} webhook received without token`);
      set.status = 400;
      return { error: "Token required" };
    }

    // Check if handler exists for this service
    const handler = webhookHandlers[serviceName.toLowerCase()];
    if (!handler) {
      console.warn(`Unknown webhook service: ${serviceName}`);
      set.status = 404;
      return { error: "Unknown service" };
    }

    try {
      // Validate token against database
      const service = await db.query.externalNotificationServices.findFirst({
        where: and(
          eq(externalNotificationServices.serviceName, serviceName.toLowerCase()),
          eq(externalNotificationServices.token, token),
          eq(externalNotificationServices.enabled, true)
        ),
      });

      if (!service) {
        console.warn(
          `Invalid or disabled token for ${serviceName} webhook: ${token.slice(0, 10)}...`
        );
        set.status = 403;
        return { error: "Invalid or disabled token" };
      }

      // Parse webhook payload
      const payload = body as Record<string, unknown>;
      if (!payload || typeof payload !== "object") {
        console.warn(`${serviceName} webhook received with empty payload`);
        set.status = 400;
        return { error: "Invalid payload" };
      }

      // Extract event type for logging
      const rawEventType =
        (payload.event_type as string) ||
        (payload.eventType as string) ||
        (payload.event as string) ||
        "unknown";

      // Create log entry
      const [logEntry] = await db
        .insert(externalNotificationServiceLogs)
        .values({
          serviceId: service.id,
          eventType: rawEventType,
          status: "pending",
          payload: JSON.stringify(payload),
          createdAt: new Date().toISOString(),
        })
        .returning();

      console.log(
        `Created log entry for ${serviceName} webhook: ${logEntry.id}`
      );

      // Handle webhook
      try {
        const parsed = handler(payload);
        const eventType = parsed.event_type;
        const templateVariables = parsed.template_variables;

        console.log(`Processing ${serviceName} webhook: event_type=${eventType}`);

        // Prepare payload for notification service
        const notificationPayload = {
          template_variables: templateVariables,
          original_payload: parsed.original_payload,
        };

        // Send notifications
        try {
          const success = await sendExternalNotification(
            serviceName.toLowerCase(),
            eventType,
            notificationPayload,
            "en"
          );

          if (success) {
            await db
              .update(externalNotificationServiceLogs)
              .set({ status: "success" })
              .where(eq(externalNotificationServiceLogs.id, logEntry.id));

            console.log(
              `Successfully processed ${serviceName} webhook: ${eventType}`
            );
            return {
              success: true,
              message: "Webhook processed successfully",
            };
          } else {
            console.warn(
              `Webhook processed but notifications failed for ${serviceName}: ${eventType}`
            );
            await db
              .update(externalNotificationServiceLogs)
              .set({ status: "failure" })
              .where(eq(externalNotificationServiceLogs.id, logEntry.id));

            return {
              success: true,
              message: "Webhook processed but no notifications sent",
            };
          }
        } catch (notificationError) {
          console.error(
            `Error sending notifications for ${serviceName} webhook:`,
            notificationError
          );
          await db
            .update(externalNotificationServiceLogs)
            .set({ status: "failure" })
            .where(eq(externalNotificationServiceLogs.id, logEntry.id));

          return {
            success: true,
            message: "Webhook received but notification sending encountered errors",
          };
        }
      } catch (handlerError) {
        console.error(`Error processing ${serviceName} webhook:`, handlerError);
        await db
          .update(externalNotificationServiceLogs)
          .set({ status: "failure" })
          .where(eq(externalNotificationServiceLogs.id, logEntry.id));

        set.status = 500;
        return { error: "Error processing webhook" };
      }
    } catch (error) {
      console.error(`Error receiving ${serviceName} webhook:`, error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  });
