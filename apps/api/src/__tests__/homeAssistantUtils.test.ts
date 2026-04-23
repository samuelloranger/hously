import { describe, expect, it } from "bun:test";
import {
  haDomainFromEntityId,
  haServiceNameForAction,
  normalizeHaBaseUrl,
} from "@hously/api/utils/integrations/homeAssistantUtils";

describe("homeAssistantUtils", () => {
  it("normalizes base URL", () => {
    expect(normalizeHaBaseUrl(" https://ha:8123/ ")).toBe("https://ha:8123");
  });

  it("parses entity domains", () => {
    expect(haDomainFromEntityId("light.kitchen")).toBe("light");
    expect(haDomainFromEntityId("switch.plug")).toBe("switch");
    expect(haDomainFromEntityId("sensor.x")).toBeNull();
    expect(haDomainFromEntityId("invalid")).toBeNull();
  });

  it("maps actions to HA services", () => {
    expect(haServiceNameForAction("on")).toBe("turn_on");
    expect(haServiceNameForAction("off")).toBe("turn_off");
    expect(haServiceNameForAction("toggle")).toBe("toggle");
  });
});
