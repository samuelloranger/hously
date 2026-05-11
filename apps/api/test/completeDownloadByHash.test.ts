import { describe, it, expect, beforeEach, mock } from "bun:test";

// Regression test for the recovery handle on /qbittorrent/completed.
//
// Pre-fix: completeDownloadByHash returned null when a DH row already had
// completed_at set, so the webhook handler skipped enqueueLibraryPostProcess.
// That left the system stuck with status="downloaded" in the DB but the file
// still in the qB downloads dir — manual rescan was the only recovery.
//
// Post-fix: the function returns the DH id whenever a non-failed row exists
// for the hash, so the webhook can re-enqueue post-processing on every call.

const HASH = "a".repeat(40);

type DhRow = {
  id: number;
  torrentHash: string | null;
  completedAt: Date | null;
  failed: boolean;
  mediaId: number | null;
  episodeId: number | null;
  bookId: number | null;
  postProcessDestinationPath: string | null;
};

const state: {
  rows: DhRow[];
  markedComplete: number[];
  emittedMediaIds: number[];
} = {
  rows: [],
  markedComplete: [],
  emittedMediaIds: [],
};

mock.module("@hously/api/db", () => ({
  prisma: {
    downloadHistory: {
      findFirst: ({
        where,
      }: {
        where: { torrentHash: string; failed: boolean; completedAt?: null };
      }) => {
        const match = state.rows.find(
          (r) =>
            r.torrentHash === where.torrentHash &&
            r.failed === where.failed &&
            (where.completedAt === undefined ||
              r.completedAt === where.completedAt),
        );
        return Promise.resolve(match ?? null);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<DhRow>;
      }) => {
        const row = state.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return Promise.resolve(row);
      },
    },
    libraryMedia: {
      update: () => Promise.resolve({}),
      updateMany: () => Promise.resolve({ count: 0 }),
      findUnique: () => Promise.resolve({ type: "show", tmdbStatus: null }),
    },
    libraryEpisode: { update: () => Promise.resolve({}) },
    libraryBook: { update: () => Promise.resolve({}) },
  },
}));

mock.module("@hously/api/services/libraryEvents", () => ({
  emitLibraryUpdate: (id: number) => {
    state.emittedMediaIds.push(id);
  },
  emitBookLibraryUpdate: () => undefined,
}));

mock.module("@hously/api/services/qbittorrent/config", () => ({
  getQbittorrentIntegrationConfig: () =>
    Promise.resolve({ enabled: false, config: null }),
}));

mock.module("@hously/api/services/qbittorrent/torrents", () => ({
  fetchQbittorrentMaindataPage: () => Promise.resolve({ torrents: [], rid: 0 }),
  fetchQbittorrentTorrent: () => Promise.resolve({ torrent: null }),
  fetchQbittorrentTorrentProperties: () =>
    Promise.resolve({ properties: null }),
  setQbittorrentTorrentCategory: () => Promise.resolve({ success: true }),
  setQbittorrentTorrentTags: () => Promise.resolve({ success: true }),
  addQbittorrentMagnet: () => Promise.resolve({ success: false }),
  addQbittorrentTorrentFile: () => Promise.resolve({ success: false }),
  deleteQbittorrentTorrent: () => Promise.resolve({ success: true }),
  parseQbittorrentAddResponse: () => ({ ok: false, error: "" }),
}));

const { completeDownloadByHash } =
  await import("@hously/api/workers/checkDownloadCompletion");

describe("completeDownloadByHash", () => {
  beforeEach(() => {
    state.rows = [];
    state.markedComplete = [];
    state.emittedMediaIds = [];
  });

  it("returns null when no DH row matches the hash", async () => {
    const result = await completeDownloadByHash(HASH);
    expect(result).toBeNull();
  });

  it("returns null when the only matching row is failed=true", async () => {
    state.rows.push({
      id: 1,
      torrentHash: HASH,
      completedAt: null,
      failed: true,
      mediaId: 100,
      episodeId: null,
      bookId: null,
      postProcessDestinationPath: null,
    });
    const result = await completeDownloadByHash(HASH);
    expect(result).toBeNull();
  });

  it("marks a pending row complete and returns its id", async () => {
    state.rows.push({
      id: 42,
      torrentHash: HASH,
      completedAt: null,
      failed: false,
      mediaId: 10,
      episodeId: 20,
      bookId: null,
      postProcessDestinationPath: null,
    });
    const result = await completeDownloadByHash(HASH);
    expect(result).toBe(42);
    // emitLibraryUpdate fired for the media
    expect(state.emittedMediaIds).toContain(10);
    // row has completedAt populated
    expect(state.rows[0]?.completedAt).toBeInstanceOf(Date);
  });

  it("returns the id of an already-completed row WITHOUT marking it again (recovery handle)", async () => {
    const alreadyCompletedAt = new Date("2024-01-01T00:00:00Z");
    state.rows.push({
      id: 99,
      torrentHash: HASH,
      completedAt: alreadyCompletedAt,
      failed: false,
      mediaId: 10,
      episodeId: 20,
      bookId: null,
      postProcessDestinationPath: null,
    });
    const result = await completeDownloadByHash(HASH);
    // KEY assertion: the id is returned so the webhook can re-enqueue
    // post-processing even though the row is already complete.
    expect(result).toBe(99);
    // We did NOT touch the existing completedAt timestamp.
    expect(state.rows[0]?.completedAt).toBe(alreadyCompletedAt);
    // And we did NOT re-emit a library update (no work to broadcast).
    expect(state.emittedMediaIds).toEqual([]);
  });

  it("normalizes the hash before matching (uppercase / trailing whitespace)", async () => {
    state.rows.push({
      id: 7,
      torrentHash: HASH,
      completedAt: null,
      failed: false,
      mediaId: 1,
      episodeId: null,
      bookId: null,
      postProcessDestinationPath: null,
    });
    const result = await completeDownloadByHash(`  ${HASH.toUpperCase()}  `);
    expect(result).toBe(7);
  });

  it("returns null for an empty/whitespace-only hash", async () => {
    expect(await completeDownloadByHash("")).toBeNull();
    expect(await completeDownloadByHash("   ")).toBeNull();
  });
});
