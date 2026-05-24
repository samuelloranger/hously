import type { WebhookHandler } from "./types";
import { ensureStrings } from "./utils";

export const handleProwlarrWebhook: WebhookHandler = (payload) => {
  const eventType = (payload.eventType as string) || "";
  const variables: Record<string, unknown> = {};

  if (eventType === "HealthIssue" || eventType === "HealthRestored") {
    variables.message = payload.message || "";
    variables.level = payload.level || "";
    variables.type = payload.type || "";
  }

  if (eventType === "ApplicationUpdate") {
    variables.version = `${payload.previousVersion || ""} → ${payload.newVersion || ""}`;
    variables.previous_version = payload.previousVersion || "";
    variables.new_version = payload.newVersion || "";
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
