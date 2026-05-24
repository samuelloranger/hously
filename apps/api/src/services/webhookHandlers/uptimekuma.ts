import type { WebhookHandler } from "./types";
import { asRecord, ensureStrings } from "./utils";

export const handleUptimekumaWebhook: WebhookHandler = (payload) => {
  const monitor = asRecord(payload.monitor || payload.Monitor);
  const heartbeat = asRecord(payload.heartbeat || payload.Heartbeat);

  let eventType: string;
  if (typeof payload.event === "string" && payload.event.trim()) {
    eventType = payload.event;
  } else if (heartbeat && typeof heartbeat.status === "number") {
    eventType =
      heartbeat.status === 0
        ? "MonitorDown"
        : heartbeat.status === 1
          ? "MonitorUp"
          : "MonitorEvent";
  } else {
    eventType = "MonitorEvent";
  }

  const variables: Record<string, unknown> = {};

  if (monitor) {
    variables.monitor_name = monitor.name || monitor.Name || "Unknown Monitor";
    variables.monitor_url = monitor.url || monitor.URL || "";
    variables.monitor_type = monitor.type || monitor.Type || "";
  }

  if (heartbeat) {
    variables.status = heartbeat.status === 1 ? "UP" : "DOWN";
    variables.ping = heartbeat.ping || "";
    variables.message = heartbeat.msg || heartbeat.message || "";
    variables.duration = heartbeat.duration || "";
  }

  variables.msg = (payload.msg as string) || (payload.message as string) || "";

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
