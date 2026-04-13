import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";

function episodeSearchQuery(
  showTitle: string,
  season: number,
  episode: number,
): string {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `${showTitle} S${s}E${e}`;
}

function seasonPackSearchQuery(showTitle: string, season: number): string {
  const s = String(season).padStart(2, "0");
  return `${showTitle} S${s}`;
}

export async function checkEpisodeReleases(): Promise<void> {
  const now = new Date();
  // Give indexers 60 min after air time before searching.
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const episodes = await prisma.libraryEpisode.findMany({
    where: {
      status: "wanted",
      monitored: true,
      airDate: { lte: cutoff },
      files: { none: {} },
      media: { type: "show", monitored: true },
    },
    include: {
      media: {
        select: {
          id: true,
          title: true,
          qualityProfileId: true,
        },
      },
    },
  });

  // Group episodes by mediaId:season to detect pack-eligible seasons.
  const seasonGroups = new Map<string, (typeof episodes)[number][]>();
  for (const ep of episodes) {
    const key = `${ep.mediaId}:${ep.season}`;
    const list = seasonGroups.get(key) ?? [];
    list.push(ep);
    seasonGroups.set(key, list);
  }

  // A season is pack-eligible when every monitored episode is in the
  // "wanted + aired + no files" set — i.e. nothing has been grabbed yet.
  const packEligibleIds = new Set<number>();

  for (const [key, groupEps] of seasonGroups) {
    const [mediaIdStr, seasonStr] = key.split(":");
    const mediaId = Number(mediaIdStr);
    const season = Number(seasonStr);

    const totalMonitored = await prisma.libraryEpisode.count({
      where: { mediaId, season, monitored: true },
    });

    if (groupEps.length === totalMonitored) {
      for (const ep of groupEps) packEligibleIds.add(ep.id);
    }
  }

  // Process season pack searches for eligible seasons.
  for (const [key, groupEps] of seasonGroups) {
    if (!groupEps.every((ep) => packEligibleIds.has(ep.id))) continue;

    const [mediaIdStr, seasonStr] = key.split(":");
    const mediaId = Number(mediaIdStr);
    const season = Number(seasonStr);
    const media = groupEps[0].media;

    try {
      const result = await searchAndGrab({
        mediaId,
        searchQuery: seasonPackSearchQuery(media.title, season),
        qualityProfileId: media.qualityProfileId,
      });

      if (result.grabbed) continue;

      // Increment searchAttempts on all episodes in the pack.
      for (const ep of groupEps) {
        await prisma.libraryEpisode.update({
          where: { id: ep.id },
          data: { searchAttempts: ep.searchAttempts + 1 },
        });
      }
    } catch (e) {
      console.warn(
        `[checkEpisodeReleases] Season pack failed for media ${mediaId} S${season}:`,
        e,
      );
    }
  }

  // Process individual episode searches for non-pack-eligible episodes.
  const individualEpisodes = episodes.filter(
    (ep) => !packEligibleIds.has(ep.id),
  );

  for (const ep of individualEpisodes) {
    try {
      const result = await searchAndGrab({
        mediaId: ep.media.id,
        episodeId: ep.id,
        searchQuery: episodeSearchQuery(ep.media.title, ep.season, ep.episode),
        qualityProfileId: ep.media.qualityProfileId,
      });

      if (result.grabbed) continue;

      await prisma.libraryEpisode.update({
        where: { id: ep.id },
        data: { searchAttempts: ep.searchAttempts + 1 },
      });
    } catch (e) {
      console.warn(`[checkEpisodeReleases] Failed for episode ${ep.id}:`, e);
    }
  }
}
