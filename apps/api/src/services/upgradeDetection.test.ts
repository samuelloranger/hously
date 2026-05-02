import { describe, it, expect } from "bun:test";
import { filesFailProfile } from "./upgradeDetection";
import type { QualityProfileScoreInput } from "@hously/api/utils/medias/releaseScorer";

const profile: QualityProfileScoreInput = {
  minResolution: 1080,
  cutoffResolution: null,
  preferredSources: [],
  preferredCodecs: [],
  preferredLanguages: [],
  prioritizedTrackers: [],
  preferTrackerOverQuality: false,
  maxSizeGb: null,
  requireHdr: false,
  preferHdr: false,
};

describe("filesFailProfile", () => {
  it("returns true when resolution is below minResolution", () => {
    const files = [
      {
        resolution: 720,
        source: "WEB-DL",
        videoCodec: "x264",
        hdrFormat: null,
        sizeBytes: null as bigint | null,
        languageTags: [] as string[],
      },
    ];
    expect(filesFailProfile(files, profile)).toBe(true);
  });

  it("returns false when resolution meets minResolution", () => {
    const files = [
      {
        resolution: 1080,
        source: "BluRay",
        videoCodec: "x265",
        hdrFormat: null,
        sizeBytes: null as bigint | null,
        languageTags: [] as string[],
      },
    ];
    expect(filesFailProfile(files, profile)).toBe(false);
  });

  it("returns true when resolution is null (unknown quality)", () => {
    const files = [
      {
        resolution: null,
        source: null,
        videoCodec: null,
        hdrFormat: null,
        sizeBytes: null as bigint | null,
        languageTags: [] as string[],
      },
    ];
    expect(filesFailProfile(files, profile)).toBe(true);
  });

  it("returns false for empty files (nothing to upgrade)", () => {
    expect(filesFailProfile([], profile)).toBe(false);
  });

  it("requires HDR when profile.requireHdr is true", () => {
    const hdrProfile: QualityProfileScoreInput = {
      ...profile,
      requireHdr: true,
    };
    const files = [
      {
        resolution: 1080,
        source: "BluRay",
        videoCodec: "x265",
        hdrFormat: null,
        sizeBytes: null as bigint | null,
        languageTags: [] as string[],
      },
    ];
    expect(filesFailProfile(files, hdrProfile)).toBe(true);
  });
});
