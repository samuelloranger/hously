import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { notifyAdminsLibraryGrabSkipped } from "@hously/api/workers/notifyLibraryGrabSkipped";

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
  // Only process episodes that aired in the past 5 days. Give indexers 60 min
  // after air time before searching, so skip anything aired less than an hour ago.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

  // Mark episodes that have aged out of the search window without being grabbed.
  const agedOut = await prisma.libraryEpisode.findMany({
    where: {
      status: "wanted",
      airDate: { lt: sevenDaysAgo },
      files: { none: {} },
      media: { type: "show" },
    },
    include: {
      media: { select: { title: true } },
    },
  });

  for (const ep of agedOut) {
    try {
      await prisma.libraryEpisode.update({
        where: { id: ep.id },
        data: { status: "skipped" },
      });
      await notifyAdminsLibraryGrabSkipped(
        `Episode "${ep.media.title}" S${ep.season}E${ep.episode} (${ep.id}) aged out of the 7-day search window without a successful grab. Status set to skipped.`,
      );
    } catch (e) {
      console.warn(
        `[checkEpisodeReleases] Failed to age out episode ${ep.id}:`,
        e,
      );
    }
  }

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
