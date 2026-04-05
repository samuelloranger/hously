import { Elysia } from "elysia";
import { prisma } from "../../db";
import { webhookHandlers } from "../../services/webhookHandlers";
import { enrichArrWebhookNotification } from "../../services/webhookEnrichment";
import { sendExternalNotification } from "../../services/externalNotificationService";
import { deleteCache } from "../../services/cache";
import { badRequest, forbidden, notFound, serverError } from "../../errors";

export const webhooksRoutes = new Elysia({ prefix: "/api/webhooks" })
  // Read all webhook bodies as raw text to avoid Elysia's parser failing on
  // non-standard payloads (e.g. Kopia sends application/json with plain text body)
  .onParse(({ request }) => request.text())
  // POST /api/webhooks/:serviceName - Receive webhook from external service
  .post("/:serviceName", async ({ params, query, body, set, request }) => {
    const { serviceName } = params;
    const token = query.token as string | undefined;

    // Validate token is provided
    if (!token) {
      console.warn(`${serviceName} webhook received without token`);
      return badRequest(set, "Token required");
    }

    // Check if handler exists for this service
    const handler = webhookHandlers[serviceName.toLowerCase()];
    if (!handler) {
      console.warn(`Unknown webhook service: ${serviceName}`);
      return notFound(set, "Unknown service");
    }

    try {
      // Validate token against database
      const service = await prisma.externalNotificationService.findFirst({
        where: {
          serviceName: serviceName.toLowerCase(),
          token: token,
          enabled: true,
        },
      });

      if (!service) {
        console.warn(
          `Invalid or disabled token for ${serviceName} webhook: ${token.slice(0, 10)}...`,
        );
        return forbidden(set, "Invalid or disabled token");
      }

      // Parse webhook payload — onParse gives us raw text for all content types
      let payload: Record<string, unknown>;
      const rawText = typeof body === "string" ? body : "";
      if (!rawText) {
        console.warn(`${serviceName} webhook received with empty payload`);
        return badRequest(set, "Invalid payload");
      }
      try {
        const parsed = JSON.parse(rawText);
        payload =
          typeof parsed === "object" && parsed !== null
            ? parsed
            : { body: rawText };
      } catch {
        payload = { body: rawText };
      }

      // Inject HTTP headers into payload (e.g. Kopia sends Subject as a header)
      const subjectHeader = request.headers.get("subject");
      if (subjectHeader && !payload.subject) payload.subject = subjectHeader;

      // Invalidate media cache if Radarr or Sonarr
      if (serviceName.toLowerCase() === "radarr") {
        await deleteCache("medias:radarr:ids");
      } else if (serviceName.toLowerCase() === "sonarr") {
        await deleteCache("medias:sonarr:ids");
      }

      // Handle webhook first to get the real event_type
      try {
        const parsed = handler(payload);

        if (!parsed) {
          console.warn(
            `${serviceName} webhook payload rejected by handler (insufficient data)`,
          );
          return badRequest(set, "Webhook payload missing required fields");
        }

        const eventType = parsed.event_type;
        const enrichment = await enrichArrWebhookNotification(
          serviceName.toLowerCase(),
          parsed,
        );
        const templateVariables =
          enrichment.template_variables ?? parsed.template_variables;

        console.log(
          `Processing ${serviceName} webhook: event_type=${eventType}`,
        );

        // Create log entry with the real event_type from the handler
        const logEntry = await prisma.externalNotificationServiceLog.create({
          data: {
            serviceId: service.id,
            eventType,
            status: "pending",
            payload: JSON.stringify(payload),
            createdAt: new Date().toISOString(),
          },
        });

        console.log(
          `Created log entry for ${serviceName} webhook: ${logEntry.id}`,
        );

        // Prepare payload for notification service
        const notificationPayload = {
          template_variables: templateVariables,
          original_payload: parsed.original_payload,
          notification_url:
            enrichment.notification_url ?? parsed.notification_url,
          notification_metadata: {
            ...(parsed.notification_metadata ?? {}),
            ...(enrichment.notification_metadata ?? {}),
          },
        };

        // Send notifications
        try {
          const success = await sendExternalNotification(
            serviceName.toLowerCase(),
            eventType,
            notificationPayload,
            "en",
          );

          if (success) {
            await prisma.externalNotificationServiceLog.update({
              where: { id: logEntry.id },
              data: { status: "success" },
            });

            console.log(
              `Successfully processed ${serviceName} webhook: ${eventType}`,
            );
            return {
              success: true,
              message: "Webhook processed successfully",
            };
          } else {
            console.warn(
              `Webhook processed but notifications failed for ${serviceName}: ${eventType}`,
            );
            await prisma.externalNotificationServiceLog.update({
              where: { id: logEntry.id },
              data: { status: "failure" },
            });

            return {
              success: true,
              message: "Webhook processed but no notifications sent",
            };
          }
        } catch (notificationError) {
          console.error(
            `Error sending notifications for ${serviceName} webhook:`,
            notificationError,
          );
          await prisma.externalNotificationServiceLog.update({
            where: { id: logEntry.id },
            data: { status: "failure" },
          });

          return {
            success: true,
            message:
              "Webhook received but notification sending encountered errors",
          };
        }
      } catch (handlerError) {
        console.error(`Error processing ${serviceName} webhook:`, handlerError);
        return serverError(set, "Error processing webhook");
      }
    } catch (error) {
      console.error(`Error receiving ${serviceName} webhook:`, error);
      return serverError(set, "Internal server error");
    }
  });
