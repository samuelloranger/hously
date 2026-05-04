import { describe, it, expect } from "bun:test";
import { normalizeJellyfinSyncConfig } from "./normalizers";

describe("normalizeJellyfinSyncConfig", () => {
  it("returns null when config is null", () => {
    expect(normalizeJellyfinSyncConfig(null)).toBeNull();
  });

  it("returns null when sync_token is missing", () => {
    expect(
      normalizeJellyfinSyncConfig({ website_url: "http://jf.local" }),
    ).toBeNull();
  });

  it("returns config with decrypted sync_token and parsed user_mappings", () => {
    const result = normalizeJellyfinSyncConfig({
      website_url: "http://jf.local/",
      sync_token: "abc123",
      user_mappings: [
        { jellyfin_user_id: "jf-user-1", hously_user_id: 42 },
        { jellyfin_user_id: "", hously_user_id: 0 }, // filtered out
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.sync_token).toBe("abc123");
    expect(result!.website_url).toBe("http://jf.local"); // trailing slash stripped
    expect(result!.user_mappings).toHaveLength(1);
    expect(result!.user_mappings[0]).toEqual({
      jellyfin_user_id: "jf-user-1",
      hously_user_id: 42,
    });
  });

  it("works without user_mappings", () => {
    const result = normalizeJellyfinSyncConfig({
      sync_token: "abc123",
      website_url: "http://jf.local",
    });
    expect(result).not.toBeNull();
    expect(result!.user_mappings).toHaveLength(0);
  });
});
