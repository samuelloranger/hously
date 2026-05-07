import {
  JELLYFIN_PLAYBACK_PROGRESS_PATH,
  JELLYFIN_PLAYBACK_STARTED_PATH,
  JELLYFIN_PLAYBACK_STOPPED_PATH,
} from "@hously/shared";

const TICKS_PER_SECOND = 10_000_000;

export const secondsToTicks = (seconds: number): number =>
  Math.max(0, Math.floor(seconds * TICKS_PER_SECOND));

export const ticksToSeconds = (ticks: number): number =>
  Math.max(0, ticks / TICKS_PER_SECOND);

export type SessionFetcher = <T = unknown>(
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
    headers?: Record<string, string>;
  },
) => Promise<T>;

interface ReportArgs {
  fetcher: SessionFetcher;
  itemId: string;
  positionTicks: number;
  isPaused?: boolean;
}

export async function reportPlaybackStarted({
  fetcher,
  itemId,
  positionTicks,
  isPaused,
}: ReportArgs): Promise<void> {
  try {
    await fetcher(JELLYFIN_PLAYBACK_STARTED_PATH, {
      method: "POST",
      body: {
        item_id: itemId,
        position_ticks: positionTicks,
        is_paused: !!isPaused,
      },
    });
  } catch (e) {
    console.warn("[jellyfin] session report failed", e);
  }
}

export async function reportPlaybackProgress({
  fetcher,
  itemId,
  positionTicks,
  isPaused,
}: ReportArgs): Promise<void> {
  try {
    await fetcher(JELLYFIN_PLAYBACK_PROGRESS_PATH, {
      method: "POST",
      body: {
        item_id: itemId,
        position_ticks: positionTicks,
        is_paused: !!isPaused,
      },
    });
  } catch (e) {
    console.warn("[jellyfin] session report failed", e);
  }
}

export async function reportPlaybackStopped({
  fetcher,
  itemId,
  positionTicks,
}: ReportArgs): Promise<void> {
  try {
    await fetcher(JELLYFIN_PLAYBACK_STOPPED_PATH, {
      method: "POST",
      body: {
        item_id: itemId,
        position_ticks: positionTicks,
      },
    });
  } catch (e) {
    console.warn("[jellyfin] session report failed", e);
  }
}
