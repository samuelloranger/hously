import type {
  NotificationChannelType,
  NtfyChannelConfig,
  TelegramChannelConfig,
} from "@hously/shared";

export interface DispatchPayload {
  title: string;
  body: string;
  url?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// ntfy
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

export function parseTelegramConfig(raw: unknown): TelegramChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("telegram config must be an object");
  }
  const { bot_token, chat_id } = raw;

  if (typeof bot_token !== "string" || bot_token.length === 0) {
    throw new Error("telegram config: bot_token is required");
  }
  if (typeof chat_id !== "string" || chat_id.length === 0) {
    throw new Error("telegram config: chat_id is required");
  }

  return { bot_token, chat_id };
}

export async function dispatchTelegram(
  config: TelegramChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const text = `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`;
  const payload: Record<string, unknown> = {
    chat_id: config.chat_id,
    text,
    parse_mode: "HTML",
  };
  if (url) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "Open in Hously", url }]],
    };
  }

  const res = await fetch(
    `https://api.telegram.org/bot${config.bot_token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

// Routes a channel to its provider-specific dispatcher and parses the raw
// config at the boundary. Accepts raw Prisma rows (config is unknown).
//
// To add a new provider: add a `case` that parses + dispatches. The
// `never` in the default branch forces a compile error when a new
// NotificationChannelType member is added without a matching case.
export async function dispatchToChannel(
  channel: { type: string; label: string; config: unknown },
  payload: DispatchPayload,
): Promise<void> {
  const type = channel.type as NotificationChannelType;
  switch (type) {
    case "ntfy":
      return dispatchNtfy(parseNtfyConfig(channel.config), payload);
    case "telegram":
      return dispatchTelegram(parseTelegramConfig(channel.config), payload);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }
}
