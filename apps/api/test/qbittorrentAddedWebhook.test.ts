import { describe, it, expect, beforeEach, mock } from "bun:test";

// Regression test for /qbittorrent/added candidate filtering.
//
// Pre-fix: the title-match candidate query filtered libraryMedia by
// `status IN ('wanted','downloading')`. Once a series had any episode
// imported the show row flipped to `downloaded` — and from then on every new
// episode torrent that landed in qBit was logged as "No library match",
// silently dropping the download from Hously's tracking pipeline.
//
// Post-fix: shows are matched regardless of media status; movies still keep
// the status filter (one-shot, no follow-up episodes).

const SHOW_HASH = "a".repeat(40);
const MOVIE_HASH = "b".repeat(40);

type MediaRow = {
  id: number;
  title: string;
  type: "movie" | "show";
  status: string;
  qualityProfileId: number | null;
};

const state: {
  media: MediaRow[];
  episodes: Array<{ id: number; mediaId: number; status: string }>;
  downloadHistories: Array<{
    id: number;
    torrentHash: string | null;
    mediaId: number | null;
  }>;
  qbTorrents: Record<string, { name: string; category: string; tags: string }>;
  lastCandidateWhere: Record<string, unknown> | null;
  createdDh: Array<Record<string, unknown>>;
  mediaUpdates: Array<{ id: number; data: Record<string, unknown> }>;
  episodeUpdateManyArgs: Record<string, unknown> | null;
} = {
  media: [],
  episodes: [],
  downloadHistories: [],
  qbTorrents: {},
  lastCandidateWhere: null,
  createdDh: [],
  mediaUpdates: [],
  episodeUpdateManyArgs: null,
};

const WEBHOOK_SECRET = "test-secret-123";

mock.module("@hously/api/db", () => ({
  prisma: {
    libraryMedia: {
      findMany: ({ where }: { where: Record<string, unknown> }) => {
        state.lastCandidateWhere = where;
        return Promise.resolve(
          state.media.filter((m) => {
            if (where.type && m.type !== where.type) return false;
            const statusFilter = where.status as { in?: string[] } | undefined;
            if (
              statusFilter &&
              Array.isArray(statusFilter.in) &&
              !statusFilter.in.includes(m.status)
            ) {
              return false;
            }
            return true;
          }),
        );
      },
      update: ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        state.mediaUpdates.push({ id: where.id, data });
        return Promise.resolve({});
      },
    },
    libraryEpisode: {
      updateMany: (args: Record<string, unknown>) => {
        state.episodeUpdateManyArgs = args;
        return Promise.resolve({ count: state.episodes.length });
      },
    },
    libraryBook: {
      findMany: () => Promise.resolve([]),
      update: () => Promise.resolve({}),
    },
    downloadHistory: {
      findFirst: ({ where }: { where: { torrentHash?: string } }) => {
        const match = state.downloadHistories.find(
          (d) => d.torrentHash === where.torrentHash,
        );
        return Promise.resolve(match ?? null);
      },
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: state.createdDh.length + 1000, ...data };
        state.createdDh.push(row);
        return Promise.resolve(row);
      },
    },
  },
}));

mock.module("@hously/api/services/qbittorrent/config", () => ({
  getQbittorrentIntegrationConfig: () =>
    Promise.resolve({
      enabled: true,
      config: { webhook_secret: WEBHOOK_SECRET },
    }),
}));

mock.module("@hously/api/services/qbittorrent/client", () => ({
  qbFetchJson: (_cfg: unknown, url: string): Promise<unknown> => {
    // Expect /api/v2/torrents/info?hashes=<hash>
    const m = url.match(/hashes=([a-f0-9]+)/i);
    if (!m) return Promise.resolve([]);
    const hash = m[1]!.toLowerCase();
    const t = state.qbTorrents[hash];
    return Promise.resolve(
      t ? [{ name: t.name, category: t.category, tags: t.tags }] : [],
    );
  },
}));

// Heavy graph trims — nothing downstream is exercised in these tests.
mock.module("@hously/api/services/webhookHandlers", () => ({
  webhookHandlers: {},
}));
mock.module("@hously/api/services/webhookEnrichment", () => ({
  enrichArrWebhookNotification: () => Promise.resolve(null),
}));
mock.module("@hously/api/services/externalNotificationService", () => ({
  sendExternalNotification: () => Promise.resolve(undefined),
}));
mock.module("@hously/api/services/jellyfinEpisodeBatcher", () => ({
  enqueueJellyfinEpisode: () => undefined,
}));
mock.module("@hously/api/services/cache", () => ({
  deleteCache: () => Promise.resolve(undefined),
}));
mock.module("@hously/api/workers/checkDownloadCompletion", () => ({
  completeDownloadByHash: () => Promise.resolve(null),
}));
mock.module("@hously/api/services/postProcessor", () => ({
  enqueueLibraryPostProcess: () => undefined,
}));

const { webhooksRoutes } = await import("@hously/api/routes/webhooks");

async function fireAdded(hash: string): Promise<Response> {
  const req = new Request(
    `http://localhost/api/webhooks/qbittorrent/added?hash=${hash}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    },
  );
  return webhooksRoutes.handle(req);
}

describe("/qbittorrent/added candidate filter", () => {
  beforeEach(() => {
    state.media = [];
    state.episodes = [];
    state.downloadHistories = [];
    state.qbTorrents = {};
    state.lastCandidateWhere = null;
    state.createdDh = [];
    state.mediaUpdates = [];
    state.episodeUpdateManyArgs = null;
  });

  it("matches a NEW episode torrent for a show whose status is already 'downloaded'", async () => {
    // Show row already flipped to 'downloaded' after an earlier episode
    // landed; a new episode torrent arrives. Pre-fix this returned
    // matched=false ("No library match").
    state.media.push({
      id: 1,
      title: "Example Show",
      type: "show",
      status: "downloaded",
      qualityProfileId: 1,
    });
    state.qbTorrents[SHOW_HASH] = {
      name: "Example.Show.S01E02.1080p.WEB.x264-GROUP",
      category: "hously-shows",
      tags: "",
    };

    const res = await fireAdded(SHOW_HASH);
    const body = (await res.json()) as { matched: boolean };
    expect(res.status).toBe(200);
    expect(body.matched).toBe(true);

    // The candidate query for SHOWS must not constrain status.
    expect(state.lastCandidateWhere).toEqual({ type: "show" });

    // A DH row was created and the show was flipped to downloading.
    expect(state.createdDh).toHaveLength(1);
    expect(state.mediaUpdates).toEqual([
      { id: 1, data: { status: "downloading" } },
    ]);
    expect(state.episodeUpdateManyArgs).not.toBeNull();
  });

  it("keeps the status filter for MOVIES (one-shot — no follow-up episodes)", async () => {
    state.media.push({
      id: 2,
      title: "Example Movie",
      type: "movie",
      status: "downloaded",
      qualityProfileId: 1,
    });
    state.qbTorrents[MOVIE_HASH] = {
      name: "Example.Movie.2024.1080p.BluRay.x264-GROUP",
      category: "hously-movies",
      tags: "",
    };

    const res = await fireAdded(MOVIE_HASH);
    const body = (await res.json()) as { matched: boolean; reason?: string };
    expect(res.status).toBe(200);
    // Movie with status='downloaded' must NOT match (filter still applies).
    expect(body.matched).toBe(false);

    expect(state.lastCandidateWhere).toEqual({
      type: "movie",
      status: { in: ["wanted", "downloading"] },
    });
    expect(state.createdDh).toHaveLength(0);
  });

  it("short-circuits when an existing DH already tracks the hash", async () => {
    state.downloadHistories.push({
      id: 42,
      torrentHash: SHOW_HASH,
      mediaId: 1,
    });
    state.qbTorrents[SHOW_HASH] = {
      name: "Example.Show.S01E02.1080p.WEB.x264-GROUP",
      category: "hously-shows",
      tags: "",
    };

    const res = await fireAdded(SHOW_HASH);
    const body = (await res.json()) as {
      matched: boolean;
      reason?: string;
      download_history_id?: number;
    };
    expect(res.status).toBe(200);
    expect(body.matched).toBe(true);
    expect(body.reason).toBe("Already tracked");
    expect(body.download_history_id).toBe(42);
    // No new DH row, no candidate query.
    expect(state.createdDh).toHaveLength(0);
    expect(state.lastCandidateWhere).toBeNull();
  });
});
