import { describe, it, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable state shared across all mock factories
// ---------------------------------------------------------------------------

type MediaRecord = {
  id: number;
  type: "movie" | "show";
  status: string;
  title?: string;
  year?: number | null;
  downloadHistories?: Array<{
    id: number;
    torrentHash: string | null;
    episodeId: number | null;
  }>;
};

type FileRecord = {
  id: number;
  mediaId: number;
  filePath: string;
  fileName: string;
  releaseGroup: string | null;
  episodeId?: number | null;
};

type State = {
  media: MediaRecord | null;
  files: FileRecord[];
  remainingFileCount: number | null;
  deletedFileIds: number[];
  updatedFileIds: number[];
  episodeUpdateManyArgs: object | null;
  episodeUpdateManyCount: number;
  mediaUpdateArgs: object | null;
  importedCount: number; // what scanAndImportLibraryFiles returns
  enqueuedDhIds: number[]; // IDs passed to enqueueLibraryPostProcess
};

const state: State = {
  media: null,
  files: [],
  remainingFileCount: null,
  deletedFileIds: [],
  updatedFileIds: [],
  episodeUpdateManyArgs: null,
  episodeUpdateManyCount: 0,
  mediaUpdateArgs: null,
  importedCount: 0,
  enqueuedDhIds: [],
};

// Files that exist on disk (by filePath) — stat will succeed for these
const statMap: Record<string, boolean> = {};

// Files for which scanMediaInfo returns a result (by filePath)
type MiResult = {
  sizeBytes: bigint;
  durationSecs: number | null;
  releaseGroup: string | null;
  videoCodec: string | null;
  videoProfile: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitDepth: number | null;
  videoBitrate: number | null;
  hdrFormat: string | null;
  resolution: number | null;
  source: string | null;
  audioTracks: object[];
  subtitleTracks: object[];
};
const scanMap: Record<string, MiResult | null> = {};

// qBittorrent: hashes that are present AND completed
const qbCompleteHashes: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Mock modules — MUST be registered before importing the module under test
// ---------------------------------------------------------------------------

mock.module("@hously/api/db", () => ({
  prisma: {
    libraryMedia: {
      findUnique: () =>
        Promise.resolve(
          state.media
            ? { ...state.media, downloadHistories: state.media.downloadHistories ?? [] }
            : null,
        ),
      update: (args: object) => {
        state.mediaUpdateArgs = args;
        return Promise.resolve(state.media);
      },
    },
    mediaFile: {
      findMany: () => Promise.resolve(state.files),
      update: (args: { where: { id: number } }) => {
        state.updatedFileIds.push(args.where.id);
        return Promise.resolve({});
      },
      delete: (args: { where: { id: number } }) => {
        state.deletedFileIds.push(args.where.id);
        state.files = state.files.filter((f) => f.id !== args.where.id);
        return Promise.resolve({});
      },
      count: () => {
        const count =
          state.remainingFileCount !== null
            ? state.remainingFileCount
            : state.files.length;
        return Promise.resolve(count);
      },
    },
    libraryEpisode: {
      updateMany: (args: object) => {
        state.episodeUpdateManyArgs = args;
        return Promise.resolve({ count: state.episodeUpdateManyCount });
      },
    },
  },
}));

mock.module("node:fs/promises", () => ({
  stat: (filePath: string) => {
    if (statMap[filePath]) return Promise.resolve({});
    return Promise.reject(new Error("ENOENT"));
  },
}));

mock.module("@hously/api/utils/medias/mediainfoScanner", () => ({
  scanMediaInfo: (filePath: string) =>
    Promise.resolve(scanMap[filePath] ?? null),
}));

mock.module("@hously/api/utils/medias/filenameParser", () => ({
  parseFilenameMetadata: () => ({
    hdrFormat: null,
    resolution: null,
    source: null,
    releaseGroup: null,
  }),
  parseReleaseTitle: () => ({ title: "", year: null }),
}));

mock.module("@hously/api/services/postProcessor", () => ({
  scanAndImportLibraryFiles: () => Promise.resolve(state.importedCount),
  enqueueLibraryPostProcess: (dhId: number) => {
    state.enqueuedDhIds.push(dhId);
  },
}));

mock.module("@hously/api/services/qbittorrent/config", () => ({
  getQbittorrentPluginConfig: () =>
    Promise.resolve({
      enabled: qbCompleteHashes.size > 0,
      config: qbCompleteHashes.size > 0 ? { url: "http://qb" } : null,
    }),
}));

mock.module("@hously/api/services/qbittorrent/client", () => ({
  fetchMaindata: () => {
    const torrents = new Map<string, Record<string, unknown>>();
    for (const hash of qbCompleteHashes) {
      torrents.set(hash, { state: "uploading", progress: 1 });
    }
    return Promise.resolve({ torrents });
  },
}));

mock.module("@hously/api/workers/checkDownloadCompletion", () => ({
  isCompletedDownloadState: (s: string) =>
    ["uploading", "stalledUP", "forcedUP", "queuedUP"].includes(s),
}));

// ---------------------------------------------------------------------------
// Import the service — AFTER mock registrations
// ---------------------------------------------------------------------------

import { rescanLibraryItem } from "../src/services/library/rescan";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMi(overrides: Partial<MiResult> = {}): MiResult {
  return {
    sizeBytes: BigInt(1_000_000),
    durationSecs: 5400,
    releaseGroup: "GROUP",
    videoCodec: "H.264",
    videoProfile: "High",
    width: 1920,
    height: 1080,
    frameRate: 23.976,
    bitDepth: 8,
    videoBitrate: 4000,
    hdrFormat: null,
    resolution: 1080,
    source: "BluRay",
    audioTracks: [],
    subtitleTracks: [],
    ...overrides,
  };
}

function makeFile(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 1,
    mediaId: 1,
    filePath: "/media/movie.mkv",
    fileName: "movie.mkv",
    releaseGroup: null,
    episodeId: null,
    ...overrides,
  };
}

beforeEach(() => {
  state.media = null;
  state.files = [];
  state.remainingFileCount = null;
  state.deletedFileIds = [];
  state.updatedFileIds = [];
  state.episodeUpdateManyArgs = null;
  state.episodeUpdateManyCount = 0;
  state.mediaUpdateArgs = null;
  state.importedCount = 0;
  state.enqueuedDhIds = [];

  for (const k of Object.keys(statMap)) delete statMap[k];
  for (const k of Object.keys(scanMap)) delete scanMap[k];
  qbCompleteHashes.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rescanLibraryItem", () => {
  // ── Existence ──────────────────────────────────────────────────────────────

  it("1. Media not found → returns null", async () => {
    state.media = null;
    const result = await rescanLibraryItem(999);
    expect(result).toBeNull();
  });

  // ── No-files, movie ────────────────────────────────────────────────────────

  it("2. Movie, no files, status 'wanted' → no DB writes", async () => {
    state.media = { id: 1, type: "movie", status: "wanted" };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result).toEqual({
      rescanned: 0, failed: 0, deleted: 0,
      imported: 0, requeued: 0,
      episodesReset: 0, mediaReset: false,
    });
    expect(state.mediaUpdateArgs).toBeNull();
  });

  it("3. Movie, no files, status 'downloading' → resets media to 'wanted'", async () => {
    state.media = { id: 1, type: "movie", status: "downloading" };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.mediaReset).toBe(true);
    expect(state.mediaUpdateArgs).toBeTruthy();
  });

  it("4. Movie, no files, status 'downloaded' → resets media to 'wanted'", async () => {
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.mediaReset).toBe(true);
  });

  it("5. Movie, no files, status 'skipped' → does NOT reset media", async () => {
    state.media = { id: 1, type: "movie", status: "skipped" };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.mediaReset).toBe(false);
    expect(state.mediaUpdateArgs).toBeNull();
  });

  // ── File-level cases ───────────────────────────────────────────────────────

  it("6. Movie, 1 file on disk, MediaInfo succeeds → rescanned:1", async () => {
    const file = makeFile({ id: 1, filePath: "/media/movie.mkv" });
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.files = [file];
    state.remainingFileCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = makeMi();

    const result = await rescanLibraryItem(1);
    expect(result?.rescanned).toBe(1);
    expect(result?.failed).toBe(0);
    expect(result?.deleted).toBe(0);
    expect(state.updatedFileIds).toContain(1);
    expect(result?.mediaReset).toBe(false);
  });

  it("7. Movie, file on disk but MediaInfo null → failed:1, record kept, status unchanged", async () => {
    const file = makeFile({ id: 1, filePath: "/media/corrupt.mkv" });
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.files = [file];
    state.remainingFileCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = null;

    const result = await rescanLibraryItem(1);
    expect(result?.failed).toBe(1);
    expect(result?.deleted).toBe(0);
    expect(result?.rescanned).toBe(0);
    expect(result?.mediaReset).toBe(false);
    expect(state.deletedFileIds).toHaveLength(0);
  });

  it("8. Movie, file deleted from disk → deletes record, resets media to 'wanted'", async () => {
    const file = makeFile({ id: 1, filePath: "/media/gone.mkv" });
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.files = [file];
    scanMap[file.filePath] = null;
    // stat will throw (not in statMap)

    const result = await rescanLibraryItem(1);
    expect(result?.deleted).toBe(1);
    expect(result?.failed).toBe(0);
    expect(state.deletedFileIds).toContain(1);
    expect(result?.mediaReset).toBe(true);
  });

  it("9. Movie, 2 files: 1 valid + 1 deleted → rescanned:1, deleted:1, media stays 'downloaded'", async () => {
    const file1 = makeFile({ id: 1, filePath: "/media/part1.mkv" });
    const file2 = makeFile({ id: 2, filePath: "/media/part2.mkv" });
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.files = [file1, file2];
    statMap[file1.filePath] = true;
    scanMap[file1.filePath] = makeMi();
    scanMap[file2.filePath] = null; // part2 gone, stat will throw

    const result = await rescanLibraryItem(1);
    expect(result?.rescanned).toBe(1);
    expect(result?.deleted).toBe(1);
    expect(result?.mediaReset).toBe(false); // 1 file still remains
  });

  // ── Show-specific ──────────────────────────────────────────────────────────

  it("10. Show, no files, 3 episodes 'downloaded' → episodesReset:3", async () => {
    state.media = { id: 1, type: "show", status: "downloaded" };
    state.remainingFileCount = 0;
    state.episodeUpdateManyCount = 3;

    const result = await rescanLibraryItem(1);
    expect(result?.episodesReset).toBe(3);
    expect(state.episodeUpdateManyArgs).toBeTruthy();
  });

  it("11. Show, no files, media 'downloaded' → resets media to 'wanted'", async () => {
    state.media = { id: 1, type: "show", status: "downloaded" };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.mediaReset).toBe(true);
  });

  it("12. Show, no files, 'skipped' episodes are excluded from reset", async () => {
    state.media = { id: 1, type: "show", status: "downloaded" };
    state.remainingFileCount = 0;
    state.episodeUpdateManyCount = 0;

    await rescanLibraryItem(1);

    const args = state.episodeUpdateManyArgs as {
      where: { status: { notIn: string[] } };
    };
    expect(args.where.status.notIn).toContain("skipped");
  });

  it("13. Show, episodes already 'wanted' → updateMany where clause excludes 'wanted' (idempotent)", async () => {
    state.media = { id: 1, type: "show", status: "wanted" };
    state.remainingFileCount = 0;
    state.episodeUpdateManyCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.episodesReset).toBe(0);
    const args = state.episodeUpdateManyArgs as {
      where: { status: { notIn: string[] } };
    };
    expect(args.where.status.notIn).toContain("wanted");
  });

  it("14. Show, 1 file still present → media NOT reset to 'wanted'", async () => {
    const file = makeFile({ id: 1, filePath: "/media/show/s01e01.mkv", episodeId: 10 });
    state.media = { id: 1, type: "show", status: "downloaded" };
    state.files = [file];
    state.remainingFileCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = makeMi();

    const result = await rescanLibraryItem(1);
    expect(result?.mediaReset).toBe(false);
    expect(state.mediaUpdateArgs).toBeNull();
  });

  it("15. Show, all files deleted → deleted:N, episodes reset, media reset", async () => {
    const files = [
      makeFile({ id: 1, filePath: "/media/s01e01.mkv", episodeId: 1 }),
      makeFile({ id: 2, filePath: "/media/s01e02.mkv", episodeId: 2 }),
      makeFile({ id: 3, filePath: "/media/s01e03.mkv", episodeId: 3 }),
    ];
    state.media = { id: 1, type: "show", status: "downloaded" };
    state.files = files;
    state.episodeUpdateManyCount = 3;
    for (const f of files) scanMap[f.filePath] = null; // all gone

    const result = await rescanLibraryItem(1);
    expect(result?.deleted).toBe(3);
    expect(result?.failed).toBe(0);
    expect(result?.episodesReset).toBe(3);
    expect(result?.mediaReset).toBe(true);
  });

  it("16. File exists on disk but MediaInfo null → failed:1, deleted:0, status unchanged", async () => {
    const file = makeFile({ id: 1, filePath: "/media/corrupt.mkv" });
    state.media = { id: 1, type: "movie", status: "downloaded" };
    state.files = [file];
    state.remainingFileCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = null;

    const result = await rescanLibraryItem(1);
    expect(result?.failed).toBe(1);
    expect(result?.deleted).toBe(0);
    expect(result?.mediaReset).toBe(false);
    expect(state.mediaUpdateArgs).toBeNull();
  });

  // ── Library folder scan (step 1) ───────────────────────────────────────────

  it("17. Files exist in library folder but not in DB → imported, status reconciliation skipped", async () => {
    state.media = { id: 1, type: "movie", status: "downloading" };
    state.remainingFileCount = 1;
    state.importedCount = 1; // scanAndImportLibraryFiles found 1 file

    const result = await rescanLibraryItem(1);
    expect(result?.imported).toBe(1);
    // Status reconciliation skipped because imported > 0
    expect(result?.mediaReset).toBe(false);
    expect(state.mediaUpdateArgs).toBeNull();
    expect(result?.episodesReset).toBe(0);
  });

  it("18. Library folder import + existing files on disk → both handled independently", async () => {
    const file = makeFile({ id: 1, filePath: "/media/movie.mkv" });
    state.media = { id: 1, type: "movie", status: "downloading" };
    state.files = [file];
    state.remainingFileCount = 2; // 1 existing + 1 imported
    state.importedCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = makeMi();

    const result = await rescanLibraryItem(1);
    expect(result?.imported).toBe(1);
    expect(result?.rescanned).toBe(1);
    expect(result?.mediaReset).toBe(false); // skipped because imported > 0
  });

  // ── qBittorrent re-queue (step 3) ──────────────────────────────────────────

  it("19. Completed DH with torrent still in qBittorrent (completed state) → requeued:1", async () => {
    state.media = {
      id: 1, type: "movie", status: "downloading",
      downloadHistories: [{ id: 42, torrentHash: "abc123", episodeId: null }],
    };
    state.remainingFileCount = 0;
    qbCompleteHashes.add("abc123"); // torrent present and completed in qB

    const result = await rescanLibraryItem(1);
    expect(result?.requeued).toBe(1);
    expect(state.enqueuedDhIds).toContain(42);
    // Status reconciliation skipped because requeued > 0
    expect(result?.mediaReset).toBe(false);
    expect(state.mediaUpdateArgs).toBeNull();
  });

  it("20. Completed DH but torrent NOT in qBittorrent → requeued:0, status reset to 'wanted'", async () => {
    state.media = {
      id: 1, type: "movie", status: "downloading",
      downloadHistories: [{ id: 42, torrentHash: "abc123", episodeId: null }],
    };
    state.remainingFileCount = 0;
    // qbCompleteHashes is empty → torrent not found

    const result = await rescanLibraryItem(1);
    expect(result?.requeued).toBe(0);
    expect(state.enqueuedDhIds).toHaveLength(0);
    // Status reconciliation runs → resets to wanted
    expect(result?.mediaReset).toBe(true);
  });

  it("21. Show: episode DH in qBittorrent but that episode already has a file → not re-queued", async () => {
    const file = makeFile({ id: 1, filePath: "/media/s01e01.mkv", episodeId: 10 });
    state.media = {
      id: 1, type: "show", status: "downloaded",
      downloadHistories: [{ id: 55, torrentHash: "ep10hash", episodeId: 10 }],
    };
    state.files = [file];
    state.remainingFileCount = 1;
    statMap[file.filePath] = true;
    scanMap[file.filePath] = makeMi();
    qbCompleteHashes.add("ep10hash"); // torrent present but episode already imported

    const result = await rescanLibraryItem(1);
    expect(result?.requeued).toBe(0); // episode 10 has a file → no requeue
    expect(state.enqueuedDhIds).toHaveLength(0);
  });

  it("22. Show: episode DH in qBittorrent, file missing → re-queued, reconciliation skipped", async () => {
    state.media = {
      id: 1, type: "show", status: "downloading",
      downloadHistories: [{ id: 77, torrentHash: "ephash", episodeId: 20 }],
    };
    state.remainingFileCount = 0;
    qbCompleteHashes.add("ephash"); // torrent present, episode 20 has no file

    const result = await rescanLibraryItem(1);
    expect(result?.requeued).toBe(1);
    expect(state.enqueuedDhIds).toContain(77);
    expect(result?.episodesReset).toBe(0); // skipped
    expect(result?.mediaReset).toBe(false); // skipped
  });

  it("23. DH has null torrentHash → never re-queued regardless of qBittorrent state", async () => {
    state.media = {
      id: 1, type: "movie", status: "downloading",
      downloadHistories: [{ id: 99, torrentHash: null, episodeId: null }],
    };
    state.remainingFileCount = 0;

    const result = await rescanLibraryItem(1);
    expect(result?.requeued).toBe(0);
    expect(state.enqueuedDhIds).toHaveLength(0);
    // Falls through to status reset
    expect(result?.mediaReset).toBe(true);
  });
});
