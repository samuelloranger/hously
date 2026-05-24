import type { WebhookHandler } from "./types";
import { ensureStrings } from "./utils";

export const handleKopiaWebhook: WebhookHandler = (payload) => {
  const bodyText = (payload.body as string) || "";

  const extract = (key: string) => {
    const match = bodyText.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  const path = extract("Path");
  const status = extract("Status");
  const duration = extract("Duration");
  const size = extract("Size");
  const files = extract("Files");
  const directories = extract("Directories");
  const subject = (payload.subject as string) || "";

  const statusLower = status.toLowerCase();
  const eventType =
    statusLower.includes("fail") || statusLower.includes("error")
      ? "BackupError"
      : statusLower.includes("warn")
        ? "BackupWarning"
        : "BackupSuccess";

  const variables: Record<string, unknown> = {
    subject,
    path,
    status,
    duration,
    size,
    files,
    directories,
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
