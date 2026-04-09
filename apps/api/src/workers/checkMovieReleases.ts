import { MAX_LIBRARY_GRAB_ATTEMPTS } from "@hously/api/constants/libraryGrab";
import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { refreshLibraryMovieDigitalDate } from "@hously/api/services/libraryTmdbRefresh";
import { notifyAdminsLibraryGrabSkipped } from "@hously/api/workers/notifyLibraryGrabSkipped";

export async function checkMovieReleases(): Promise<void> {
  const movies = await prisma.libraryMedia.findMany({
    where: {
      type: "movie",
      status: "wanted",
      // Never retry if a file or a completed download already exists
      files: { none: {} },
      downloadHistories: {
        none: { completedAt: { not: null }, failed: false },
      },
    },
    select: {
      id: true,
      title: true,
      year: true,
      qualityProfileId: true,
      searchAttempts: true,
      digitalReleaseDate: true,
    },
  });

  const now = new Date();

  for (const m of movies) {
    try {
      if (m.searchAttempts >= MAX_LIBRARY_GRAB_ATTEMPTS) continue;

      let digital = m.digitalReleaseDate;
      if (!digital) {
        try {
          digital = await refreshLibraryMovieDigitalDate(m.id);
        } catch (e) {
          console.warn(
            `[checkMovieReleases] TMDB refresh failed for media ${m.id}:`,
            e,
          );
          continue;
        }
        if (!digital) continue;
      }

      if (digital > now) continue;

      const y = m.year ? ` ${m.year}` : "";
      const result = await searchAndGrab({
        mediaId: m.id,
        searchQuery: `${m.title}${y}`,
        qualityProfileId: m.qualityProfileId,
      });

      if (result.grabbed) continue;

      const next = m.searchAttempts + 1;
      const skipped = next >= MAX_LIBRARY_GRAB_ATTEMPTS;
      await prisma.libraryMedia.update({
        where: { id: m.id },
        data: { searchAttempts: next, ...(skipped ? { status: "skipped" } : {}) },
      });

      if (skipped) {
        await notifyAdminsLibraryGrabSkipped(
          `Movie "${m.title}" (${m.id}) exceeded ${MAX_LIBRARY_GRAB_ATTEMPTS} failed grab attempts (${result.reason}). Status set to skipped.`,
        );
      }
    } catch (e) {
      console.warn(`[checkMovieReleases] Failed for movie ${m.id}:`, e);
    }
  }
}
