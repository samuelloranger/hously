import type { WebhookHandler } from "./types";
import { ensureStrings, firstString } from "./utils";

export const handleBeszelWebhook: WebhookHandler = (payload) => {
  const title = firstString(payload.title, payload.Title);
  const rawBody = firstString(payload.message, payload.body, payload.Message);

  if (!title && !rawBody) return null;

  let displayTitle = title;
  let message = rawBody;
  if (!displayTitle && rawBody.includes("\n")) {
    const lines = rawBody.split("\n").filter((l: string) => l.trim());
    displayTitle = lines[0] ?? rawBody;
    message = lines.slice(1).join("\n").trim();
  }

  const t = (displayTitle || "").toLowerCase();

  let eventType = "Alert";
  let system_name = "";
  let alert_name = "";

  if (/\bis down\b/.test(t)) {
    eventType = "StatusDown";
    system_name = (displayTitle || "").replace(/\s+is\s+down.*/i, "").trim();
  } else if (/\bis back up\b/.test(t)) {
    eventType = "StatusUp";
    system_name = (displayTitle || "")
      .replace(/\s+is\s+back\s+up.*/i, "")
      .trim();
  } else if (/above threshold/.test(t)) {
    eventType = "AlertTriggered";
    const words = (displayTitle || "")
      .replace(/\s+above\s+threshold.*/i, "")
      .trim()
      .split(/\s+/);
    alert_name = words.pop() ?? "";
    system_name = words.join(" ");
  } else if (/below threshold/.test(t)) {
    eventType = "AlertResolved";
    const words = (displayTitle || "")
      .replace(/\s+below\s+threshold.*/i, "")
      .trim()
      .split(/\s+/);
    alert_name = words.pop() ?? "";
    system_name = words.join(" ");
  } else if (/smart/i.test(t)) {
    eventType = "SmartAlert";
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings({
      title: displayTitle || rawBody,
      message,
      system_name,
      alert_name,
    }),
    original_payload: payload,
  };
};
