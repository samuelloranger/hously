import type { TrackerType } from "@hously/api/utils/integrations/types";
import { getJsonCache, setJsonCache } from "@hously/api/services/cache";
import {
  TrackerHttpError,
  TrackerAuthError,
  isAlertableTrackerError,
} from "@hously/api/services/trackers/errors";
import {
  trackerLabel,
  trackerHttpStatusMessage,
} from "@hously/api/services/trackers/labels";
import { getAdminUserIds } from "@hously/api/utils/admins";
import { createAndQueueNotification } from "@hously/api/workers/notificationService";
import { sendExternalNotification } from "@hously/api/services/externalNotificationService";

const STATE_TTL_SECONDS = 365 * 24 * 60 * 60;

type FailureClass = "http" | "auth";

type TrackerHealthState =
  | { state: "up"; since: string }
  | {
      state: "down";
      since: string;
      last_failure: {
        kind: FailureClass;
        status?: number;
        message: string;
      };
    };

const stateKey = (type: TrackerType): string => `tracker:health:${type}`;

function classifyFailure(error: TrackerHttpError | TrackerAuthError): {
  kind: FailureClass;
  status?: number;
  message: string;
  bodyText: string;
} {
  if (error instanceof TrackerHttpError) {
    return {
      kind: "http",
      status: error.status,
      message: error.message,
      bodyText: trackerHttpStatusMessage(error.status),
    };
  }
  return {
    kind: "auth",
    message: error.reason,
    bodyText: "Authentication or page parsing failed",
  };
}

function pluralUnit(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function humanizeDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "less than a minute";
  if (totalMinutes < 60) return pluralUnit(totalMinutes, "minute");

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes === 0
      ? pluralUnit(totalHours, "hour")
      : `${pluralUnit(totalHours, "hour")} ${pluralUnit(minutes, "minute")}`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0
    ? pluralUnit(days, "day")
    : `${pluralUnit(days, "day")} ${pluralUnit(hours, "hour")}`;
}

async function fanOutToAdmins(
  title: string,
  body: string,
  notificationType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const adminIds = await getAdminUserIds();
  for (const userId of adminIds) {
    await createAndQueueNotification(
      userId,
      title,
      body,
      notificationType,
      undefined,
      metadata,
    );
  }
}

async function notifyDown(
  trackerType: TrackerType,
  failure: ReturnType<typeof classifyFailure>,
  since: string,
): Promise<void> {
  const label = trackerLabel(trackerType);
  const title = `Tracker ${label} unavailable`;
  const body = failure.bodyText;
  const metadata = {
    tracker: trackerType,
    kind: failure.kind,
    status: failure.status,
    since,
  };

  await fanOutToAdmins(title, body, "tracker-down", metadata);
  await sendExternalNotification(
    "hously",
    "TrackerDown",
    {
      template_variables: {
        tracker: label,
        kind: failure.kind,
        status: failure.status?.toString() ?? "",
        message: failure.bodyText,
      },
      original_payload: {
        event: "TrackerDown",
        tracker: trackerType,
        since,
        ...failure,
      },
    },
    "en",
  );
}

async function notifyUp(
  trackerType: TrackerType,
  recoveredAt: string,
  downtimeMs: number,
): Promise<void> {
  const label = trackerLabel(trackerType);
  const title = `Tracker ${label} back online`;
  const body = `Stats refreshed after ${humanizeDuration(downtimeMs)}`;
  const metadata = {
    tracker: trackerType,
    recovered_at: recoveredAt,
    downtime_ms: downtimeMs,
  };

  await fanOutToAdmins(title, body, "tracker-up", metadata);
  await sendExternalNotification(
    "hously",
    "TrackerUp",
    {
      template_variables: {
        tracker: label,
        downtime: humanizeDuration(downtimeMs),
      },
      original_payload: {
        event: "TrackerUp",
        tracker: trackerType,
        recovered_at: recoveredAt,
        downtime_ms: downtimeMs,
      },
    },
    "en",
  );
}

export async function recordSuccess(trackerType: TrackerType): Promise<void> {
  const now = new Date().toISOString();
  const prior = await getJsonCache<TrackerHealthState>(stateKey(trackerType));

  if (prior?.state === "down") {
    const downtimeMs = Math.max(0, Date.parse(now) - Date.parse(prior.since));
    await notifyUp(trackerType, now, downtimeMs);
    await setJsonCache(
      stateKey(trackerType),
      { state: "up", since: now } satisfies TrackerHealthState,
      STATE_TTL_SECONDS,
    );
    return;
  }

  if (!prior) {
    await setJsonCache(
      stateKey(trackerType),
      { state: "up", since: now } satisfies TrackerHealthState,
      STATE_TTL_SECONDS,
    );
  }
  // up → up: silent, no write
}

export async function recordFailure(
  trackerType: TrackerType,
  error: unknown,
): Promise<void> {
  if (!isAlertableTrackerError(error)) return;

  const now = new Date().toISOString();
  const prior = await getJsonCache<TrackerHealthState>(stateKey(trackerType));

  if (prior?.state === "down") {
    return; // already down, silent
  }

  const failure = classifyFailure(error);
  await notifyDown(trackerType, failure, now);
  const next: TrackerHealthState = {
    state: "down",
    since: now,
    last_failure: {
      kind: failure.kind,
      status: failure.status,
      message: failure.message,
    },
  };
  await setJsonCache(stateKey(trackerType), next, STATE_TTL_SECONDS);
}
