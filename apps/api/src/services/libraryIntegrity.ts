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

export type LibraryIntegrityResult = {
  status: "success" | "failed";
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

type StaleTmdbStatusRow = {
  id: number;
  tmdb_id: number;
  title: string;
  tmdb_status: string | null;
  tmdb_status_refreshed_at: Date | null;
};

let integrityCheckRunning = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptySummary(): LibraryHealthSummary {
  return {
    downloaded_media_without_files: 0,
    downloaded_episodes_without_files: 0,
    missing_file_paths: 0,
    stale_tmdb_statuses: 0,
    episode_number_mismatches: 0,
    total_issues: 0,
  };
}

function summarize(issues: LibraryHealthIssue[]): LibraryHealthSummary {
  const summary = emptySummary();
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
  const rows = await prisma.libraryMedia.findMany({
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

  return rows
    .filter((row) => row._count.files === 0)
    .map((row) => ({
      kind: "downloaded_media_without_files" as const,
      media_id: row.id,
      tmdb_id: row.tmdbId,
      title: row.title,
      media_type: row.type,
      detail: `${row.type} "${row.title}" is downloaded but has no MediaFile records.`,
    }));
}

async function collectDownloadedEpisodesWithoutFiles(): Promise<
  LibraryHealthIssue[]
> {
  const rows = await prisma.libraryEpisode.findMany({
    where: { status: "downloaded" },
    select: {
      id: true,
      season: true,
      episode: true,
      tmdbEpisodeId: true,
      media: { select: { id: true, tmdbId: true, title: true } },
      _count: { select: { files: true } },
    },
    orderBy: [{ mediaId: "asc" }, { season: "asc" }, { episode: "asc" }],
  });

  return rows
    .filter((row) => row._count.files === 0)
    .map((row) => ({
      kind: "downloaded_episode_without_files" as const,
      media_id: row.media.id,
      episode_id: row.id,
      tmdb_id: row.media.tmdbId,
      tmdb_episode_id: row.tmdbEpisodeId ?? undefined,
      title: row.media.title,
      media_type: "show" as const,
      season: row.season,
      episode: row.episode,
      detail: `"${row.media.title}" S${row.season}E${row.episode} is downloaded but has no MediaFile records.`,
    }));
}

async function collectMissingFilePaths(): Promise<LibraryHealthIssue[]> {
  const files = await prisma.mediaFile.findMany({
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

  const missing: LibraryHealthIssue[] = [];

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

  return missing;
}

async function collectStaleTmdbStatuses(): Promise<LibraryHealthIssue[]> {
  const cutoff = new Date(Date.now() - STALE_TMDB_STATUS_MS);
  const shows = await prisma.$queryRaw<StaleTmdbStatusRow[]>`
    SELECT
      "id",
      "tmdb_id",
      "title",
      "tmdb_status",
      "tmdb_status_refreshed_at"
    FROM "library_media"
    WHERE "type" = 'show'
      AND (
        "tmdb_status_refreshed_at" IS NULL
        OR "tmdb_status_refreshed_at" < ${cutoff}
      )
    ORDER BY "id" ASC
  `;

  return shows.map((show) => ({
    kind: "stale_tmdb_status" as const,
    media_id: show.id,
    tmdb_id: show.tmdb_id,
    title: show.title,
    media_type: "show" as const,
    tmdb_status: show.tmdb_status,
    tmdb_status_refreshed_at:
      show.tmdb_status_refreshed_at?.toISOString() ?? null,
    detail: `"${show.title}" TMDB status has not been refreshed in more than 7 days.`,
  }));
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

  const shows = await prisma.libraryMedia.findMany({
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

  const issues: LibraryHealthIssue[] = [];

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

      for (const season of details.seasons.filter((s) => s.season_number > 0)) {
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
  if (integrityCheckRunning) {
    console.warn(
      "[libraryIntegrity] check already running — skipping duplicate run",
    );
    const now = new Date();
    return {
      status: "success",
      trigger: options?.trigger ?? "manual",
      started_at: now.toISOString(),
      completed_at: now.toISOString(),
      duration_ms: 0,
      summary: emptySummary(),
      issues: [],
      warnings: [
        "Library integrity check already running — this run was skipped.",
      ],
      error: null,
    };
  }

  const trigger = options?.trigger ?? "manual";
  const persist = options?.persist ?? true;
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
      summary: summarize(issues),
      issues,
      warnings,
      error: null,
    };

    if (persist) {
      await prisma.libraryHealthLog.create({
        data: {
          status: result.status,
          trigger,
          startedAt,
          completedAt,
          durationMs: result.duration_ms,
          summary: result.summary as unknown as Prisma.InputJsonValue,
          issues: result.issues as unknown as Prisma.InputJsonValue,
          warnings,
          error: null,
        },
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
      summary: emptySummary(),
      issues: [],
      warnings: [],
      error: message,
    };

    if (persist) {
      await prisma.libraryHealthLog.create({
        data: {
          status: result.status,
          trigger,
          startedAt,
          completedAt,
          durationMs: result.duration_ms,
          summary: result.summary as unknown as Prisma.InputJsonValue,
          issues: [] as unknown as Prisma.InputJsonValue,
          warnings: [],
          error: message,
        },
      });
    }

    return result;
  } finally {
    integrityCheckRunning = false;
  }
}
