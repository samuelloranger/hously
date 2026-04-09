import { describe, expect, test } from "bun:test";
import type { ParsedRelease } from "@hously/api/utils/medias/filenameParser";
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";

const baseProfile: QualityProfileScoreInput = {
  minResolution: 1080,
  cutoffResolution: null,
  preferredSources: ["BluRay", "WEB-DL"],
  preferredCodecs: ["x265", "x264"],
  preferredLanguages: [],
  maxSizeGb: null,
  requireHdr: false,
  preferHdr: false,
};

describe("scoreRelease", () => {
  test("rejects below min resolution", () => {
    const p: ParsedRelease = {
      resolution: 720,
      source: "BluRay",
      codec: "x264",
      hdr: null,
      audio: null,
      group: null,
      isSample: false,
    };
    expect(scoreRelease(p, baseProfile, null)).toBeNull();
  });

  test("rejects sample", () => {
    const p: ParsedRelease = {
      resolution: 1080,
      source: "BluRay",
      codec: "x264",
      hdr: null,
      audio: null,
      group: null,
      isSample: true,
    };
    expect(scoreRelease(p, baseProfile, null)).toBeNull();
  });

  test("rejects when require_hdr and no hdr", () => {
    const p: ParsedRelease = {
      resolution: 1080,
      source: "BluRay",
      codec: "x264",
      hdr: null,
      audio: null,
      group: null,
      isSample: false,
    };
    expect(
      scoreRelease(p, { ...baseProfile, requireHdr: true }, null),
    ).toBeNull();
  });

  test("rejects over max size", () => {
    const p: ParsedRelease = {
      resolution: 1080,
      source: "BluRay",
      codec: "x264",
      hdr: null,
      audio: null,
      group: null,
      isSample: false,
    };
    expect(scoreRelease(p, { ...baseProfile, maxSizeGb: 5 }, 6e9)).toBeNull();
  });

  test("scores tier bonus and preferences", () => {
    const p: ParsedRelease = {
      resolution: 2160,
      source: "BluRay",
      codec: "x265",
      hdr: "HDR10",
      audio: null,
      group: null,
      isSample: false,
    };
    const s = scoreRelease(p, { ...baseProfile, preferHdr: true }, 5e9);
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThan(1500);
  });

  test("rejects unknown resolution vs min 1080", () => {
    const p: ParsedRelease = {
      resolution: null,
      source: "BluRay",
      codec: "x264",
      hdr: null,
      audio: null,
      group: null,
      isSample: false,
    };
    expect(scoreRelease(p, baseProfile, null)).toBeNull();
  });
});
