import { prisma } from "@hously/api/db";
import { Prisma } from "@prisma/client";
import {
  LIBRARY_ATTENTION_ISSUE_LOOKBACK_DAYS,
  LIBRARY_ATTENTION_MAX_ITEMS,
  LIBRARY_ATTENTION_PER_SOURCE_DH_TAKE,
  LIBRARY_ATTENTION_PER_SOURCE_EPISODE_TAKE,
  LIBRARY_ATTENTION_PER_SOURCE_MOVIE_TAKE,
  LIBRARY_ATTENTION_STUCK_PENDING_HOURS,
  LIBRARY_ATTENTION_WARN_ATTEMPTS,
  MAX_CRON_GRAB_ATTEMPTS,
} from "@hously/api/constants/libraryGrab";
import type { LibraryAttentionKind } from "@hously/shared/types";
import {
  APP_DISPLAY_TIMEZONE,
  localDateYmd,
  toUtcMidnightDate,
} from "@hously/shared/utils/date";

export type LibraryAttentionScopeType = "movie" | "episode" | "season_pack";

export type AttentionCandidate = {
  media_id: number;
  media_title: string;
  media_type: "movie" | "show";
  scope_type: LibraryAttentionScopeType;
  episode_id: number | null;
  season: number | null;
  episode_number: number | null;
  kind: LibraryAttentionKind;
  detail: string | null;
  search_attempts: number | null;
  library_status: string | null;
  download_history_id: number | null;
  grabbed_at: Date | null;
};

const KIND_PRIORITY: Record<LibraryAttentionKind, number> = {
  download_failed: 1,
  post_process_error: 2,
  download_stuck: 3,
  grab_skipped: 4,
  auto_grab_stalled: 5,
};

export function attentionKindPriority(kind: LibraryAttentionKind): number {
  return KIND_PRIORITY[kind];
}

/** Parse season from typical release names (season pack or season folder style). */
export function inferSeasonFromReleaseTitle(title: string): number | null {
  const t = title.trim();
  if (!t) return null;
  const mPack = t.match(/\bS(?:eason)?[\s._-]*(\d{1,2})\b/i);
  if (mPack) return parseInt(mPack[1], 10);
  const mDot = t.match(/(?:^|[._\s-])S(\d{2})(?:E\d{2}|(?=[._\s-]|$))/i);
  if (mDot) return parseInt(mDot[1], 10);
  return null;
}

export async function isSeasonPackGrabScope(
  mediaId: number,
  season: number,
  cache: Map<string, boolean> = new Map(),
): Promise<boolean> {
  const key = `wanted:${mediaId}:${season}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const nowMinusGrace = new Date(Date.now() - 60 * 60 * 1000);
  const cutoff = toUtcMidnightDate(
    localDateYmd(APP_DISPLAY_TIMEZONE, nowMinusGrace),
  );

  const totalMonitored = await prisma.libraryEpisode.count({
    where: { mediaId, season, monitored: true },
  });
  if (totalMonitored === 0) {
    cache.set(key, false);
    return false;
  }

  const inGrabSet = await prisma.libraryEpisode.count({
    where: {
      mediaId,
      season,
      monitored: true,
      status: "wanted",
      airDate: { lte: cutoff },
      files: { none: {} },
      searchAttempts: { lt: MAX_CRON_GRAB_ATTEMPTS },
    },
  });

  const ok = inGrabSet === totalMonitored;
  cache.set(key, ok);
  return ok;
}

/** All monitored episodes in the season are skipped (typical after a failed season-pack cron). */
export async function isSeasonPackSkippedScope(
  mediaId: number,
  season: number,
  cache: Map<string, boolean> = new Map(),
): Promise<boolean> {
  const key = `skip:${mediaId}:${season}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const totalMonitored = await prisma.libraryEpisode.count({
    where: { mediaId, season, monitored: true },
  });
  if (totalMonitored === 0) {
    cache.set(key, false);
    return false;
  }

  const skippedCount = await prisma.libraryEpisode.count({
    where: {
      mediaId,
      season,
      monitored: true,
      status: "skipped",
    },
  });

  const ok = skippedCount === totalMonitored;
  cache.set(key, ok);
  return ok;
}

type DhRow = {
  id: number;
  mediaId: number | null;
  episodeId: number | null;
  releaseTitle: string;
  grabbedAt: Date;
  failReason: string | null;
  postProcessError: string | null;
  failed: boolean;
  completedAt: Date | null;
  media: {
    id: number;
    title: string;
    type: string;
    status: string;
  } | null;
  episode: {
    id: number;
    season: number;
    episode: number;
    status: string;
    media: { id: number; title: string; type: string; status: string };
  } | null;
};

function dhScopeFromRow(dh: DhRow): {
  scope_type: LibraryAttentionScopeType;
  episode_id: number | null;
  season: number | null;
  episode_number: number | null;
  media_id: number;
  media_title: string;
  media_type: "movie" | "show";
  library_status: string;
} | null {
  if (dh.media) {
    const mt = dh.media.type as "movie" | "show";
    if (mt === "movie") {
      return {
        scope_type: "movie",
        episode_id: null,
        season: null,
        episode_number: null,
        media_id: dh.media.id,
        media_title: dh.media.title,
        media_type: "movie",
        library_status: dh.media.status,
      };
    }
    if (dh.episodeId != null && dh.episode) {
      return {
        scope_type: "episode",
        episode_id: dh.episode.id,
        season: dh.episode.season,
        episode_number: dh.episode.episode,
        media_id: dh.media.id,
        media_title: dh.media.title,
        media_type: "show",
        library_status: dh.episode.status,
      };
    }
    const inferred = inferSeasonFromReleaseTitle(dh.releaseTitle);
    if (inferred == null) {
      console.warn(
        `[libraryAttention] skipping show-level DH ${dh.id}: no season parseable from "${dh.releaseTitle}"`,
      );
      return null;
    }
    return {
      scope_type: "season_pack",
      episode_id: null,
      season: inferred,
      episode_number: null,
      media_id: dh.media.id,
      media_title: dh.media.title,
      media_type: "show",
      library_status: dh.media.status,
    };
  }
  if (dh.episode?.media) {
    return {
      scope_type: "episode",
      episode_id: dh.episode.id,
      season: dh.episode.season,
      episode_number: dh.episode.episode,
      media_id: dh.episode.media.id,
      media_title: dh.episode.media.title,
      media_type: "show",
      library_status: dh.episode.status,
    };
  }
  return null;
}

const dhInclude = {
  media: { select: { id: true, title: true, type: true, status: true } },
  episode: {
    select: {
      id: true,
      season: true,
      episode: true,
      status: true,
      media: { select: { id: true, title: true, type: true, status: true } },
    },
  },
} as const;

async function pushEpisodePackOrIndividuals(
  episodes: Array<{
    id: number;
    mediaId: number;
    season: number;
    episode: number;
    searchAttempts: number;
    status: string;
    media: { id: number; title: string; type: string; status: string };
  }>,
  kind: "grab_skipped" | "auto_grab_stalled",
  packCache: Map<string, boolean>,
  out: AttentionCandidate[],
): Promise<void> {
  const grouped = new Map<string, typeof episodes>();
  for (const ep of episodes) {
    const k = `${ep.mediaId}:${ep.season}`;
    const arr = grouped.get(k) ?? [];
    arr.push(ep);
    grouped.set(k, arr);
  }

  const consumed = new Set<number>();

  for (const [, group] of grouped) {
    const first = group[0];
    const pack =
      kind === "grab_skipped"
        ? await isSeasonPackSkippedScope(first.mediaId, first.season, packCache)
        : await isSeasonPackGrabScope(first.mediaId, first.season, packCache);
    if (pack && group.length > 0) {
      const maxAttempts = Math.max(...group.map((e) => e.searchAttempts));
      out.push({
        media_id: first.media.id,
        media_title: first.media.title,
        media_type: "show",
        scope_type: "season_pack",
        episode_id: null,
        season: first.season,
        episode_number: null,
        kind,
        detail: null,
        search_attempts: maxAttempts,
        library_status: kind === "grab_skipped" ? "skipped" : "wanted",
        download_history_id: null,
        grabbed_at: null,
      });
      for (const e of group) consumed.add(e.id);
    }
  }

  for (const ep of episodes) {
    if (consumed.has(ep.id)) continue;
    out.push({
      media_id: ep.media.id,
      media_title: ep.media.title,
      media_type: "show",
      scope_type: "episode",
      episode_id: ep.id,
      season: ep.season,
      episode_number: ep.episode,
      kind,
      detail: null,
      search_attempts: ep.searchAttempts,
      library_status: ep.status,
      download_history_id: null,
      grabbed_at: null,
    });
  }
}

export async function buildAttentionCandidates(): Promise<
  AttentionCandidate[]
> {
  const lookbackMs =
    LIBRARY_ATTENTION_ISSUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const issueCutoff = new Date(Date.now() - lookbackMs);
  const staleCutoff = new Date(
    Date.now() - LIBRARY_ATTENTION_STUCK_PENDING_HOURS * 60 * 60 * 1000,
  );

  const [
    failedRows,
    postProcessRows,
    stuckRows,
    skippedMovies,
    skippedEpisodes,
    stalledMovies,
    stalledEpisodes,
  ] = await Promise.all([
    prisma.downloadHistory.findMany({
      where: { failed: true, grabbedAt: { gte: issueCutoff } },
      orderBy: { grabbedAt: "desc" },
      take: LIBRARY_ATTENTION_PER_SOURCE_DH_TAKE,
      include: dhInclude,
    }),
    prisma.downloadHistory.findMany({
      where: {
        failed: false,
        postProcessError: { not: null },
        NOT: { postProcessError: "" },
        grabbedAt: { gte: issueCutoff },
      },
      orderBy: { grabbedAt: "desc" },
      take: LIBRARY_ATTENTION_PER_SOURCE_DH_TAKE,
      include: dhInclude,
    }),
    prisma.downloadHistory.findMany({
      where: {
        completedAt: null,
        failed: false,
        grabbedAt: { lt: staleCutoff },
      },
      orderBy: { grabbedAt: "asc" },
      take: LIBRARY_ATTENTION_PER_SOURCE_DH_TAKE,
      include: dhInclude,
    }),
    prisma.libraryMedia.findMany({
      where: { status: "skipped", monitored: true },
      select: {
        id: true,
        title: true,
        type: true,
        searchAttempts: true,
        status: true,
      },
      take: LIBRARY_ATTENTION_PER_SOURCE_MOVIE_TAKE,
    }),
    prisma.libraryEpisode.findMany({
      where: {
        status: "skipped",
        monitored: true,
        media: { monitored: true },
      },
      include: {
        media: { select: { id: true, title: true, type: true, status: true } },
      },
      take: LIBRARY_ATTENTION_PER_SOURCE_EPISODE_TAKE,
    }),
    prisma.libraryMedia.findMany({
      where: {
        type: "movie",
        status: "wanted",
        monitored: true,
        searchAttempts: { gte: LIBRARY_ATTENTION_WARN_ATTEMPTS },
        files: { none: {} },
      },
      select: {
        id: true,
        title: true,
        type: true,
        searchAttempts: true,
        status: true,
      },
      take: LIBRARY_ATTENTION_PER_SOURCE_MOVIE_TAKE,
    }),
    prisma.libraryEpisode.findMany({
      where: {
        status: "wanted",
        monitored: true,
        searchAttempts: { gte: LIBRARY_ATTENTION_WARN_ATTEMPTS },
        files: { none: {} },
        media: { type: "show", monitored: true },
      },
      include: {
        media: { select: { id: true, title: true, type: true, status: true } },
      },
      take: LIBRARY_ATTENTION_PER_SOURCE_EPISODE_TAKE,
    }),
  ]);

  const packCache = new Map<string, boolean>();
  const out: AttentionCandidate[] = [];

  for (const dh of failedRows) {
    const meta = dhScopeFromRow(dh as DhRow);
    if (!meta) continue;
    out.push({
      ...meta,
      kind: "download_failed",
      detail: dh.failReason,
      search_attempts: null,
      download_history_id: dh.id,
      grabbed_at: dh.grabbedAt,
    });
  }

  for (const dh of postProcessRows) {
    const meta = dhScopeFromRow(dh as DhRow);
    if (!meta) continue;
    out.push({
      ...meta,
      kind: "post_process_error",
      detail: dh.postProcessError,
      search_attempts: null,
      download_history_id: dh.id,
      grabbed_at: dh.grabbedAt,
    });
  }

  for (const dh of stuckRows) {
    const meta = dhScopeFromRow(dh as DhRow);
    if (!meta) continue;
    out.push({
      ...meta,
      kind: "download_stuck",
      detail: null,
      search_attempts: null,
      download_history_id: dh.id,
      grabbed_at: dh.grabbedAt,
    });
  }

  for (const m of skippedMovies) {
    if (m.type === "movie") {
      out.push({
        media_id: m.id,
        media_title: m.title,
        media_type: "movie",
        scope_type: "movie",
        episode_id: null,
        season: null,
        episode_number: null,
        kind: "grab_skipped",
        detail: null,
        search_attempts: m.searchAttempts,
        library_status: m.status,
        download_history_id: null,
        grabbed_at: null,
      });
    }
  }

  await pushEpisodePackOrIndividuals(
    skippedEpisodes.map((ep) => ({
      id: ep.id,
      mediaId: ep.mediaId,
      season: ep.season,
      episode: ep.episode,
      searchAttempts: ep.searchAttempts,
      status: ep.status,
      media: ep.media,
    })),
    "grab_skipped",
    packCache,
    out,
  );

  for (const m of stalledMovies) {
    out.push({
      media_id: m.id,
      media_title: m.title,
      media_type: "movie",
      scope_type: "movie",
      episode_id: null,
      season: null,
      episode_number: null,
      kind: "auto_grab_stalled",
      detail: null,
      search_attempts: m.searchAttempts,
      library_status: m.status,
      download_history_id: null,
      grabbed_at: null,
    });
  }

  await pushEpisodePackOrIndividuals(
    stalledEpisodes.map((ep) => ({
      id: ep.id,
      mediaId: ep.mediaId,
      season: ep.season,
      episode: ep.episode,
      searchAttempts: ep.searchAttempts,
      status: ep.status,
      media: ep.media,
    })),
    "auto_grab_stalled",
    packCache,
    out,
  );

  out.sort((a, b) => {
    const p = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (p !== 0) return p;
    return (b.grabbed_at?.getTime() ?? 0) - (a.grabbed_at?.getTime() ?? 0);
  });

  return out.slice(0, LIBRARY_ATTENTION_MAX_ITEMS);
}

function matchOpenAlertWhere(c: AttentionCandidate) {
  return {
    status: "open" as const,
    mediaId: c.media_id,
    kind: c.kind,
    scopeType: c.scope_type,
    episodeId: c.episode_id ?? null,
    season: c.season ?? null,
  };
}

async function alertStillValidAgainstDb(alert: {
  id: number;
  kind: string;
  scopeType: string;
  mediaId: number;
  episodeId: number | null;
  season: number | null;
  downloadHistoryId: number | null;
}): Promise<boolean> {
  const lookbackMs =
    LIBRARY_ATTENTION_ISSUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const issueCutoff = new Date(Date.now() - lookbackMs);
  const staleCutoff = new Date(
    Date.now() - LIBRARY_ATTENTION_STUCK_PENDING_HOURS * 60 * 60 * 1000,
  );

  switch (alert.kind as LibraryAttentionKind) {
    case "download_failed": {
      if (alert.downloadHistoryId == null) return false;
      const dh = await prisma.downloadHistory.findUnique({
        where: { id: alert.downloadHistoryId },
        select: { failed: true, grabbedAt: true },
      });
      return !!(dh?.failed && dh.grabbedAt.getTime() >= issueCutoff.getTime());
    }
    case "post_process_error": {
      if (alert.downloadHistoryId == null) return false;
      const dh = await prisma.downloadHistory.findUnique({
        where: { id: alert.downloadHistoryId },
        select: {
          failed: true,
          postProcessError: true,
          grabbedAt: true,
        },
      });
      return !!(
        dh &&
        !dh.failed &&
        dh.postProcessError != null &&
        dh.postProcessError !== "" &&
        dh.grabbedAt.getTime() >= issueCutoff.getTime()
      );
    }
    case "download_stuck": {
      if (alert.downloadHistoryId == null) return false;
      const dh = await prisma.downloadHistory.findUnique({
        where: { id: alert.downloadHistoryId },
        select: {
          failed: true,
          completedAt: true,
          grabbedAt: true,
        },
      });
      return !!(
        dh &&
        !dh.failed &&
        dh.completedAt == null &&
        dh.grabbedAt.getTime() < staleCutoff.getTime()
      );
    }
    case "grab_skipped": {
      if (alert.scopeType === "movie") {
        const m = await prisma.libraryMedia.findUnique({
          where: { id: alert.mediaId },
          select: { status: true },
        });
        return m?.status === "skipped";
      }
      if (alert.scopeType === "season_pack") {
        if (alert.season == null) return false;
        const c = await prisma.libraryEpisode.count({
          where: {
            mediaId: alert.mediaId,
            season: alert.season,
            status: "skipped",
            monitored: true,
          },
        });
        return c > 0;
      }
      if (alert.episodeId == null) return false;
      const ep = await prisma.libraryEpisode.findUnique({
        where: { id: alert.episodeId },
        select: { status: true },
      });
      return ep?.status === "skipped";
    }
    case "auto_grab_stalled": {
      if (alert.scopeType === "movie") {
        const m = await prisma.libraryMedia.findFirst({
          where: {
            id: alert.mediaId,
            type: "movie",
            status: "wanted",
            monitored: true,
            searchAttempts: { gte: LIBRARY_ATTENTION_WARN_ATTEMPTS },
            files: { none: {} },
          },
        });
        return !!m;
      }
      if (alert.scopeType === "episode") {
        if (alert.episodeId == null) return false;
        const ep = await prisma.libraryEpisode.findFirst({
          where: {
            id: alert.episodeId,
            status: "wanted",
            monitored: true,
            searchAttempts: { gte: LIBRARY_ATTENTION_WARN_ATTEMPTS },
            files: { none: {} },
            media: { monitored: true },
          },
        });
        return !!ep;
      }
      if (alert.season == null) return false;
      const c = await prisma.libraryEpisode.count({
        where: {
          mediaId: alert.mediaId,
          season: alert.season,
          status: "wanted",
          monitored: true,
          searchAttempts: { gte: LIBRARY_ATTENTION_WARN_ATTEMPTS },
          files: { none: {} },
          media: { monitored: true },
        },
      });
      return c > 0;
    }
    default:
      return false;
  }
}

export async function syncLibraryAttentionAlerts(): Promise<{
  created: number;
  updated: number;
  resolved: number;
}> {
  const candidates = await buildAttentionCandidates();
  let created = 0;
  let updated = 0;

  for (const c of candidates) {
    const where = matchOpenAlertWhere(c);
    const existing = await prisma.libraryAttentionAlert.findFirst({
      where,
    });

    const data = {
      detail: c.detail,
      downloadHistoryId: c.download_history_id,
      searchAttempts: c.search_attempts,
      grabbedAt: c.grabbed_at,
      libraryStatusSnapshot: c.library_status,
    };

    if (existing) {
      await prisma.libraryAttentionAlert.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      try {
        await prisma.libraryAttentionAlert.create({
          data: {
            mediaId: c.media_id,
            episodeId: c.episode_id,
            season: c.season,
            scopeType: c.scope_type,
            kind: c.kind,
            status: "open",
            ...data,
          },
        });
        created++;
      } catch (e) {
        const isUniqueViolation =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002";
        if (!isUniqueViolation) {
          console.error(
            "[libraryAttention] create failed (non-unique-violation):",
            e,
          );
          throw e;
        }
        const existing2 = await prisma.libraryAttentionAlert.findFirst({
          where,
        });
        if (existing2) {
          await prisma.libraryAttentionAlert.update({
            where: { id: existing2.id },
            data,
          });
          updated++;
        }
      }
    }
  }

  const openRows = await prisma.libraryAttentionAlert.findMany({
    where: { status: "open" },
    select: {
      id: true,
      kind: true,
      scopeType: true,
      mediaId: true,
      episodeId: true,
      season: true,
      downloadHistoryId: true,
    },
  });

  let resolved = 0;
  for (const row of openRows) {
    const still = await alertStillValidAgainstDb(row);
    if (!still) {
      await prisma.libraryAttentionAlert.update({
        where: { id: row.id },
        data: {
          status: "resolved_auto",
          resolvedAt: new Date(),
        },
      });
      resolved++;
    }
  }

  return { created, updated, resolved };
}

export async function listOpenLibraryAttentionForApi(): Promise<{
  items: Array<{
    id: number;
    kind: LibraryAttentionKind;
    scope_type: LibraryAttentionScopeType;
    media_id: number;
    media_title: string;
    media_type: "movie" | "show";
    episode_id: number | null;
    season: number | null;
    episode_number: number | null;
    detail: string | null;
    search_attempts: number | null;
    library_status: string | null;
    download_history_id: number | null;
    grabbed_at: string | null;
    updated_at: string;
  }>;
}> {
  const rows = await prisma.libraryAttentionAlert.findMany({
    where: { status: "open" },
    include: {
      media: { select: { title: true, type: true } },
      episode: { select: { season: true, episode: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const items = rows
    .map((r) => {
      const scope = r.scopeType as LibraryAttentionScopeType;
      const season =
        scope === "season_pack"
          ? r.season
          : scope === "episode"
            ? (r.episode?.season ?? r.season)
            : null;
      return {
        id: r.id,
        kind: r.kind as LibraryAttentionKind,
        scope_type: scope,
        media_id: r.mediaId,
        media_title: r.media?.title ?? "?",
        media_type: (r.media?.type ?? "movie") as "movie" | "show",
        episode_id: r.episodeId,
        season,
        episode_number:
          scope === "episode" ? (r.episode?.episode ?? null) : null,
        detail: r.detail,
        search_attempts: r.searchAttempts,
        library_status: r.libraryStatusSnapshot,
        download_history_id: r.downloadHistoryId,
        grabbed_at: r.grabbedAt?.toISOString() ?? null,
        updated_at: r.updatedAt.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        (KIND_PRIORITY[a.kind] ?? 99) - (KIND_PRIORITY[b.kind] ?? 99) ||
        b.updated_at.localeCompare(a.updated_at),
    )
    .slice(0, LIBRARY_ATTENTION_MAX_ITEMS);

  return { items };
}

export async function dismissLibraryAttentionAlert(
  alertId: number,
): Promise<boolean> {
  const row = await prisma.libraryAttentionAlert.findUnique({
    where: { id: alertId },
    select: { id: true, status: true },
  });
  if (!row || row.status !== "open") return false;
  await prisma.libraryAttentionAlert.update({
    where: { id: alertId },
    data: {
      status: "dismissed",
      dismissedAt: new Date(),
    },
  });
  return true;
}
