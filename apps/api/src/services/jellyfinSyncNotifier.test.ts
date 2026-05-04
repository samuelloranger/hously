import { describe, it, expect } from "bun:test";
import { buildSyncPayload } from "./jellyfinSyncNotifier";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

describe("buildSyncPayload", () => {
  const mappings: JellyfinUserMapping[] = [
    { jellyfin_user_id: "jf-abc", hously_user_id: 3 },
  ];

  it("returns payload when hously user is mapped", () => {
    const result = buildSyncPayload(
      { houslyUserId: 3, tmdbId: 100, mediaType: "movie", action: "added" },
      mappings,
    );
    expect(result).toEqual({
      jellyfin_user_id: "jf-abc",
      tmdb_id: 100,
      media_type: "movie",
      action: "added",
    });
  });

  it("returns null when hously user has no mapping", () => {
    const result = buildSyncPayload(
      { houslyUserId: 99, tmdbId: 100, mediaType: "movie", action: "added" },
      mappings,
    );
    expect(result).toBeNull();
  });
});
