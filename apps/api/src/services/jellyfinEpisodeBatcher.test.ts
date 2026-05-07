import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

const sendExternalNotification = mock(
  async (..._args: unknown[]) => true as boolean,
);

mock.module("@hously/api/services/externalNotificationService", () => ({
  sendExternalNotification,
}));

import {
  enqueueJellyfinEpisode,
  __resetBatcherForTests,
  __flushAllForTests,
  __pendingBucketCountForTests,
} from "./jellyfinEpisodeBatcher";

function episode(
  series: string,
  season: number,
  ep: number,
  serverId = "srv1",
  serverName = "MyServer",
) {
  return {
    templateVariables: {
      NotificationType: "ItemAdded",
      Title: `${series} - S${String(season).padStart(2, "0")}E${String(ep).padStart(2, "0")}`,
      SeriesName: series,
      SeasonNumber: String(season),
      EpisodeNumber: String(ep),
      ItemType: "Episode",
      ServerId: serverId,
      ServerName: serverName,
    } as Record<string, string>,
    originalPayload: { series, season, ep } as Record<string, unknown>,
  };
}

describe("jellyfinEpisodeBatcher", () => {
  beforeEach(() => {
    __resetBatcherForTests();
    sendExternalNotification.mockClear();
  });

  afterEach(() => {
    __resetBatcherForTests();
  });

  it("emits a single ItemAdded for one episode after flush", async () => {
    enqueueJellyfinEpisode(episode("Show A", 1, 1));
    expect(__pendingBucketCountForTests()).toBe(1);

    await __flushAllForTests();

    expect(sendExternalNotification).toHaveBeenCalledTimes(1);
    const [service, eventType, payload] = sendExternalNotification.mock
      .calls[0] as [
      string,
      string,
      { template_variables: Record<string, string> },
    ];
    expect(service).toBe("jellyfin");
    expect(eventType).toBe("ItemAdded");
    expect(payload.template_variables.SeriesName).toBe("Show A");
  });

  it("coalesces multiple episodes of the same series into one EpisodeBatchAdded", async () => {
    enqueueJellyfinEpisode(episode("Show A", 1, 1));
    enqueueJellyfinEpisode(episode("Show A", 1, 2));
    enqueueJellyfinEpisode(episode("Show A", 1, 3));
    enqueueJellyfinEpisode(episode("Show A", 1, 4));
    enqueueJellyfinEpisode(episode("Show A", 1, 5));

    expect(__pendingBucketCountForTests()).toBe(1);

    await __flushAllForTests();

    expect(sendExternalNotification).toHaveBeenCalledTimes(1);
    const [, eventType, payload] = sendExternalNotification.mock.calls[0] as [
      string,
      string,
      { template_variables: Record<string, string> },
    ];
    expect(eventType).toBe("EpisodeBatchAdded");
    expect(payload.template_variables.Count).toBe("5");
    expect(payload.template_variables.SeriesName).toBe("Show A");
    expect(payload.template_variables.EpisodeList).toBe(
      "S01E01, S01E02, S01E03, S01E04, S01E05",
    );
  });

  it("uses an episode-range summary when more than 6 episodes", async () => {
    for (let i = 1; i <= 12; i++) {
      enqueueJellyfinEpisode(episode("Big Show", 1, i));
    }

    await __flushAllForTests();

    expect(sendExternalNotification).toHaveBeenCalledTimes(1);
    const [, , payload] = sendExternalNotification.mock.calls[0] as [
      string,
      string,
      { template_variables: Record<string, string> },
    ];
    expect(payload.template_variables.Count).toBe("12");
    expect(payload.template_variables.EpisodeList).toBe(
      "S01E01–S01E12 (12 episodes)",
    );
  });

  it("keeps separate buckets per series", async () => {
    enqueueJellyfinEpisode(episode("Show A", 1, 1));
    enqueueJellyfinEpisode(episode("Show B", 1, 1));
    enqueueJellyfinEpisode(episode("Show A", 1, 2));

    expect(__pendingBucketCountForTests()).toBe(2);

    await __flushAllForTests();

    expect(sendExternalNotification).toHaveBeenCalledTimes(2);
    const seriesNames = (
      sendExternalNotification.mock.calls as unknown as Array<
        [string, string, { template_variables: Record<string, string> }]
      >
    )
      .map((c) => c[2].template_variables.SeriesName)
      .sort();
    expect(seriesNames).toEqual(["Show A", "Show B"]);
  });

  it("keeps separate buckets across servers even with same series name", async () => {
    enqueueJellyfinEpisode(episode("Show A", 1, 1, "srv1"));
    enqueueJellyfinEpisode(episode("Show A", 1, 2, "srv2"));

    expect(__pendingBucketCountForTests()).toBe(2);
  });
});
