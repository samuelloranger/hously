import { describe, it, expect } from "bun:test";
import { resolveSyncUser, validateSyncToken } from "./jellyfin";

describe("resolveSyncUser", () => {
  it("returns hously_user_id for a matching jellyfin_user_id", () => {
    const mappings = [
      { jellyfin_user_id: "jf-123", hously_user_id: 7 },
      { jellyfin_user_id: "jf-456", hously_user_id: 9 },
    ];
    expect(resolveSyncUser("jf-123", mappings)).toBe(7);
  });

  it("returns null when no match", () => {
    expect(resolveSyncUser("jf-999", [])).toBeNull();
  });
});

describe("validateSyncToken", () => {
  it("returns true when token matches", () => {
    expect(validateSyncToken("Bearer abc123", "abc123")).toBe(true);
  });

  it("returns false when token does not match", () => {
    expect(validateSyncToken("Bearer wrong", "abc123")).toBe(false);
  });

  it("returns false when header is missing", () => {
    expect(validateSyncToken(undefined, "abc123")).toBe(false);
  });

  it("returns false when header has wrong prefix", () => {
    expect(validateSyncToken("Token abc123", "abc123")).toBe(false);
  });
});
