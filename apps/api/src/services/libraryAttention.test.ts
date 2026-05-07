import { describe, expect, it, mock, beforeEach } from "bun:test";

const findFirst = mock(async (..._: unknown[]) => null as unknown);
const create = mock(async (..._: unknown[]) => ({ id: 1 }));
const update = mock(async (..._: unknown[]) => ({ id: 1 }));
const findManyOpen = mock(async (..._: unknown[]) => [] as unknown[]);
const downloadHistoryFindMany = mock(
  async (..._: unknown[]) => [] as unknown[],
);
const libraryMediaFindMany = mock(async (..._: unknown[]) => [] as unknown[]);
const libraryEpisodeFindMany = mock(async (..._: unknown[]) => [] as unknown[]);
const libraryEpisodeCount = mock(async (..._: unknown[]) => 0);
const libraryEpisodeFindUnique = mock(async (..._: unknown[]) => null as unknown);
const libraryMediaFindUnique = mock(async (..._: unknown[]) => null as unknown);
const libraryMediaFindFirst = mock(async (..._: unknown[]) => null as unknown);
const libraryEpisodeFindFirst = mock(async (..._: unknown[]) => null as unknown);
const downloadHistoryFindUnique = mock(async (..._: unknown[]) => null as unknown);

mock.module("@hously/api/db", () => ({
  prisma: {
    libraryAttentionAlert: {
      findFirst,
      create,
      update,
      findMany: findManyOpen,
    },
    downloadHistory: {
      findMany: downloadHistoryFindMany,
      findUnique: downloadHistoryFindUnique,
    },
    libraryMedia: {
      findMany: libraryMediaFindMany,
      findUnique: libraryMediaFindUnique,
      findFirst: libraryMediaFindFirst,
    },
    libraryEpisode: {
      findMany: libraryEpisodeFindMany,
      count: libraryEpisodeCount,
      findUnique: libraryEpisodeFindUnique,
      findFirst: libraryEpisodeFindFirst,
    },
  },
}));

const importLib = async () =>
  await import("@hously/api/services/libraryAttention");

describe("attentionKindPriority", () => {
  it("ranks download_failed above auto_grab_stalled", async () => {
    const { attentionKindPriority } = await importLib();
    expect(attentionKindPriority("download_failed")).toBeLessThan(
      attentionKindPriority("auto_grab_stalled"),
    );
  });
  it("ranks post_process_error above grab_skipped", async () => {
    const { attentionKindPriority } = await importLib();
    expect(attentionKindPriority("post_process_error")).toBeLessThan(
      attentionKindPriority("grab_skipped"),
    );
  });
});

describe("inferSeasonFromReleaseTitle", () => {
  it("parses S02 from dotted release name", async () => {
    const { inferSeasonFromReleaseTitle } = await importLib();
    expect(inferSeasonFromReleaseTitle("Some.Show.S02E05.1080p")).toBe(2);
  });
  it("parses season word form", async () => {
    const { inferSeasonFromReleaseTitle } = await importLib();
    expect(inferSeasonFromReleaseTitle("Some Show Season 3 WEB")).toBe(3);
  });
  it("returns null when absent", async () => {
    const { inferSeasonFromReleaseTitle } = await importLib();
    expect(inferSeasonFromReleaseTitle("Movie.Name.2024.1080p")).toBeNull();
  });
});

describe("syncLibraryAttentionAlerts state machine", () => {
  beforeEach(() => {
    findFirst.mockClear();
    create.mockClear();
    update.mockClear();
    findManyOpen.mockClear();
    downloadHistoryFindMany.mockClear();
    libraryMediaFindMany.mockClear();
    libraryEpisodeFindMany.mockClear();
    libraryEpisodeCount.mockClear();
    libraryEpisodeFindUnique.mockClear();
    libraryMediaFindUnique.mockClear();
    libraryMediaFindFirst.mockClear();
    libraryEpisodeFindFirst.mockClear();
    downloadHistoryFindUnique.mockClear();

    downloadHistoryFindMany.mockImplementation(async () => []);
    libraryMediaFindMany.mockImplementation(async () => []);
    libraryEpisodeFindMany.mockImplementation(async () => []);
    findManyOpen.mockImplementation(async () => []);
    findFirst.mockImplementation(async () => null);
  });

  it("creates a new alert when none exists for the candidate", async () => {
    libraryMediaFindMany.mockImplementationOnce(async () => [
      {
        id: 7,
        title: "Skipped Movie",
        type: "movie",
        searchAttempts: 3,
        status: "skipped",
      },
    ]);

    const { syncLibraryAttentionAlerts } = await importLib();
    const r = await syncLibraryAttentionAlerts();

    expect(create).toHaveBeenCalledTimes(1);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
  });

  it("updates an existing open alert instead of creating a duplicate", async () => {
    libraryMediaFindMany.mockImplementationOnce(async () => [
      {
        id: 7,
        title: "Skipped Movie",
        type: "movie",
        searchAttempts: 3,
        status: "skipped",
      },
    ]);
    findFirst.mockImplementationOnce(async () => ({ id: 42 }));

    const { syncLibraryAttentionAlerts } = await importLib();
    const r = await syncLibraryAttentionAlerts();

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(r.created).toBe(0);
    expect(r.updated).toBe(1);
  });

  it("auto-resolves an open alert whose underlying condition is no longer true", async () => {
    findManyOpen.mockImplementationOnce(async () => [
      {
        id: 99,
        kind: "grab_skipped",
        scopeType: "movie",
        mediaId: 7,
        episodeId: null,
        season: null,
        downloadHistoryId: null,
      },
    ]);
    libraryMediaFindUnique.mockImplementationOnce(async () => ({
      status: "wanted",
    }));

    const { syncLibraryAttentionAlerts } = await importLib();
    const r = await syncLibraryAttentionAlerts();

    const resolveCall = update.mock.calls.find(
      (c) =>
        (c[0] as { where: { id: number } }).where.id === 99 &&
        ((c[0] as { data: { status?: string } }).data.status ===
          "resolved_auto"),
    );
    expect(resolveCall).toBeDefined();
    expect(r.resolved).toBe(1);
  });

  it("skips show-level DH whose release title has no parseable season", async () => {
    downloadHistoryFindMany.mockImplementationOnce(async () => [
      {
        id: 1,
        mediaId: 5,
        episodeId: null,
        releaseTitle: "Some Pack Without Season",
        grabbedAt: new Date(),
        failReason: "x",
        postProcessError: null,
        failed: true,
        completedAt: null,
        media: { id: 5, title: "Show", type: "show", status: "wanted" },
        episode: null,
      },
    ]);

    const { syncLibraryAttentionAlerts } = await importLib();
    const r = await syncLibraryAttentionAlerts();

    expect(create).not.toHaveBeenCalled();
    expect(r.created).toBe(0);
  });

  it("includes capped (>= MAX_CRON_GRAB_ATTEMPTS) items as auto_grab_stalled", async () => {
    libraryMediaFindMany
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async (args: unknown) => {
        const a = args as {
          where: { searchAttempts?: { gte?: number; lt?: number } };
        };
        const lt = a.where.searchAttempts?.lt;
        const gte = a.where.searchAttempts?.gte ?? 0;
        return [
          {
            id: 9,
            title: "Stuck Movie",
            type: "movie",
            searchAttempts: lt == null ? 30 : Math.min(30, lt - 1),
            status: "wanted",
          },
        ].filter((m) => m.searchAttempts >= gte);
      });

    const { syncLibraryAttentionAlerts } = await importLib();
    const r = await syncLibraryAttentionAlerts();

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0] as {
      data: { kind: string; mediaId: number };
    };
    expect(args.data.kind).toBe("auto_grab_stalled");
    expect(args.data.mediaId).toBe(9);
    expect(r.created).toBe(1);
  });
});
