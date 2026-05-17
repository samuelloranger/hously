import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TrackerHttpError, TrackerAuthError } from "./trackers/errors";

const getJsonCache = mock(async (_key: string) => null as unknown);
const setJsonCache = mock(
  async (_key: string, _value: unknown, _ttl: number) => undefined,
);
const deleteCache = mock(async (_key: string) => undefined);
const getAdminUserIds = mock(async () => ["admin-1", "admin-2"] as string[]);
const createAndQueueNotification = mock(
  async (
    _userId: string,
    _title: string,
    _body: string,
    _type: string,
    _url?: string,
    _meta?: Record<string, unknown>,
  ) => true,
);
const sendExternalNotification = mock(
  async (
    _serviceName: string,
    _eventType: string,
    _payload: Record<string, unknown>,
    _language?: string,
  ) => true,
);

mock.module("@hously/api/services/cache", () => ({
  getJsonCache,
  setJsonCache,
  deleteCache,
}));
mock.module("@hously/api/utils/admins", () => ({
  getAdminUserIds,
}));
mock.module("@hously/api/workers/notificationService", () => ({
  createAndQueueNotification,
}));
mock.module("@hously/api/services/externalNotificationService", () => ({
  sendExternalNotification,
}));

const importHealth = async () => await import("./trackerHealth");

describe("humanizeDuration", () => {
  it.each([
    [0, "less than a minute"],
    [30_000, "less than a minute"],
    [60_000, "1 minute"],
    [5 * 60_000, "5 minutes"],
    [60 * 60_000, "1 hour"],
    [90 * 60_000, "1 hour 30 minutes"],
    [125 * 60_000, "2 hours 5 minutes"],
    [24 * 60 * 60_000, "1 day"],
    [25 * 60 * 60_000, "1 day 1 hour"],
    [50 * 60 * 60_000, "2 days 2 hours"],
  ])("%d ms → %s", async (ms, expected) => {
    const { humanizeDuration } = await import("./trackerHealth");
    expect(humanizeDuration(ms)).toBe(expected);
  });
});

describe("trackerHealth.recordSuccess", () => {
  beforeEach(() => {
    getJsonCache.mockClear();
    setJsonCache.mockClear();
    getAdminUserIds.mockClear();
    createAndQueueNotification.mockClear();
    sendExternalNotification.mockClear();
  });

  it("absent → up: writes state, no notifications", async () => {
    getJsonCache.mockImplementationOnce(async () => null);

    const { recordSuccess } = await importHealth();
    await recordSuccess("c411");

    expect(setJsonCache).toHaveBeenCalledTimes(1);
    expect(createAndQueueNotification).not.toHaveBeenCalled();
    expect(sendExternalNotification).not.toHaveBeenCalled();
  });

  it("up → up: no write, no notifications", async () => {
    getJsonCache.mockImplementationOnce(async () => ({
      state: "up",
      since: "2026-01-01T00:00:00Z",
    }));

    const { recordSuccess } = await importHealth();
    await recordSuccess("c411");

    expect(setJsonCache).not.toHaveBeenCalled();
    expect(createAndQueueNotification).not.toHaveBeenCalled();
    expect(sendExternalNotification).not.toHaveBeenCalled();
  });

  it("down → up: writes state and fires recovery to all admins + external", async () => {
    const since = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    getJsonCache.mockImplementationOnce(async () => ({
      state: "down",
      since,
      last_failure: { kind: "http", status: 503, message: "oops" },
    }));

    const { recordSuccess } = await importHealth();
    await recordSuccess("c411");

    expect(setJsonCache).toHaveBeenCalledTimes(1);
    expect(getAdminUserIds).toHaveBeenCalledTimes(1);
    expect(createAndQueueNotification).toHaveBeenCalledTimes(2);
    const firstCall = createAndQueueNotification.mock.calls[0];
    expect(firstCall?.[0]).toBe("admin-1");
    expect(firstCall?.[1]).toBe("Tracker C411 back online");
    expect(firstCall?.[3]).toBe("tracker-up");
    expect(sendExternalNotification).toHaveBeenCalledTimes(1);
    expect(sendExternalNotification.mock.calls[0]?.[1]).toBe("TrackerUp");
  });
});

describe("trackerHealth.recordFailure", () => {
  beforeEach(() => {
    getJsonCache.mockClear();
    setJsonCache.mockClear();
    getAdminUserIds.mockClear();
    createAndQueueNotification.mockClear();
    sendExternalNotification.mockClear();
  });

  it("non-alertable error: no write, no notifications, no Redis read", async () => {
    const { recordFailure } = await importHealth();
    await recordFailure("c411", new Error("flaresolverr down"));

    expect(getJsonCache).not.toHaveBeenCalled();
    expect(setJsonCache).not.toHaveBeenCalled();
    expect(createAndQueueNotification).not.toHaveBeenCalled();
    expect(sendExternalNotification).not.toHaveBeenCalled();
  });

  it("absent + TrackerHttpError: writes down state, fires down notification", async () => {
    getJsonCache.mockImplementationOnce(async () => null);

    const { recordFailure } = await importHealth();
    await recordFailure(
      "torr9",
      new TrackerHttpError("torr9", 503, "https://x"),
    );

    expect(setJsonCache).toHaveBeenCalledTimes(1);
    const writtenState = setJsonCache.mock.calls[0]?.[1] as {
      state: string;
      last_failure: { kind: string; status: number };
    };
    expect(writtenState.state).toBe("down");
    expect(writtenState.last_failure.kind).toBe("http");
    expect(writtenState.last_failure.status).toBe(503);

    expect(createAndQueueNotification).toHaveBeenCalledTimes(2);
    const firstCall = createAndQueueNotification.mock.calls[0];
    expect(firstCall?.[1]).toBe("Tracker Torr9 unavailable");
    expect(firstCall?.[2]).toBe("Tracker unavailable (maintenance)");
    expect(firstCall?.[3]).toBe("tracker-down");

    expect(sendExternalNotification).toHaveBeenCalledTimes(1);
    expect(sendExternalNotification.mock.calls[0]?.[1]).toBe("TrackerDown");
  });

  it("up + TrackerAuthError: writes down state, fires down with auth body", async () => {
    getJsonCache.mockImplementationOnce(async () => ({
      state: "up",
      since: "2026-01-01T00:00:00Z",
    }));

    const { recordFailure } = await importHealth();
    await recordFailure(
      "la-cale",
      new TrackerAuthError("la-cale", "missing token"),
    );

    expect(setJsonCache).toHaveBeenCalledTimes(1);
    const firstCall = createAndQueueNotification.mock.calls[0];
    expect(firstCall?.[1]).toBe("Tracker La Cale unavailable");
    expect(firstCall?.[2]).toBe("Authentication or page parsing failed");
  });

  it("down + alertable error: silent, no write, no notifications", async () => {
    getJsonCache.mockImplementationOnce(async () => ({
      state: "down",
      since: "2026-01-01T00:00:00Z",
      last_failure: { kind: "http", status: 503, message: "x" },
    }));

    const { recordFailure } = await importHealth();
    await recordFailure("c411", new TrackerHttpError("c411", 502, "https://x"));

    expect(setJsonCache).not.toHaveBeenCalled();
    expect(createAndQueueNotification).not.toHaveBeenCalled();
    expect(sendExternalNotification).not.toHaveBeenCalled();
  });

  it("uses fallback message for unknown HTTP status codes", async () => {
    getJsonCache.mockImplementationOnce(async () => null);

    const { recordFailure } = await importHealth();
    await recordFailure("c411", new TrackerHttpError("c411", 418, "https://x"));

    const firstCall = createAndQueueNotification.mock.calls[0];
    expect(firstCall?.[2]).toBe("HTTP 418 from tracker");
  });
});
