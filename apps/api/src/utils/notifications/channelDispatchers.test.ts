import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  dispatchNtfy,
  dispatchTelegram,
  dispatchDiscord,
  dispatchToChannel,
  parseNtfyConfig,
  parseTelegramConfig,
  parseDiscordConfig,
} from "./channelDispatchers";
import type {
  NotificationChannel,
  NtfyChannelConfig,
  TelegramChannelConfig,
  DiscordChannelConfig,
} from "@hously/shared";

const payload = {
  title: "Test Title",
  body: "Test body",
  url: "https://example.com",
};

const mockFetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
);

// @ts-ignore
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockClear());

describe("dispatchNtfy", () => {
  const config: NtfyChannelConfig = {
    url: "https://ntfy.example.com",
    topic: "hously",
  };

  it("POSTs to {url}/{topic} with Title, Priority, and Click headers", async () => {
    await dispatchNtfy(config, payload);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://ntfy.example.com/hously");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("Test body");
    const headers = init.headers as Record<string, string>;
    expect(headers["Title"]).toBe("Test Title");
    expect(headers["Priority"]).toBe("3");
    expect(headers["Click"]).toBe("https://example.com");
  });

  it("adds Authorization header when token is set", async () => {
    await dispatchNtfy({ ...config, token: "mytoken" }, payload);
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer mytoken",
    );
  });

  it("respects custom priority", async () => {
    await dispatchNtfy({ ...config, priority: 5 }, payload);
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["Priority"]).toBe("5");
  });

  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Bad Request", { status: 400 }),
    );
    await expect(dispatchNtfy(config, payload)).rejects.toThrow("ntfy 400");
  });
});

describe("dispatchTelegram", () => {
  const config: TelegramChannelConfig = {
    bot_token: "123456:ABC-DEF",
    chat_id: "-1001234567890",
  };

  it("POSTs to the correct Telegram API URL", async () => {
    await dispatchTelegram(config, payload);
    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123456:ABC-DEF/sendMessage");
  });

  it("sends HTML-formatted text with bold title", async () => {
    await dispatchTelegram(config, payload);
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe("-1001234567890");
    expect(body.parse_mode).toBe("HTML");
    expect(body.text).toBe("<b>Test Title</b>\nTest body");
  });

  it("includes inline keyboard button with click URL when url is provided", async () => {
    await dispatchTelegram(config, payload);
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "Open in Hously", url: "https://example.com" }],
      ],
    });
  });

  it("omits reply_markup when no url is provided", async () => {
    await dispatchTelegram(config, { title: "T", body: "B" });
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.reply_markup).toBeUndefined();
  });

  it("escapes HTML special characters in title and body", async () => {
    await dispatchTelegram(config, {
      title: "Chore <Kitchen> & Bath",
      body: "Don't forget: clean <sink> & floor",
    });
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe(
      "<b>Chore &lt;Kitchen&gt; &amp; Bath</b>\nDon't forget: clean &lt;sink&gt; &amp; floor",
    );
  });

  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    await expect(dispatchTelegram(config, payload)).rejects.toThrow(
      "telegram 401",
    );
  });
});

describe("dispatchToChannel", () => {
  it("routes to ntfy dispatcher based on channel type", async () => {
    const channel: NotificationChannel = {
      id: 1,
      type: "ntfy",
      label: "My Phone",
      config: { url: "https://ntfy.example.com", topic: "hously" },
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dispatchToChannel(channel, payload);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ntfy.example.com/hously");
  });

  it("routes to telegram dispatcher based on channel type", async () => {
    const channel: NotificationChannel = {
      id: 2,
      type: "telegram",
      label: "My Telegram",
      config: { bot_token: "123:ABC", chat_id: "42" },
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dispatchToChannel(channel, payload);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
  });

  it("throws on unknown channel type", async () => {
    await expect(
      dispatchToChannel({ type: "unknown", label: "Bad", config: {} }, payload),
    ).rejects.toThrow("Unknown notification channel type: unknown");
  });

  it("throws when ntfy config is malformed", async () => {
    await expect(
      dispatchToChannel(
        { type: "ntfy", label: "Broken", config: { topic: "x" } },
        payload,
      ),
    ).rejects.toThrow("ntfy config: url is required");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when telegram config is malformed", async () => {
    await expect(
      dispatchToChannel(
        { type: "telegram", label: "Broken", config: { bot_token: "123" } },
        payload,
      ),
    ).rejects.toThrow("telegram config: chat_id is required");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("parseNtfyConfig", () => {
  it("returns a typed config when url + topic are present", () => {
    const parsed = parseNtfyConfig({
      url: "https://ntfy.example.com",
      topic: "hously",
    });
    expect(parsed).toEqual({
      url: "https://ntfy.example.com",
      topic: "hously",
    });
  });

  it("carries token and priority through when provided", () => {
    const parsed = parseNtfyConfig({
      url: "https://ntfy.example.com",
      topic: "hously",
      token: "abc",
      priority: 4,
    });
    expect(parsed).toEqual({
      url: "https://ntfy.example.com",
      topic: "hously",
      token: "abc",
      priority: 4,
    });
  });

  it("rejects non-object input", () => {
    expect(() => parseNtfyConfig("not an object")).toThrow(
      "ntfy config must be an object",
    );
    expect(() => parseNtfyConfig(null)).toThrow(
      "ntfy config must be an object",
    );
    expect(() => parseNtfyConfig([])).toThrow("ntfy config must be an object");
  });

  it("rejects out-of-range priority", () => {
    expect(() =>
      parseNtfyConfig({
        url: "https://ntfy.example.com",
        topic: "hously",
        priority: 9,
      }),
    ).toThrow("priority must be an integer from 1 to 5");
  });
});

describe("parseTelegramConfig", () => {
  it("returns a typed config when bot_token and chat_id are present", () => {
    const parsed = parseTelegramConfig({
      bot_token: "123456:ABC-DEF",
      chat_id: "-1001234567890",
    });
    expect(parsed).toEqual({
      bot_token: "123456:ABC-DEF",
      chat_id: "-1001234567890",
    });
  });

  it("rejects non-object input", () => {
    expect(() => parseTelegramConfig("not an object")).toThrow(
      "telegram config must be an object",
    );
    expect(() => parseTelegramConfig(null)).toThrow(
      "telegram config must be an object",
    );
  });

  it("rejects missing bot_token", () => {
    expect(() => parseTelegramConfig({ chat_id: "42" })).toThrow(
      "telegram config: bot_token is required",
    );
  });

  it("rejects empty bot_token", () => {
    expect(() => parseTelegramConfig({ bot_token: "", chat_id: "42" })).toThrow(
      "telegram config: bot_token is required",
    );
  });

  it("rejects missing chat_id", () => {
    expect(() => parseTelegramConfig({ bot_token: "123:ABC" })).toThrow(
      "telegram config: chat_id is required",
    );
  });

  it("rejects empty chat_id", () => {
    expect(() =>
      parseTelegramConfig({ bot_token: "123:ABC", chat_id: "" }),
    ).toThrow("telegram config: chat_id is required");
  });
});

describe("dispatchDiscord", () => {
  const config: DiscordChannelConfig = {
    webhook_url: "https://discord.com/api/webhooks/123/abc",
  };

  it("POSTs to the webhook URL with an embed", async () => {
    await dispatchDiscord(config, payload);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://discord.com/api/webhooks/123/abc");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.username).toBe("Hously");
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].title).toBe("Test Title");
    expect(body.embeds[0].description).toBe("Test body");
    expect(body.embeds[0].color).toBe(0x5865f2);
  });

  it("sets embed url when click URL is provided", async () => {
    await dispatchDiscord(config, payload);
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.embeds[0].url).toBe("https://example.com");
  });

  it("omits embed url when no click URL is provided", async () => {
    await dispatchDiscord(config, { title: "T", body: "B" });
    const [, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.embeds[0].url).toBeUndefined();
  });

  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Bad Request", { status: 400 }),
    );
    await expect(dispatchDiscord(config, payload)).rejects.toThrow(
      "discord 400",
    );
  });
});

describe("parseDiscordConfig", () => {
  it("returns a typed config when webhook_url is present", () => {
    const parsed = parseDiscordConfig({
      webhook_url: "https://discord.com/api/webhooks/123/abc",
    });
    expect(parsed).toEqual({
      webhook_url: "https://discord.com/api/webhooks/123/abc",
    });
  });

  it("rejects non-object input", () => {
    expect(() => parseDiscordConfig(null)).toThrow(
      "discord config must be an object",
    );
    expect(() => parseDiscordConfig("string")).toThrow(
      "discord config must be an object",
    );
  });

  it("rejects missing webhook_url", () => {
    expect(() => parseDiscordConfig({})).toThrow(
      "discord config: webhook_url is required",
    );
  });

  it("rejects empty webhook_url", () => {
    expect(() => parseDiscordConfig({ webhook_url: "" })).toThrow(
      "discord config: webhook_url is required",
    );
  });
});
