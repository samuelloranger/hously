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

function parsed(overrides: Partial<ParsedRelease> = {}): ParsedRelease {
  return {
    resolution: 1080,
    source: "BluRay",
    codec: "x265",
    hdr: null,
    audio: null,
    group: null,
    streaming: null,
    isSample: false,
    isProper: false,
    ...overrides,
  };
}

describe("scoreRelease — hard rejections", () => {
  test("rejects below min resolution", () => {
    expect(scoreRelease(parsed({ resolution: 720 }), baseProfile, null)).toBeNull();
  });

  test("rejects null resolution", () => {
    expect(scoreRelease(parsed({ resolution: null }), baseProfile, null)).toBeNull();
  });

  test("rejects sample", () => {
    expect(scoreRelease(parsed({ isSample: true }), baseProfile, null)).toBeNull();
  });

  test("rejects when requireHdr and no hdr", () => {
    expect(
      scoreRelease(parsed({ hdr: null }), { ...baseProfile, requireHdr: true }, null),
    ).toBeNull();
  });

  test("rejects over max size", () => {
    expect(
      scoreRelease(parsed(), { ...baseProfile, maxSizeGb: 5 }, 6e9),
    ).toBeNull();
  });

  test("rejects above cutoff resolution", () => {
    expect(
      scoreRelease(
        parsed({ resolution: 2160 }),
        { ...baseProfile, cutoffResolution: 1080 },
        null,
      ),
    ).toBeNull();
  });
});

describe("scoreRelease — resolution tier bonus", () => {
  test("4K scores higher than 1080p with same profile", () => {
    const s1080 = scoreRelease(parsed({ resolution: 1080 }), baseProfile, null)!;
    const s4k = scoreRelease(parsed({ resolution: 2160 }), baseProfile, null)!;
    expect(s4k).toBeGreaterThan(s1080);
  });

  test("cutoff at 1080 rejects 2160 but accepts 1080", () => {
    const capped = { ...baseProfile, cutoffResolution: 1080 };
    expect(scoreRelease(parsed({ resolution: 2160 }), capped, null)).toBeNull();
    expect(scoreRelease(parsed({ resolution: 1080 }), capped, null)).not.toBeNull();
  });
});

describe("scoreRelease — source preferences", () => {
  test("BluRay outscores WEBRip with BluRay first in prefs", () => {
    const bluray = scoreRelease(parsed({ source: "BluRay" }), baseProfile, null)!;
    const webrip = scoreRelease(parsed({ source: "WEBRip" }), baseProfile, null)!;
    expect(bluray).toBeGreaterThan(webrip);
  });

  test("HDLight matches BluRay preference (French re-encode alias)", () => {
    const hdlight = scoreRelease(parsed({ source: "HDLight" }), baseProfile, null);
    // HDLight aliases to BluRay — should get the same source score as BluRay
    const bluray = scoreRelease(parsed({ source: "BluRay" }), baseProfile, null);
    expect(hdlight).not.toBeNull();
    expect(hdlight).toEqual(bluray);
  });

  test("HDRip matches WEBRip preference", () => {
    const prof = { ...baseProfile, preferredSources: ["WEBRip"] };
    const hdrip = scoreRelease(parsed({ source: "HDRip" }), prof, null);
    const webrip = scoreRelease(parsed({ source: "WEBRip" }), prof, null);
    expect(hdrip).not.toBeNull();
    expect(hdrip).toEqual(webrip);
  });

  test("REMUX matches BluRay preference", () => {
    const remux = scoreRelease(parsed({ source: "REMUX" }), baseProfile, null)!;
    const bluray = scoreRelease(parsed({ source: "BluRay" }), baseProfile, null)!;
    expect(remux).toEqual(bluray);
  });
});

describe("scoreRelease — PROPER/REPACK bonus", () => {
  test("PROPER scores +150 over identical non-PROPER", () => {
    const base = scoreRelease(parsed({ isProper: false }), baseProfile, null)!;
    const proper = scoreRelease(parsed({ isProper: true }), baseProfile, null)!;
    expect(proper - base).toBe(150);
  });

  test("PROPER still rejected if below min resolution", () => {
    expect(
      scoreRelease(parsed({ resolution: 720, isProper: true }), baseProfile, null),
    ).toBeNull();
  });

  test("PROPER still rejected if isSample", () => {
    expect(
      scoreRelease(parsed({ isSample: true, isProper: true }), baseProfile, null),
    ).toBeNull();
  });
});

describe("scoreRelease — HDR preferences", () => {
  test("preferHdr adds bonus when hdr present", () => {
    const no = scoreRelease(parsed({ hdr: null }), { ...baseProfile, preferHdr: true }, null)!;
    const yes = scoreRelease(parsed({ hdr: "HDR10" }), { ...baseProfile, preferHdr: true }, null)!;
    expect(yes).toBeGreaterThan(no);
  });

  test("requireHdr accepts release with hdr", () => {
    expect(
      scoreRelease(parsed({ hdr: "DV" }), { ...baseProfile, requireHdr: true }, null),
    ).not.toBeNull();
  });
});

describe("scoreRelease — codec preferences", () => {
  test("x265 outscores x264 when x265 is first preferred codec", () => {
    const hevc = scoreRelease(parsed({ codec: "x265" }), baseProfile, null)!;
    const avc = scoreRelease(parsed({ codec: "x264" }), baseProfile, null)!;
    expect(hevc).toBeGreaterThan(avc);
  });

  test("profile pref HEVC matches parsed codec x265 (alias)", () => {
    const hevcProfile = { ...baseProfile, preferredCodecs: ["HEVC", "AV1"] };
    const score = scoreRelease(parsed({ codec: "x265" }), hevcProfile, null)!;
    const noCodec = scoreRelease(parsed({ codec: null }), hevcProfile, null)!;
    expect(score).toBeGreaterThan(noCodec);
  });

  test("profile pref AVC matches parsed codec x264 (alias)", () => {
    const avcProfile = { ...baseProfile, preferredCodecs: ["AVC"] };
    const score = scoreRelease(parsed({ codec: "x264" }), avcProfile, null)!;
    const noCodec = scoreRelease(parsed({ codec: null }), avcProfile, null)!;
    expect(score).toBeGreaterThan(noCodec);
  });
});

describe("scoreRelease — large file penalty", () => {
  test("file >10GB is penalised when no maxSizeGb set", () => {
    const small = scoreRelease(parsed(), baseProfile, 5e9)!;
    const large = scoreRelease(parsed(), baseProfile, 50e9)!;
    expect(small).toBeGreaterThan(large);
  });
});

describe("scoreRelease — language hard filter", () => {
  test("rejects release with no matching language when languages are set", () => {
    const prof = { ...baseProfile, preferredLanguages: ["VF2", "VFQ"] };
    expect(scoreRelease(parsed(), prof, null, "Movie.VFF.1080p.BluRay.x265")).toBeNull();
    expect(scoreRelease(parsed(), prof, null, "Movie.1080p.BluRay.x265")).toBeNull();
  });

  test("accepts release whose language matches a preferred entry", () => {
    const prof = { ...baseProfile, preferredLanguages: ["VF2", "VFQ"] };
    expect(scoreRelease(parsed(), prof, null, "Movie.MULTi.VF2.1080p.BluRay.x265")).not.toBeNull();
    expect(scoreRelease(parsed(), prof, null, "Movie.MULTi.VFQ.1080p.BluRay.x265")).not.toBeNull();
  });

  test("VFF is rejected when only VF2 and VFQ are preferred", () => {
    const prof = { ...baseProfile, preferredLanguages: ["VF2", "VFQ"] };
    expect(scoreRelease(parsed(), prof, null, "Movie.MULTi.VFF.1080p.BluRay.x265")).toBeNull();
  });

  test("no preferred languages — all releases pass the language check", () => {
    expect(scoreRelease(parsed(), baseProfile, null, "Movie.VFF.1080p.BluRay.x265")).not.toBeNull();
    expect(scoreRelease(parsed(), baseProfile, null, "Movie.1080p.BluRay.x265")).not.toBeNull();
  });

  test("VFF ranks higher than FRENCH when both pass [VFF, fr] filter", () => {
    const prof = { ...baseProfile, preferredLanguages: ["VFF", "fr"] };
    const vff = scoreRelease(parsed(), prof, null, "Movie.VFF.1080p.BluRay.x265")!;
    const french = scoreRelease(parsed(), prof, null, "Movie.FRENCH.1080p.BluRay.x265")!;
    expect(vff).toBeGreaterThan(french);
  });

  test("generic fr rejects VFF release (VFF is a specific variant, not generic French)", () => {
    const frOnly = { ...baseProfile, preferredLanguages: ["fr"] };
    expect(scoreRelease(parsed(), frOnly, null, "Movie.VFF.1080p.BluRay.x265")).toBeNull();
  });

  test("generic fr accepts FRENCH-labelled release", () => {
    const frOnly = { ...baseProfile, preferredLanguages: ["fr"] };
    expect(scoreRelease(parsed(), frOnly, null, "Movie.FRENCH.1080p.BluRay.x265")).not.toBeNull();
  });

  test("VFQ preference rejects VFF release", () => {
    const vfqOnly = { ...baseProfile, preferredLanguages: ["VFQ"] };
    expect(scoreRelease(parsed(), vfqOnly, null, "Movie.VFF.1080p.BluRay.x265")).toBeNull();
  });

  test("English preference rejects unlabelled release", () => {
    const enFirst = { ...baseProfile, preferredLanguages: ["en"] };
    expect(scoreRelease(parsed(), enFirst, null, "Movie.1080p.BluRay.x265")).toBeNull();
    expect(scoreRelease(parsed(), enFirst, null, "Movie.1080p.BluRay.ENG.DTS.x265")).not.toBeNull();
  });

  test("Italian preference matches ITA, rejects non-Italian", () => {
    const itFirst = { ...baseProfile, preferredLanguages: ["it"] };
    expect(scoreRelease(parsed(), itFirst, null, "Movie.1080p.BluRay.ita.eng.AC3.x265")).not.toBeNull();
    expect(scoreRelease(parsed(), itFirst, null, "Movie.1080p.BluRay.x265")).toBeNull();
  });
});
