/**
 * Day-before theatrical release reminders for watchlist movies (TMDB release date).
 * Runs on a schedule; skips night hours (same window as other user notifications).
 */

import { buildNotificationUrl } from "@hously/shared";
import { prisma } from "../db";
import {
  fetchMediaDetails,
  loadTmdbConfig,
} from "../utils/medias/tmdbFetchers";
import {
  addDaysInTz,
  formatDateInTimezone,
  midnightOf,
  todayLocal,
} from "../utils";
import { createAndQueueNotification, isNightTime } from "./notificationService";

function dbDateToYmd(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function checkMovieReleaseReminders(): Promise<void> {
  console.log("[CRON] Running checkMovieReleaseReminders...");

  if (isNightTime()) {
    return;
  }

  const tmdbConfig = await loadTmdbConfig();
  if (!tmdbConfig?.api_key) {
    console.log("[CRON] checkMovieReleaseReminders: TMDB not configured, skip");
    return;
  }

  const items = await prisma.watchlistItem.findMany({
    where: { mediaType: "movie" },
    include: { user: { select: { id: true, locale: true } } },
  });

  let sent = 0;

  for (const item of items) {
    let releaseYmd: string | null = dbDateToYmd(item.movieReleaseDate);
    let reminderSentFor = item.releaseReminderSentFor;

    if (!releaseYmd) {
      const details = await fetchMediaDetails(
        tmdbConfig.api_key,
        "movie",
        item.tmdbId,
      );
      releaseYmd = details.release_date;
      const nextDate = releaseYmd
        ? new Date(`${releaseYmd}T00:00:00.000Z`)
        : null;
      const prevYmd = dbDateToYmd(item.movieReleaseDate);
      if (releaseYmd && releaseYmd !== prevYmd) {
        reminderSentFor = null;
      }
      await prisma.watchlistItem.update({
        where: { id: item.id },
        data: {
          movieReleaseDate: nextDate,
          ...(releaseYmd && releaseYmd !== prevYmd
            ? { releaseReminderSentFor: null }
            : {}),
        },
      });
      if (!releaseYmd) continue;
    }

    if (reminderSentFor === releaseYmd) {
      continue;
    }

    const dayBeforeRelease = addDaysInTz(midnightOf(releaseYmd), -1);
    const todayStr = formatDateInTimezone(todayLocal());
    const dayBeforeStr = formatDateInTimezone(dayBeforeRelease);

    if (todayStr !== dayBeforeStr) {
      continue;
    }

    const locale = item.user.locale || "en";
    const title =
      locale === "fr"
        ? `Sort demain : ${item.title}`
        : `Out tomorrow: ${item.title}`;
    const body =
      locale === "fr"
        ? `${item.title} sort au cinéma demain (date TMDB).`
        : `${item.title} releases tomorrow (TMDB date).`;

    const ok = await createAndQueueNotification(
      item.userId,
      title,
      body,
      "movie_release_reminder",
      buildNotificationUrl("/watchlist"),
      { tmdb_id: item.tmdbId, watchlist_item_id: item.id },
    );

    if (ok) {
      await prisma.watchlistItem.update({
        where: { id: item.id },
        data: { releaseReminderSentFor: releaseYmd },
      });
      sent++;
    }
  }

  if (sent > 0) {
    console.log(
      `[CRON] checkMovieReleaseReminders: sent ${sent} notification(s)`,
    );
  }
}
