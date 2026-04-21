import type {
  NotificationChannelType,
  NtfyChannelConfig,
} from "@hously/shared";

export interface DispatchPayload {
  title: string;
  body: string;
  url?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Validates a raw (JSON) value into an NtfyChannelConfig. Throws with a
// user-facing message if the shape is wrong.
export function parseNtfyConfig(raw: unknown): NtfyChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("ntfy config must be an object");
  }
  const { url, topic, token, priority } = raw;

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("ntfy config: url is required");
  }
  if (typeof topic !== "string" || topic.length === 0) {
    throw new Error("ntfy config: topic is required");
  }
  if (token !== undefined && typeof token !== "string") {
    throw new Error("ntfy config: token must be a string");
  }
  if (
    priority !== undefined &&
    (typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 1 ||
      priority > 5)
  ) {
    throw new Error("ntfy config: priority must be an integer from 1 to 5");
  }

  const parsed: NtfyChannelConfig = { url, topic };
  if (token !== undefined) parsed.token = token;
  if (priority !== undefined) {
    parsed.priority = priority as NtfyChannelConfig["priority"];
  }
  return parsed;
}

export async function dispatchNtfy(
  config: NtfyChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const headers: Record<string, string> = {
    Title: title,
    Priority: String(config.priority ?? 3),
    "Content-Type": "text/plain",
  };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (url) headers["Click"] = url;

  const res = await fetch(`${config.url}/${config.topic}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${await res.text()}`);
}

// Orchestrator: routes a channel to its provider-specific dispatcher and
// parses the raw config at the boundary. Accepts raw Prisma rows (where
// `config` is a JsonValue/unknown) — callers don't need to cast.
//
// To add a new provider: add a `case` that parses + dispatches. The
// `never` in the default branch forces a compile error when a new
// NotificationChannelType member is added without a case here.
export async function dispatchToChannel(
  channel: { type: string; label: string; config: unknown },
  payload: DispatchPayload,
): Promise<void> {
  const type = channel.type as NotificationChannelType;
  switch (type) {
    case "ntfy":
      return dispatchNtfy(parseNtfyConfig(channel.config), payload);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }
}
