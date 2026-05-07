import { describe, expect, it } from "bun:test";
import {
  getJellyfinPlaybackInfo,
  buildJellyfinMasterStreamUrl,
} from "./playback";

describe("getJellyfinPlaybackInfo", () => {
  it("returns 404 when integration is missing", async () => {
    const r = await getJellyfinPlaybackInfo("abc", {
      getIntegration: async () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.message).toBe("Jellyfin integration not configured");
    }
  });

  it("returns 404 when integration is disabled", async () => {
    const r = await getJellyfinPlaybackInfo("abc", {
      getIntegration: async () => ({
        enabled: false,
        config: { website_url: "https://jf.example", api_key: "k" },
      }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("returns 404 when Jellyfin returns 404 for the item", async () => {
    const r = await getJellyfinPlaybackInfo("missing", {
      getIntegration: async () => ({
        enabled: true,
        config: { website_url: "https://jf.example", api_key: "k" },
      }),
      fetchImpl: (async () =>
        new Response(null, {
          status: 404,
        })) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.message).toBe("Item not found in Jellyfin");
    }
  });

  it("returns expected stream_url shape when config and item are valid", async () => {
    const r = await getJellyfinPlaybackInfo("item-guid", {
      getIntegration: async () => ({
        enabled: true,
        config: {
          website_url: "https://jf.example",
          api_key: "secret-key",
        },
      }),
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            Id: "item-guid",
            Type: "Episode",
            Name: "Pilot",
            SeriesName: "Test Show",
            ParentIndexNumber: 1,
            IndexNumber: 3,
            RunTimeTicks: 27000000000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.item_id).toBe("item-guid");
      expect(r.body.title).toBe("Test Show — S01E03");
      expect(r.body.container).toBe("hls");
      expect(r.body.mime_type).toBe("application/vnd.apple.mpegurl");
      expect(r.body.duration_ticks).toBe(27000000000);
      expect(r.body.stream_url).toContain(
        "https://jf.example/Videos/item-guid/master.m3u8",
      );
      expect(r.body.stream_url).toContain("api_key=secret-key");
      expect(r.body.stream_url).toContain("MediaSourceId=item-guid");
      expect(r.body.stream_url).toContain(
        "PlaySessionId=hously-demo-item-guid",
      );
      expect(r.body.stream_url).toContain("VideoCodec=h264");
      expect(r.body.stream_url).toContain("AudioCodec=aac");
    }
  });
});

describe("buildJellyfinMasterStreamUrl", () => {
  it("preserves base origin and query params", () => {
    const u = buildJellyfinMasterStreamUrl(
      "https://jf.example",
      "abc-123",
      "k",
    );
    const parsed = new URL(u);
    expect(parsed.origin).toBe("https://jf.example");
    expect(parsed.pathname).toBe("/Videos/abc-123/master.m3u8");
    expect(parsed.searchParams.get("api_key")).toBe("k");
  });
});
