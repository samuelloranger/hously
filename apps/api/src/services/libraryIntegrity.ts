import { access } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import type { LibraryHealthIssue, LibraryHealthSummary } from "@hously/shared";
import { prisma } from "@hously/api/db";
import {
  getLibraryTmdbApiKey,
  tmdbApiFetch,
} from "@hously/api/utils/medias/libraryHelpers";
import { TMDB_LANGUAGE_LIBRARY_PERSISTENCE } from "@hously/api/utils/medias/tmdbFetchers";

const STALE_TMDB_STATUS_MS = 7 * 24 * 60 * 60 * 1000;
const TMDB_REQUEST_DELAY_MS = 250;
const FILE_CHECK_BATCH = 20;
/** Rows loaded per DB page for large-table scans */
const DB_PAGE_SIZE = 500;
/** Shows processed per TMDB episode drift batch (limits memory vs loading all shows at once) */
const SHOW_TMDB_PAGE_SIZE = 25;
/** Maximum persisted library health runs before deleting oldest */
const MAX_LIBRARY_HEALTH_LOG_ROWS = 200;

export type LibraryIntegrityStatus = "success" | "failed" | "skipped";

export type LibraryIntegrityResult = {
  status: LibraryIntegrityStatus;
  trigger: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  summary: LibraryHealthSummary;
  issues: LibraryHealthIssue[];
  warnings: string[];
  error: string | null;
};

type TmdbEpisode = {
  id: number;
  episode_number: number;
};

let integrityCheckRunning = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function libraryHealthEmptySummary(): LibraryHealthSummary {
  return {
    downloaded_media_without_files: 0,
    downloaded_episodes_without_files: 0,
    missing_file_paths: 0,
    stale_tmdb_statuses: 0,
    episode_number_mismatches: 0,
    total_issues: 0,
  };
}

export function summarizeLibraryHealthIssues(
  issues: LibraryHealthIssue[],
): LibraryHealthSummary {
  const summary = libraryHealthEmptySummary();
  for (const issue of issues) {
    if (issue.kind === "downloaded_media_without_files") {
      summary.downloaded_media_without_files += 1;
    } else if (issue.kind === "downloaded_episode_without_files") {
      summary.downloaded_episodes_without_files += 1;
    } else if (issue.kind === "missing_file_path") {
      summary.missing_file_paths += 1;
    } else if (issue.kind === "stale_tmdb_status") {
      summary.stale_tmdb_statuses += 1;
    } else if (issue.kind === "episode_number_mismatch") {
      summary.episode_number_mismatches += 1;
    }
  }
  summary.total_issues = issues.length;
  return summary;
}

async function pruneOldLibraryHealthLogs(): Promise<void> {
  const total = await prisma.libraryHealthLog.count();
  if (total <= MAX_LIBRARY_HEALTH_LOG_ROWS) return;
  const deleteCount = total - MAX_LIBRARY_HEALTH_LOG_ROWS;
  const stale = await prisma.libraryHealthLog.findMany({
    orderBy: { startedAt: "asc" },
    take: deleteCount,
    select: { id: true },
  });
  const ids = stale.map((s) => s.id);
  if (ids.length === 0) return;
  await prisma.libraryHealthLog.deleteMany({ where: { id: { in: ids } } });
}

async function persistLibraryRun(data: {
  status: LibraryIntegrityStatus;
  trigger: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  summary: LibraryHealthSummary;
  issues: LibraryHealthIssue[];
  warnings: string[];
  error: string | null;
}): Promise<void> {
  await prisma.libraryHealthLog.create({
    data: {
      status: data.status,
      trigger: data.trigger,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      durationMs: data.durationMs,
      summary: data.summary as unknown as Prisma.InputJsonValue,
      issues: data.issues as unknown as Prisma.InputJsonValue,
      warnings: data.warnings,
      error: data.error,
    },
  });
  await pruneOldLibraryHealthLogs();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectDownloadedMediaWithoutFiles(): Promise<
  LibraryHealthIssue[]
> {
  const issues: LibraryHealthIssue[] = [];
  let cursor: { id: number } | undefined;

  for (;;) {
    const rows = await prisma.libraryMedia.findMany({
      take: DB_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      where: { status: "downloaded" },
      select: {
        id: true,
        tmdbId: true,
        type: true,
        title: true,
        _count: { select: { files: true } },
      },
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      if (row._count.files === 0) {
        issues.push({
          kind: "downloaded_media_without_files",
          media_id: row.id,
          tmdb_id: row.tmdbId,
          title: row.title,
          media_type: row.type,
          detail: `${row.type} "${row.title}" is downloaded but has no MediaFile records.`,
        });
      }
    }

    cursor = { id: rows[rows.length - 1]!.id };
  }

  return issues;
}

async function collectDownloadedEpisodesWithoutFiles(): Promise<
  LibraryHealthIssue[]
> {
  const issues: LibraryHealthIssue[] = [];
  let cursor: { id: number } | undefined;

  for (;;) {
    const rows = await prisma.libraryEpisode.findMany({
      take: DB_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      where: { status: "downloaded" },
      select: {
        id: true,
        season: true,
        episode: true,
        tmdbEpisodeId: true,
        media: { select: { id: true, tmdbId: true, title: true } },
        _count: { select: { files: true } },
      },
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      if (row._count.files === 0) {
        issues.push({
          kind: "downloaded_episode_without_files",
          media_id: row.media.id,
          episode_id: row.id,
          tmdb_id: row.media.tmdbId,
          tmdb_episode_id: row.tmdbEpisodeId ?? undefined,
          title: row.media.title,
          media_type: "show",
          season: row.season,
          episode: row.episode,
          detail: `"${row.media.title}" S${row.season}E${row.episode} is downloaded but has no MediaFile records.`,
        });
      }
    }

    cursor = { id: rows[rows.length - 1]!.id };
  }

  return issues;
}

async function collectMissingFilePaths(): Promise<LibraryHealthIssue[]> {
  const missing: LibraryHealthIssue[] = [];
  let cursor: { id: number } | undefined;

  for (;;) {
    const files = await prisma.mediaFile.findMany({
      take: DB_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      select: {
        id: true,
        filePath: true,
        media: { select: { id: true, tmdbId: true, title: true, type: true } },
        episode: {
          select: {
            id: true,
            season: true,
            episode: true,
            tmdbEpisodeId: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (files.length === 0) break;

    for (let i = 0; i < files.length; i += FILE_CHECK_BATCH) {
      const batch = files.slice(i, i + FILE_CHECK_BATCH);
      const results = await Promise.all(
        batch.map(async (file) => ({
          file,
          exists: await fileExists(file.filePath),
        })),
      );
      for (const { file, exists } of results) {
        if (!exists) {
          missing.push({
            kind: "missing_file_path",
            media_id: file.media?.id,
            episode_id: file.episode?.id,
            media_file_id: file.id,
            tmdb_id: file.media?.tmdbId,
            tmdb_episode_id: file.episode?.tmdbEpisodeId ?? undefined,
            title: file.media?.title,
            media_type: file.media?.type,
            season: file.episode?.season,
            episode: file.episode?.episode,
            path: file.filePath,
            detail: `MediaFile ${file.id} points to a missing path: ${file.filePath}`,
          });
        }
      }
    }

    cursor = { id: files[files.length - 1]!.id };
  }

  return missing;
}

async function collectStaleTmdbStatuses(): Promise<LibraryHealthIssue[]> {
  const cutoff = new Date(Date.now() - STALE_TMDB_STATUS_MS);
  const issues: LibraryHealthIssue[] = [];
  let cursor: { id: number } | undefined;

  for (;;) {
    const rows = await prisma.libraryMedia.findMany({
      take: DB_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      where: {
        type: { in: ["show", "movie"] },
        OR: [
          { tmdbStatusRefreshedAt: null },
          { tmdbStatusRefreshedAt: { lt: cutoff } },
        ],
      },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        type: true,
        tmdbStatus: true,
        tmdbStatusRefreshedAt: true,
      },
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      issues.push({
        kind: "stale_tmdb_status",
        media_id: row.id,
        tmdb_id: row.tmdbId,
        title: row.title,
        media_type: row.type,
        tmdb_status: row.tmdbStatus,
        tmdb_status_refreshed_at:
          row.tmdbStatusRefreshedAt?.toISOString() ?? null,
        detail: `"${row.title}" TMDB status has not been refreshed in more than 7 days.`,
      });
    }

    cursor = { id: rows[rows.length - 1]!.id };
  }

  return issues;
}

async function collectEpisodeNumberMismatches(
  warnings: string[],
): Promise<LibraryHealthIssue[]> {
  const apiKey = await getLibraryTmdbApiKey();
  if (!apiKey) {
    warnings.push(
      "TMDB integration is disabled or missing an API key; episode mismatch checks were skipped.",
    );
    return [];
  }

  const issues: LibraryHealthIssue[] = [];
  let cursor: { id: number } | undefined;

  for (;;) {
    const shows = await prisma.libraryMedia.findMany({
      take: SHOW_TMDB_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      where: { type: "show" },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        episodes: {
          select: {
            id: true,
            season: true,
            episode: true,
            tmdbEpisodeId: true,
          },
          orderBy: [{ season: "asc" }, { episode: "asc" }],
        },
      },
      orderBy: { id: "asc" },
    });

    if (shows.length === 0) break;

    for (const show of shows) {
      try {
        const details = await tmdbApiFetch<{
          seasons: Array<{ season_number: number }>;
        }>(`tv/${show.tmdbId}`, apiKey, {
          language: TMDB_LANGUAGE_LIBRARY_PERSISTENCE,
        });

        const tmdbEpisodesById = new Map<
          number,
          { season: number; episode: number }
        >();
        const tmdbEpisodesByNumber = new Set<string>();

        for (const season of details.seasons.filter(
          (s) => s.season_number > 0,
        )) {
          await sleep(TMDB_REQUEST_DELAY_MS);
          const seasonData = await tmdbApiFetch<{ episodes: TmdbEpisode[] }>(
            `tv/${show.tmdbId}/season/${season.season_number}`,
            apiKey,
            { language: TMDB_LANGUAGE_LIBRARY_PERSISTENCE },
          );

          for (const episode of seasonData.episodes) {
            tmdbEpisodesById.set(episode.id, {
              season: season.season_number,
              episode: episode.episode_number,
            });
            tmdbEpisodesByNumber.add(
              `${season.season_number}:${episode.episode_number}`,
            );
          }
        }

        for (const episode of show.episodes) {
          const localKey = `${episode.season}:${episode.episode}`;
          const expected = episode.tmdbEpisodeId
            ? tmdbEpisodesById.get(episode.tmdbEpisodeId)
            : null;

          if (expected) {
            if (
              expected.season !== episode.season ||
              expected.episode !== episode.episode
            ) {
              issues.push({
                kind: "episode_number_mismatch",
                media_id: show.id,
                episode_id: episode.id,
                tmdb_id: show.tmdbId,
                tmdb_episode_id: episode.tmdbEpisodeId ?? undefined,
                title: show.title,
                media_type: "show",
                season: episode.season,
                episode: episode.episode,
                expected_season: expected.season,
                expected_episode: expected.episode,
                detail: `"${show.title}" S${episode.season}E${episode.episode} maps to TMDB S${expected.season}E${expected.episode}.`,
              });
            }
          } else if (
            episode.tmdbEpisodeId !== null &&
            !tmdbEpisodesByNumber.has(localKey)
          ) {
            issues.push({
              kind: "episode_number_mismatch",
              media_id: show.id,
              episode_id: episode.id,
              tmdb_id: show.tmdbId,
              tmdb_episode_id: episode.tmdbEpisodeId ?? undefined,
              title: show.title,
              media_type: "show",
              season: episode.season,
              episode: episode.episode,
              detail: `"${show.title}" S${episode.season}E${episode.episode} was not found in TMDB.`,
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(
          `Episode mismatch check failed for "${show.title}" (${show.id}): ${message}`,
        );
      }

      await sleep(TMDB_REQUEST_DELAY_MS);
    }

    cursor = { id: shows[shows.length - 1]!.id };
  }

  return issues;
}

export async function checkLibraryIntegrity(): Promise<
  Omit<
    LibraryIntegrityResult,
    | "status"
    | "trigger"
    | "started_at"
    | "completed_at"
    | "duration_ms"
    | "summary"
    | "error"
  >
> {
  const warnings: string[] = [];
  const [
    downloadedMediaWithoutFiles,
    downloadedEpisodesWithoutFiles,
    missingFilePaths,
    staleTmdbStatuses,
    episodeNumberMismatches,
  ] = await Promise.all([
    collectDownloadedMediaWithoutFiles(),
    collectDownloadedEpisodesWithoutFiles(),
    collectMissingFilePaths(),
    collectStaleTmdbStatuses(),
    collectEpisodeNumberMismatches(warnings),
  ]);

  return {
    issues: [
      ...downloadedMediaWithoutFiles,
      ...downloadedEpisodesWithoutFiles,
      ...missingFilePaths,
      ...staleTmdbStatuses,
      ...episodeNumberMismatches,
    ],
    warnings,
  };
}

export async function runLibraryIntegrityCheck(options?: {
  trigger?: string;
  persist?: boolean;
}): Promise<LibraryIntegrityResult> {
  const trigger = options?.trigger ?? "manual";
  const persist = options?.persist ?? true;

  if (integrityCheckRunning) {
    console.warn(
      "[libraryIntegrity] check already running — skipping duplicate run",
    );
    const now = new Date();
    const skipped: LibraryIntegrityResult = {
      status: "skipped",
      trigger,
      started_at: now.toISOString(),
      completed_at: now.toISOString(),
      duration_ms: 0,
      summary: libraryHealthEmptySummary(),
      issues: [],
      warnings: [
        "Library integrity check already running — this run was skipped.",
      ],
      error: null,
    };

    if (persist) {
      await persistLibraryRun({
        status: skipped.status,
        trigger,
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        summary: skipped.summary,
        issues: [],
        warnings: skipped.warnings,
        error: null,
      });
    }

    return skipped;
  }

  const startedAt = new Date();
  const started = Date.now();

  integrityCheckRunning = true;
  try {
    const { issues, warnings } = await checkLibraryIntegrity();
    const completedAt = new Date();
    const result: LibraryIntegrityResult = {
      status: "success",
      trigger,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: Date.now() - started,
      summary: summarizeLibraryHealthIssues(issues),
      issues,
      warnings,
      error: null,
    };

    if (persist) {
      await persistLibraryRun({
        status: result.status,
        trigger,
        startedAt,
        completedAt,
        durationMs: result.duration_ms,
        summary: result.summary,
        issues: result.issues,
        warnings,
        error: null,
      });
    }

    return result;
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const result: LibraryIntegrityResult = {
      status: "failed",
      trigger,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: Date.now() - started,
      summary: libraryHealthEmptySummary(),
      issues: [],
      warnings: [],
      error: message,
    };

    if (persist) {
      await persistLibraryRun({
        status: result.status,
        trigger,
        startedAt,
        completedAt,
        durationMs: result.duration_ms,
        summary: result.summary,
        issues: [],
        warnings: [],
        error: message,
      });
    }

    return result;
  } finally {
    integrityCheckRunning = false;
  }
}
