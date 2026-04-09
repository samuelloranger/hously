import { MAX_LIBRARY_GRAB_ATTEMPTS } from "@hously/api/constants/libraryGrab";
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
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const episodes = await prisma.libraryEpisode.findMany({
    where: {
      status: "wanted",
      airDate: { gte: fiveDaysAgo, lte: cutoff },
      // Never retry if a MediaFile already exists for this episode
      files: { none: {} },
      media: {
        type: "show",
        // Never retry if the show already has a completed (non-failed) download
        downloadHistories: {
          none: { completedAt: { not: null }, failed: false },
        },
      },
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
      if (ep.searchAttempts >= MAX_LIBRARY_GRAB_ATTEMPTS) continue;

      const result = await searchAndGrab({
        mediaId: ep.media.id,
        episodeId: ep.id,
        searchQuery: episodeSearchQuery(ep.media.title, ep.season, ep.episode),
        qualityProfileId: ep.media.qualityProfileId,
      });

      if (result.grabbed) continue;

      const next = ep.searchAttempts + 1;
      const skipped = next >= MAX_LIBRARY_GRAB_ATTEMPTS;
      await prisma.libraryEpisode.update({
        where: { id: ep.id },
        data: { searchAttempts: next, ...(skipped ? { status: "skipped" } : {}) },
      });

      if (skipped) {
        await notifyAdminsLibraryGrabSkipped(
          `Episode "${ep.media.title}" S${ep.season}E${ep.episode} (${ep.id}) exceeded ${MAX_LIBRARY_GRAB_ATTEMPTS} failed grab attempts (${result.reason}). Status set to skipped.`,
        );
      }
    } catch (e) {
      console.warn(`[checkEpisodeReleases] Failed for episode ${ep.id}:`, e);
    }
  }
}
