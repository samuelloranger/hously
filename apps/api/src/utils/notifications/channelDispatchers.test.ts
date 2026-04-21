import { describe, it, expect, mock, beforeEach } from "bun:test";
import { dispatchNtfy, dispatchToChannel } from "./channelDispatchers";
import type { NtfyChannelConfig, NotificationChannel } from "@hously/shared";

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

  it("throws on unknown channel type", async () => {
    const channel = {
      id: 1,
      type: "unknown",
      label: "Bad",
      config: {},
      enabled: true,
      created_at: "",
      updated_at: "",
    } as unknown as NotificationChannel;
    await expect(dispatchToChannel(channel, payload)).rejects.toThrow(
      "Unknown notification channel type: unknown",
    );
  });
});
