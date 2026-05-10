import { describe, expect, it } from "bun:test";
import {
  defaultMoviesDownloadsPath,
  movieFilenameLikelyMatches,
  normalizeComparableName,
  seriesPathMatchesTitle,
} from "../src/utils/medias/downloadFilenameMatch";

describe("defaultMoviesDownloadsPath", () => {
  it("derives Downloads/movies next to Movies root", () => {
    expect(defaultMoviesDownloadsPath("/mnt/storage/Movies")).toBe(
      "/mnt/storage/Downloads/movies",
    );
  });

  it("returns null when library path missing", () => {
    expect(defaultMoviesDownloadsPath(null)).toBe(null);
    expect(defaultMoviesDownloadsPath("   ")).toBe(null);
  });
});

describe("movieFilenameLikelyMatches", () => {
  it("matches typical release filenames with roman numeral sequel", () => {
    expect(
      movieFilenameLikelyMatches(
        "/dl/Men in Black II 2002 MULTi VF2 1080p BluRay HDlight x264-XRS.mkv",
        "Men in Black II",
        2002,
      ),
    ).toBe(true);
  });

  it("requires year coherence when release states a conflicting year", () => {
    expect(
      movieFilenameLikelyMatches(
        "/dl/Men in Black II 2002 1080p.mkv",
        "Men in Black II",
        2020,
      ),
    ).toBe(false);
  });

  it("still matches when TMDB year is set but filename omits calendar year", () => {
    expect(
      movieFilenameLikelyMatches(
        "/dl/Men.in.Black.II.MULTi.VF2.1080p.mkv",
        "Men in Black II",
        2002,
      ),
    ).toBe(true);
  });

  it("does not cross-match unrelated titles", () => {
    expect(
      movieFilenameLikelyMatches(
        "/dl/Alien.1979.MULTi.AC3.Bluray.1080p.mkv",
        "Prometheus",
        2012,
      ),
    ).toBe(false);
  });
});

describe("normalizeComparableName + seriesPathMatchesTitle", () => {
  it("preserves hyphen as word break for hyphenated franchises", () => {
    expect(normalizeComparableName("Spider-Man.2004.1080p")).toContain(
      "spider-man",
    );
  });

  it("requires show title tokens in filepath", () => {
    expect(
      seriesPathMatchesTitle(
        "/dl/Breaking.Bad.S05E01.1080p.BluRay.mkv",
        "Breaking Bad",
      ),
    ).toBe(true);
    expect(
      seriesPathMatchesTitle("/dl/The.Wire.S01E01.mkv", "Breaking Bad"),
    ).toBe(false);
  });
});
