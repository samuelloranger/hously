import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { refreshLibraryMovieDigitalDate } from "@hously/api/services/libraryTmdbRefresh";
import { notifyAdminsLibraryGrabSkipped } from "@hously/api/workers/notifyLibraryGrabSkipped";

// Give up searching after this many days past the digital release date.
const MOVIE_GRAB_WINDOW_DAYS = 30;

export async function checkMovieReleases(): Promise<void> {
  const now = new Date();
  const windowCutoff = new Date(
    now.getTime() - MOVIE_GRAB_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const movies = await prisma.libraryMedia.findMany({
    where: {
      type: "movie",
      status: "wanted",
      files: { none: {} },
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

  for (const m of movies) {
    try {
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

      // Not yet released digitally — nothing to search.
      if (digital > now) continue;

      // Past the grab window — give up and notify.
      if (digital < windowCutoff) {
        await prisma.libraryMedia.update({
          where: { id: m.id },
          data: { status: "skipped" },
        });
        await notifyAdminsLibraryGrabSkipped(
          `Movie "${m.title}" (${m.id}) aged out of the ${MOVIE_GRAB_WINDOW_DAYS}-day search window without a successful grab. Status set to skipped.`,
        );
        continue;
      }

      const y = m.year ? ` ${m.year}` : "";
      const result = await searchAndGrab({
        mediaId: m.id,
        searchQuery: `${m.title}${y}`,
        qualityProfileId: m.qualityProfileId,
      });

      if (result.grabbed) continue;

      await prisma.libraryMedia.update({
        where: { id: m.id },
        data: { searchAttempts: m.searchAttempts + 1 },
      });
    } catch (e) {
      console.warn(`[checkMovieReleases] Failed for movie ${m.id}:`, e);
    }
  }
}
