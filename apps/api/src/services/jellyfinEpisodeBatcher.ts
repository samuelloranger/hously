import { sendExternalNotification } from "@hously/api/services/externalNotificationService";

export interface JellyfinEpisodeEvent {
  templateVariables: Record<string, string>;
  originalPayload: Record<string, unknown>;
  notificationUrl?: string;
  notificationMetadata?: Record<string, unknown>;
}

interface BatchBucket {
  seriesName: string;
  serverName: string;
  serverUrl?: string;
  events: JellyfinEpisodeEvent[];
  firstSeenAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_DEBOUNCE_MS = 3 * 60 * 1000;
const MAX_EPISODES_PER_BATCH = 200;

const debounceMs = (() => {
  const raw = process.env.JELLYFIN_EPISODE_BATCH_MS;
  if (!raw) return DEFAULT_DEBOUNCE_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEBOUNCE_MS;
  return parsed;
})();

const buckets = new Map<string, BatchBucket>();

function bucketKeyFor(vars: Record<string, string>): string {
  const series = (vars.SeriesName || "").trim();
  const serverId = (vars.ServerId || "").trim();
  if (series) return `${serverId}::series::${series}`;
  // Fallback: treat as an unbatchable single event keyed by ItemId
  return `${serverId}::item::${vars.ItemId || Math.random().toString(36)}`;
}

function formatEpisodeRange(events: JellyfinEpisodeEvent[]): string {
  const tokens = events
    .map((e) => {
      const s = (e.templateVariables.SeasonNumber || "").padStart(2, "0");
      const ep = (e.templateVariables.EpisodeNumber || "").padStart(2, "0");
      if (!s || !ep) return null;
      return `S${s}E${ep}`;
    })
    .filter((t): t is string => Boolean(t));

  const unique = Array.from(new Set(tokens)).sort();
  if (unique.length === 0) return "";
  if (unique.length <= 6) return unique.join(", ");
  return `${unique[0]}–${unique[unique.length - 1]} (${unique.length} episodes)`;
}

async function flushBucket(key: string): Promise<void> {
  const bucket = buckets.get(key);
  if (!bucket) return;
  buckets.delete(key);
  clearTimeout(bucket.timer);

  const { events } = bucket;
  if (events.length === 0) return;

  // Single episode: re-use the standard ItemAdded template
  if (events.length === 1) {
    const ev = events[0];
    try {
      await sendExternalNotification(
        "jellyfin",
        "ItemAdded",
        {
          template_variables: ev.templateVariables,
          original_payload: ev.originalPayload,
          notification_url: ev.notificationUrl,
          notification_metadata: ev.notificationMetadata,
        },
        "en",
      );
    } catch (error) {
      console.error("[jellyfinEpisodeBatcher] flush single failed:", error);
    }
    return;
  }

  // 2+ episodes: emit batched event
  const last = events[events.length - 1];
  const episodeList = formatEpisodeRange(events);
  const variables: Record<string, string> = {
    ...last.templateVariables,
    Count: String(events.length),
    EpisodeList: episodeList,
    SeriesName: bucket.seriesName,
    ServerName: bucket.serverName,
  };

  try {
    await sendExternalNotification(
      "jellyfin",
      "EpisodeBatchAdded",
      {
        template_variables: variables,
        original_payload: {
          batched: true,
          count: events.length,
          series_name: bucket.seriesName,
          payloads: events.map((e) => e.originalPayload),
        },
        notification_url: last.notificationUrl,
        notification_metadata: {
          ...(last.notificationMetadata ?? {}),
          batched: true,
          count: events.length,
        },
      },
      "en",
    );
  } catch (error) {
    console.error("[jellyfinEpisodeBatcher] flush batch failed:", error);
  }
}

export function enqueueJellyfinEpisode(event: JellyfinEpisodeEvent): void {
  const key = bucketKeyFor(event.templateVariables);
  const existing = buckets.get(key);

  if (existing) {
    existing.events.push(event);
    clearTimeout(existing.timer);

    if (existing.events.length >= MAX_EPISODES_PER_BATCH) {
      void flushBucket(key);
      return;
    }

    existing.timer = setTimeout(() => {
      void flushBucket(key);
    }, debounceMs);
    return;
  }

  const bucket: BatchBucket = {
    seriesName:
      event.templateVariables.SeriesName?.trim() ||
      event.templateVariables.Title ||
      "Unknown",
    serverName: event.templateVariables.ServerName?.trim() || "Jellyfin Server",
    serverUrl: event.templateVariables.ServerUrl,
    events: [event],
    firstSeenAt: Date.now(),
    timer: setTimeout(() => {
      void flushBucket(key);
    }, debounceMs),
  };
  buckets.set(key, bucket);
}

// Test-only helpers
export function __resetBatcherForTests(): void {
  for (const bucket of buckets.values()) {
    clearTimeout(bucket.timer);
  }
  buckets.clear();
}

export function __flushAllForTests(): Promise<void> {
  const keys = Array.from(buckets.keys());
  return Promise.all(keys.map((k) => flushBucket(k))).then(() => undefined);
}

export function __pendingBucketCountForTests(): number {
  return buckets.size;
}
