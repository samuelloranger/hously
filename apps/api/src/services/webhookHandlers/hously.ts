import type { WebhookHandler } from "./types";
import { ensureStrings } from "./utils";

export const handleHouslyWebhook: WebhookHandler = (payload) => {
  const eventType =
    (payload.event_type as string) || (payload.event as string) || "AppUpdate";
  const variables: Record<string, unknown> = {
    version: payload.version || "unknown",
    message: payload.message || "Hously has been updated.",
    environment: payload.environment || "production",
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
