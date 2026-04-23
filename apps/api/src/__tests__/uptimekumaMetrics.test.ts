import { describe, expect, test } from "bun:test";
import {
  parseMonitorStatus,
  summariseMonitors,
  type UptimekumaMonitor,
} from "../utils/integrations/uptimekuma";

const SAMPLE = `
# HELP monitor_cert_is_valid Is the certificate still valid? (1 = Yes, 0= No)
# TYPE monitor_cert_is_valid gauge
monitor_cert_is_valid{monitor_id="1",monitor_name="HA"} 1

# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)
# TYPE monitor_status gauge
monitor_status{monitor_id="1",monitor_name="HomeAssistant",monitor_type="docker",monitor_url="https://",monitor_hostname="null",monitor_port="null"} 1
monitor_status{monitor_id="2",monitor_name="Jellyfin",monitor_type="http",monitor_url="http://jf:8096",monitor_hostname="null",monitor_port="null"} 0
monitor_status{monitor_id="3",monitor_name="Pending",monitor_type="http",monitor_url="null",monitor_hostname="null",monitor_port="null"} 2
monitor_status{monitor_id="4",monitor_name="Maint",monitor_type="http",monitor_url="",monitor_hostname="null",monitor_port="null"} 3
monitor_status{monitor_id="5",monitor_name="Weird",monitor_type="http",monitor_url="http://ok",monitor_hostname="null",monitor_port="null"} 9
`;

describe("parseMonitorStatus", () => {
  test("ignores comments, non-status metrics and empty lines", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    expect(monitors).toHaveLength(5);
  });

  test("maps status codes to string statuses; unknown codes become pending", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    const byId = Object.fromEntries(monitors.map((m) => [m.id, m.status]));
    expect(byId["1"]).toBe("up");
    expect(byId["2"]).toBe("down");
    expect(byId["3"]).toBe("pending");
    expect(byId["4"]).toBe("maintenance");
    expect(byId["5"]).toBe("pending");
  });

  test("preserves name/type and normalises placeholder URLs to null", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    const byId = Object.fromEntries(monitors.map((m) => [m.id, m]));
    expect(byId["1"]).toEqual<UptimekumaMonitor>({
      id: "1",
      name: "HomeAssistant",
      type: "docker",
      url: null,
      status: "up",
    });
    expect(byId["2"].url).toBe("http://jf:8096");
    expect(byId["3"].url).toBeNull();
    expect(byId["4"].url).toBeNull();
  });

  test("returns an empty array for empty input", () => {
    expect(parseMonitorStatus("")).toEqual([]);
    expect(parseMonitorStatus("# HELP foo\n# TYPE foo gauge\n")).toEqual([]);
  });
});

describe("summariseMonitors", () => {
  test("counts each status bucket", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    expect(summariseMonitors(monitors)).toEqual({
      total: 5,
      up: 1,
      down: 1,
      pending: 2,
      maintenance: 1,
    });
  });

  test("empty input yields zeros", () => {
    expect(summariseMonitors([])).toEqual({
      total: 0,
      up: 0,
      down: 0,
      pending: 0,
      maintenance: 0,
    });
  });
});
