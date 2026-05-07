import { describe, it, expect } from "bun:test";
import {
  TrackerHttpError,
  TrackerAuthError,
  isAlertableTrackerError,
} from "./errors";

describe("tracker errors", () => {
  it("TrackerHttpError carries trackerType, status, url", () => {
    const err = new TrackerHttpError("c411", 503, "https://example/api");
    expect(err).toBeInstanceOf(Error);
    expect(err.trackerType).toBe("c411");
    expect(err.status).toBe(503);
    expect(err.url).toBe("https://example/api");
    expect(err.name).toBe("TrackerHttpError");
  });

  it("TrackerAuthError carries trackerType and reason", () => {
    const err = new TrackerAuthError("torr9", "missing token");
    expect(err).toBeInstanceOf(Error);
    expect(err.trackerType).toBe("torr9");
    expect(err.reason).toBe("missing token");
    expect(err.name).toBe("TrackerAuthError");
  });

  it("isAlertableTrackerError narrows on either typed error", () => {
    expect(
      isAlertableTrackerError(new TrackerHttpError("c411", 500, "x")),
    ).toBe(true);
    expect(isAlertableTrackerError(new TrackerAuthError("torr9", "x"))).toBe(
      true,
    );
  });

  it("isAlertableTrackerError returns false on plain Error or non-errors", () => {
    expect(isAlertableTrackerError(new Error("boom"))).toBe(false);
    expect(isAlertableTrackerError("string")).toBe(false);
    expect(isAlertableTrackerError(null)).toBe(false);
    expect(isAlertableTrackerError(undefined)).toBe(false);
  });
});
