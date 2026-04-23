import type {
  NotificationChannelType,
  NtfyChannelConfig,
  TelegramChannelConfig,
  DiscordChannelConfig,
  GotifyChannelConfig,
  PushoverChannelConfig,
  SlackChannelConfig,
  WebhookChannelConfig,
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
// Discord
// ---------------------------------------------------------------------------

export function parseDiscordConfig(raw: unknown): DiscordChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("discord config must be an object");
  }
  const { webhook_url } = raw;

  if (typeof webhook_url !== "string" || webhook_url.length === 0) {
    throw new Error("discord config: webhook_url is required");
  }

  return { webhook_url };
}

export async function dispatchDiscord(
  config: DiscordChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const embed: Record<string, unknown> = {
    title,
    description: body,
    color: 0x5865f2, // Discord blurple
  };
  if (url) embed.url = url;

  const res = await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Hously", embeds: [embed] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`discord ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Gotify
// ---------------------------------------------------------------------------

export function parseGotifyConfig(raw: unknown): GotifyChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("gotify config must be an object");
  }
  const { url, token, priority } = raw;

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("gotify config: url is required");
  }
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("gotify config: token is required");
  }
  if (
    priority !== undefined &&
    (typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 1 ||
      priority > 10)
  ) {
    throw new Error("gotify config: priority must be an integer from 1 to 10");
  }

  const parsed: GotifyChannelConfig = { url, token };
  if (priority !== undefined) parsed.priority = priority as number;
  return parsed;
}

export async function dispatchGotify(
  config: GotifyChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const message = url ? `${body}\n\n${url}` : body;
  const payload: Record<string, unknown> = { title, message };
  if (config.priority !== undefined) payload.priority = config.priority;

  const endpoint = `${config.url.replace(/\/$/, "")}/message?token=${config.token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`gotify ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Pushover
// ---------------------------------------------------------------------------

export function parsePushoverConfig(raw: unknown): PushoverChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("pushover config must be an object");
  }
  const { token, user, priority } = raw;

  if (typeof token !== "string" || token.length === 0) {
    throw new Error("pushover config: token is required");
  }
  if (typeof user !== "string" || user.length === 0) {
    throw new Error("pushover config: user is required");
  }
  if (
    priority !== undefined &&
    (typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < -2 ||
      priority > 1)
  ) {
    throw new Error("pushover config: priority must be -2, -1, 0, or 1");
  }

  const parsed: PushoverChannelConfig = { token, user };
  if (priority !== undefined)
    parsed.priority = priority as PushoverChannelConfig["priority"];
  return parsed;
}

export async function dispatchPushover(
  config: PushoverChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const payload: Record<string, unknown> = {
    token: config.token,
    user: config.user,
    title,
    message: body,
    priority: config.priority ?? 0,
  };
  if (url) {
    payload.url = url;
    payload.url_title = "Open in Hously";
  }

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`pushover ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

export function parseSlackConfig(raw: unknown): SlackChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("slack config must be an object");
  }
  const { webhook_url } = raw;

  if (typeof webhook_url !== "string" || webhook_url.length === 0) {
    throw new Error("slack config: webhook_url is required");
  }

  return { webhook_url };
}

export async function dispatchSlack(
  config: SlackChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const text = `*${title}*\n${body}`;
  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text } },
  ];
  if (url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in Hously" },
          url,
        },
      ],
    });
  }

  const res = await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, blocks }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`slack ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Generic Webhook
// ---------------------------------------------------------------------------

export function parseWebhookConfig(raw: unknown): WebhookChannelConfig {
  if (!isRecord(raw)) {
    throw new Error("webhook config must be an object");
  }
  const { url } = raw;

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("webhook config: url is required");
  }

  return { url };
}

export async function dispatchWebhook(
  config: WebhookChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const payload: Record<string, unknown> = { title, body };
  if (url) payload.url = url;

  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}: ${await res.text()}`);
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
    case "discord":
      return dispatchDiscord(parseDiscordConfig(channel.config), payload);
    case "gotify":
      return dispatchGotify(parseGotifyConfig(channel.config), payload);
    case "pushover":
      return dispatchPushover(parsePushoverConfig(channel.config), payload);
    case "slack":
      return dispatchSlack(parseSlackConfig(channel.config), payload);
    case "webhook":
      return dispatchWebhook(parseWebhookConfig(channel.config), payload);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }
}
