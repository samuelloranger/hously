import { prisma } from "@hously/api/db";
import { getActiveIndexerManager } from "@hously/api/services/indexerManager/factory";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import {
  normalizeTitleForMatch,
  parseReleaseSeasonEpisode,
} from "@hously/api/utils/medias/filenameParser";
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

  const triggeredMediaIds = new Set<number>();
  const triggeredEpisodeIds = new Set<number>();

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
      if (match && !triggeredEpisodeIds.has(match.id)) {
        triggeredEpisodeIds.add(match.id);
        console.log(
          `[pollIndexerRss] Match: "${release.title}" → ${match.media.title} S${match.season}E${match.episode}`,
        );
        searchAndGrab({
          mediaId: match.media.id,
          episodeId: match.id,
          searchQuery: `${match.media.title} S${String(match.season).padStart(2, "0")}E${String(match.episode).padStart(2, "0")}`,
          qualityProfileId: match.media.qualityProfileId,
        }).catch((e) =>
          console.warn(
            `[pollIndexerRss] grab failed for episode ${match.id}:`,
            e,
          ),
        );
      }
    } else {
      const match = normalizedMovies.find((m) => {
        if (m.normalizedTitle !== parsed.normalizedTitle) return false;
        if (parsed.year !== null && m.year !== null)
          return m.year === parsed.year;
        return true;
      });
      if (match && !triggeredMediaIds.has(match.id)) {
        triggeredMediaIds.add(match.id);
        console.log(
          `[pollIndexerRss] Match: "${release.title}" → ${match.title} (${match.year})`,
        );
        const yearSuffix = match.year ? ` ${match.year}` : "";
        searchAndGrab({
          mediaId: match.id,
          searchQuery: `${match.title}${yearSuffix}`,
          qualityProfileId: match.qualityProfileId,
        }).catch((e) =>
          console.warn(
            `[pollIndexerRss] grab failed for movie ${match.id}:`,
            e,
          ),
        );
      }
    }
  }

  const total = triggeredMediaIds.size + triggeredEpisodeIds.size;
  console.log(
    `[pollIndexerRss] Triggered ${total} grab(s) from ${releases.length} RSS release(s)`,
  );
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
