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

export async function checkEpisodeReleases(): Promise<void> {
  const now = new Date();
  // Only process episodes that aired in the past 7 days. Give indexers 60 min
  // after air time before searching, so skip anything aired less than an hour ago.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const episodes = await prisma.libraryEpisode.findMany({
    where: {
      status: "wanted",
      airDate: { gte: sevenDaysAgo, lte: cutoff },
      files: { none: {} },
      media: { type: "show" },
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

  for (const ep of episodes) {
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
