import type { WebhookHandler } from "./types";
import { ensureStrings, firstString } from "./utils";

export const handleGenericWebhook: WebhookHandler = (payload) => {
  const title = firstString(
    payload.title,
    payload.Title,
    payload.subject,
    payload.Subject,
  );
  const body = firstString(
    payload.body,
    payload.Body,
    payload.message,
    payload.Message,
  );

  if (!title && !body) return null;

  return {
    event_type: "GENERIC",
    template_variables: ensureStrings({
      ...payload,
      title: title || "Generic notification",
      body: body || "No details provided.",
    }),
    original_payload: payload,
  };
};
