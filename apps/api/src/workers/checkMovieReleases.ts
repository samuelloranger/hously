import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { refreshLibraryMovieDigitalDate } from "@hously/api/services/libraryTmdbRefresh";

export async function checkMovieReleases(): Promise<void> {
  const now = new Date();

  const movies = await prisma.libraryMedia.findMany({
    where: {
      type: "movie",
      status: "wanted",
      monitored: true,
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
