import { prisma } from "@hously/api/db";
import { getActiveIndexerManager } from "@hously/api/services/indexerManager/factory";
import type { NormalizedRelease } from "@hously/api/services/indexerManager/types";
import { grabRelease } from "@hously/api/services/mediaGrabber";
import {
  normalizeTitleForMatch,
  parseReleaseSeasonEpisode,
  parseReleaseTitle,
} from "@hously/api/utils/medias/filenameParser";
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import {
  APP_DISPLAY_TIMEZONE,
  localDateYmd,
  toUtcMidnightDate,
} from "@hously/shared/utils/date";

export async function pollIndexerRss(): Promise<void> {
  const adapter = await getActiveIndexerManager();
  if (!adapter) return;

  const integration = await prisma.integration.findFirst({
    where: { type: adapter.name, enabled: true },
  });
  if (!integration) return;

  const rawConfig = integration.config as Record<string, unknown>;
  const rssIndexers = Array.isArray(rawConfig?.rss_indexers)
    ? (rawConfig.rss_indexers as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  if (!rssIndexers.length) return;

  console.log(
    `[pollIndexerRss] Polling ${adapter.name} RSS for indexers: ${rssIndexers.join(", ")}`,
  );

  const releases = await adapter.fetchRss(rssIndexers);
  if (!releases.length) {
    console.log("[pollIndexerRss] No releases in RSS feed");
    return;
  }

  const todayCutoff = toUtcMidnightDate(localDateYmd(APP_DISPLAY_TIMEZONE));
  const nowMinusGrace = new Date(Date.now() - 60 * 60 * 1000);
  const episodeCutoff = toUtcMidnightDate(
    localDateYmd(APP_DISPLAY_TIMEZONE, nowMinusGrace),
  );

  const [wantedMovies, wantedEpisodes] = await Promise.all([
    prisma.libraryMedia.findMany({
      where: {
        type: "movie",
        status: "wanted",
        monitored: true,
        files: { none: {} },
        digitalReleaseDate: { lte: todayCutoff },
      },
      select: { id: true, title: true, year: true, qualityProfileId: true },
    }),
    prisma.libraryEpisode.findMany({
      where: {
        status: "wanted",
        monitored: true,
        airDate: { lte: episodeCutoff },
        files: { none: {} },
        media: { type: "show", monitored: true },
      },
      include: {
        media: {
          select: { id: true, title: true, qualityProfileId: true },
        },
      },
    }),
  ]);

  const normalizedMovies = wantedMovies.map((m) => ({
    ...m,
    normalizedTitle: normalizeTitleForMatch(m.title),
  }));
  const normalizedEpisodes = wantedEpisodes.map((ep) => ({
    ...ep,
    normalizedTitle: normalizeTitleForMatch(ep.media.title),
  }));

  // Collect all matching RSS releases per episode/movie before scoring.
  // Multiple releases across indexers may match the same item.
  const episodeCandidates = new Map<
    number,
    {
      match: (typeof normalizedEpisodes)[number];
      releases: NormalizedRelease[];
    }
  >();
  const movieCandidates = new Map<
    number,
    {
      match: (typeof normalizedMovies)[number];
      releases: NormalizedRelease[];
    }
  >();

  for (const release of releases) {
    const parsed = extractTitleFromRelease(release.title);
    if (!parsed) continue;

    if (parsed.season !== null && parsed.episode === null) {
      // Season pack — skip, we don't grab whole seasons via RSS
      continue;
    }

    if (parsed.season !== null && parsed.episode !== null) {
      const match = normalizedEpisodes.find(
        (ep) =>
          ep.normalizedTitle === parsed.normalizedTitle &&
          ep.season === parsed.season &&
          ep.episode === parsed.episode,
      );
      if (match) {
        const entry = episodeCandidates.get(match.id);
        if (entry) {
          entry.releases.push(release);
        } else {
          episodeCandidates.set(match.id, { match, releases: [release] });
        }
      }
    } else {
      const match = normalizedMovies.find((m) => {
        if (m.normalizedTitle !== parsed.normalizedTitle) return false;
        if (parsed.year !== null && m.year !== null)
          return m.year === parsed.year;
        return true;
      });
      if (match) {
        const entry = movieCandidates.get(match.id);
        if (entry) {
          entry.releases.push(release);
        } else {
          movieCandidates.set(match.id, { match, releases: [release] });
        }
      }
    }
  }

  // Batch-load all quality profiles needed across both episodes and movies.
  const profileIds = new Set<number>();
  for (const { match } of episodeCandidates.values()) {
    if (match.media.qualityProfileId != null)
      profileIds.add(match.media.qualityProfileId);
  }
  for (const { match } of movieCandidates.values()) {
    if (match.qualityProfileId != null) profileIds.add(match.qualityProfileId);
  }

  const profiles = await prisma.qualityProfile.findMany({
    where: { id: { in: [...profileIds] } },
  });
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  let grabbed = 0;

  for (const { match, releases: candidates } of episodeCandidates.values()) {
    const profile = match.media.qualityProfileId
      ? profileMap.get(match.media.qualityProfileId)
      : null;
    const profileInput = profile ? toScoreInput(profile) : null;

    const best = pickBest(candidates, profileInput);
    if (!best) {
      console.log(
        `[pollIndexerRss] No qualifying release for ${match.media.title} S${match.season}E${match.episode} (${candidates.length} candidate(s) rejected by profile)`,
      );
      continue;
    }

    console.log(
      `[pollIndexerRss] Match: "${best.release.title}" → ${match.media.title} S${match.season}E${match.episode} (score: ${best.score})`,
    );

    grabRelease({
      mediaId: match.media.id,
      episodeId: match.id,
      downloadUrl: best.downloadUrl,
      releaseTitle: best.release.title,
      indexer: best.release.indexer,
    }).catch((e) =>
      console.warn(`[pollIndexerRss] grab failed for episode ${match.id}:`, e),
    );

    grabbed++;
  }

  for (const { match, releases: candidates } of movieCandidates.values()) {
    const profile = match.qualityProfileId
      ? profileMap.get(match.qualityProfileId)
      : null;
    const profileInput = profile ? toScoreInput(profile) : null;

    const best = pickBest(candidates, profileInput);
    if (!best) {
      console.log(
        `[pollIndexerRss] No qualifying release for ${match.title} (${match.year}) (${candidates.length} candidate(s) rejected by profile)`,
      );
      continue;
    }

    console.log(
      `[pollIndexerRss] Match: "${best.release.title}" → ${match.title} (${match.year}) (score: ${best.score})`,
    );

    grabRelease({
      mediaId: match.id,
      downloadUrl: best.downloadUrl,
      releaseTitle: best.release.title,
      indexer: best.release.indexer,
    }).catch((e) =>
      console.warn(`[pollIndexerRss] grab failed for movie ${match.id}:`, e),
    );

    grabbed++;
  }

  console.log(
    `[pollIndexerRss] Triggered ${grabbed} grab(s) from ${releases.length} RSS release(s)`,
  );
}

function toScoreInput(p: {
  minResolution: number;
  cutoffResolution: number | null;
  preferredSources: string[];
  preferredCodecs: string[];
  preferredLanguages: string[] | null;
  prioritizedTrackers: string[] | null;
  preferTrackerOverQuality: boolean | null;
  maxSizeGb: number | null;
  requireHdr: boolean;
  preferHdr: boolean;
}): QualityProfileScoreInput {
  return {
    minResolution: p.minResolution,
    cutoffResolution: p.cutoffResolution,
    preferredSources: p.preferredSources,
    preferredCodecs: p.preferredCodecs,
    preferredLanguages: p.preferredLanguages ?? [],
    prioritizedTrackers: p.prioritizedTrackers ?? [],
    preferTrackerOverQuality: p.preferTrackerOverQuality ?? false,
    maxSizeGb: p.maxSizeGb,
    requireHdr: p.requireHdr,
    preferHdr: p.preferHdr,
  };
}

function pickBest(
  candidates: NormalizedRelease[],
  profile: QualityProfileScoreInput | null,
): { release: NormalizedRelease; downloadUrl: string; score: number } | null {
  const scored: {
    release: NormalizedRelease;
    downloadUrl: string;
    score: number;
  }[] = [];

  for (const release of candidates) {
    const downloadUrl = release.magnetUrl ?? release.downloadUrl;
    if (!downloadUrl) continue;

    if (profile) {
      const parsed = parseReleaseTitle(release.title);
      const result = scoreRelease(
        parsed,
        profile,
        release.sizeBytes,
        release.title,
        release.indexer,
        release.freeleech,
      );
      if (Array.isArray(result)) continue; // rejected by profile
      scored.push({ release, downloadUrl, score: result });
    } else {
      scored.push({ release, downloadUrl, score: 0 });
    }
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!;
}

function extractTitleFromRelease(title: string): {
  normalizedTitle: string;
  season: number | null;
  episode: number | null;
  year: number | null;
} | null {
  if (!title) return null;

  const spaced = title.replace(/[._]/g, " ");
  const seInfo = parseReleaseSeasonEpisode(title);

  if (seInfo) {
    const seMatch = spaced.match(/S\d{1,2}E?\d{0,3}|S\d{1,2}$/i);
    const rawTitle =
      seMatch?.index !== undefined
        ? spaced.slice(0, seMatch.index).trim()
        : spaced;
    return {
      normalizedTitle: normalizeTitleForMatch(rawTitle),
      season: seInfo.season,
      episode: seInfo.episode,
      year: null,
    };
  }

  const yearMatch = spaced.match(/\b(19|20)\d{2}\b/);

  // Quality boundary markers present even without a year token
  const qualityBoundary = spaced.match(
    /\b(?:BluRay|BDRip|BRRip|WEB[-. ]?DL|WEBRip|WEB|HDRip|HDTV|DVDRip|DVD|4K|2160p|1080p|720p|480p|REMUX|PROPER|REPACK|EXTENDED|THEATRICAL|MULTI|VFF|VF2|VFQ|VFI|FRENCH|ENGLISH|MULTi)\b/i,
  );

  const boundary =
    yearMatch?.index !== undefined
      ? yearMatch.index
      : qualityBoundary?.index !== undefined
        ? qualityBoundary.index
        : spaced.length;

  const rawTitle = spaced.slice(0, boundary).trim();
  if (!rawTitle) return null;

  return {
    normalizedTitle: normalizeTitleForMatch(rawTitle),
    season: null,
    episode: null,
    year: yearMatch ? parseInt(yearMatch[0], 10) : null,
  };
}
