import type { TrackerType } from "@hously/api/utils/integrations/types";

export class TrackerHttpError extends Error {
  readonly trackerType: TrackerType;
  readonly status: number;
  readonly url: string;

  constructor(trackerType: TrackerType, status: number, url: string) {
    super(`${trackerType} tracker returned HTTP ${status} from ${url}`);
    this.name = "TrackerHttpError";
    this.trackerType = trackerType;
    this.status = status;
    this.url = url;
  }
}

export class TrackerAuthError extends Error {
  readonly trackerType: TrackerType;
  readonly reason: string;

  constructor(trackerType: TrackerType, reason: string) {
    super(`${trackerType} tracker auth/parse failure: ${reason}`);
    this.name = "TrackerAuthError";
    this.trackerType = trackerType;
    this.reason = reason;
  }
}

export function isAlertableTrackerError(
  error: unknown,
): error is TrackerHttpError | TrackerAuthError {
  return error instanceof TrackerHttpError || error instanceof TrackerAuthError;
}
