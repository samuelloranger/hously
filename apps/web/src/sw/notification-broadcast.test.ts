import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake BroadcastChannel that records every instance created plus the
 * postMessage / close calls, so we can assert the SW reuses one channel and
 * never closes it mid-flight (the root cause of the intermittently-missing
 * in-app notification banner).
 */
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  postMessage = vi.fn();
  close = vi.fn();
  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }
}

async function importFresh() {
  vi.resetModules();
  return import("./notification-broadcast");
}

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("broadcastNotificationEvent", () => {
  it("reuses a single channel across multiple pushes and never closes it", async () => {
    const { broadcastNotificationEvent } = await importFresh();

    broadcastNotificationEvent({ type: "notification-received", a: 1 });
    broadcastNotificationEvent({ type: "notification-received", a: 2 });

    expect(FakeBroadcastChannel.instances).toHaveLength(1);
    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.name).toBe("hously-notification-events");
    expect(channel.postMessage).toHaveBeenCalledTimes(2);
    expect(channel.close).not.toHaveBeenCalled();
  });

  it("delivers the exact payload it is given", async () => {
    const { broadcastNotificationEvent } = await importFresh();
    const payload = { type: "notification-received", notificationData: { title: "Hi" } };

    broadcastNotificationEvent(payload);

    expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith(
      payload,
    );
  });

  it("no-ops safely when BroadcastChannel is unsupported", async () => {
    vi.stubGlobal("BroadcastChannel", undefined as never);
    const { broadcastNotificationEvent, getNotificationChannel } =
      await importFresh();

    expect(getNotificationChannel()).toBeNull();
    expect(() =>
      broadcastNotificationEvent({ type: "notification-received" }),
    ).not.toThrow();
  });
});
