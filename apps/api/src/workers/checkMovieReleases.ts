import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { refreshLibraryMovieDigitalDate } from "@hously/api/services/libraryTmdbRefresh";
import { MAX_CRON_GRAB_ATTEMPTS } from "@hously/api/constants/libraryGrab";
import { notifyAdminsLibraryGrabSkipped } from "@hously/api/workers/notifyLibraryGrabSkipped";
import {
  APP_DISPLAY_TIMEZONE,
  localDateYmd,
  toUtcMidnightDate,
} from "@hously/shared/utils/date";

export async function checkMovieReleases(): Promise<void> {
  // digitalReleaseDate is a DATE column — interpret it as a calendar day in
  // the app's display timezone (TZ env var → NY fallback), not UTC.
  const todayCutoff = toUtcMidnightDate(localDateYmd(APP_DISPLAY_TIMEZONE));

  const movies = await prisma.libraryMedia.findMany({
    where: {
      type: "movie",
      status: "wanted",
      monitored: true,
      files: { none: {} },
      searchAttempts: { lt: MAX_CRON_GRAB_ATTEMPTS },
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
      if (digital > todayCutoff) continue;

      const y = m.year ? ` ${m.year}` : "";
      const result = await searchAndGrab({
        mediaId: m.id,
        searchQuery: `${m.title}${y}`,
        qualityProfileId: m.qualityProfileId,
      });

      if (result.grabbed) continue;

      const next = m.searchAttempts + 1;
      const reachedCap = next >= MAX_CRON_GRAB_ATTEMPTS;
      await prisma.libraryMedia.update({
        where: { id: m.id },
        data: {
          searchAttempts: next,
          ...(reachedCap ? { status: "skipped" } : {}),
        },
      });

      if (reachedCap) {
        await notifyAdminsLibraryGrabSkipped(
          `Movie "${m.title}" (${m.id}) exceeded ${MAX_CRON_GRAB_ATTEMPTS} failed cron grab attempts (${result.reason}). Status set to skipped.`,
        );
      }
    } catch (e) {
      console.warn(`[checkMovieReleases] Failed for movie ${m.id}:`, e);
    }
  }
}
