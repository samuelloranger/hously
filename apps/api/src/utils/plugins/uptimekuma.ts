export type UptimekumaMonitorStatus = "up" | "down" | "pending" | "maintenance";

export interface UptimekumaMonitor {
  id: string;
  name: string;
  status: UptimekumaMonitorStatus;
  type: string;
  url: string | null;
}

export interface UptimekumaSummary {
  total: number;
  up: number;
  down: number;
  pending: number;
  maintenance: number;
}

// Matches lines like:
// monitor_status{monitor_id="1",monitor_name="HA",monitor_type="docker",monitor_url="https://",...} 1
const METRIC_LINE = /^monitor_status\{([^}]*)\}\s+([0-9]+(?:\.[0-9]+)?)\s*$/;

// Parses {label="value",label2="value2"} into a Record.
function parseLabels(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    out[match[1]] = match[2].replace(/\\(.)/g, "$1");
  }
  return out;
}

function normaliseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "null" || trimmed === "https://" || trimmed === "http://") {
    return null;
  }
  return trimmed;
}

function mapStatus(code: number): UptimekumaMonitorStatus {
  switch (code) {
    case 0:
      return "down";
    case 1:
      return "up";
    case 3:
      return "maintenance";
    case 2:
    default:
      return "pending";
  }
}

export function parseMonitorStatus(metricsText: string): UptimekumaMonitor[] {
  if (!metricsText) return [];
  const monitors: UptimekumaMonitor[] = [];
  for (const rawLine of metricsText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = METRIC_LINE.exec(line);
    if (!match) continue;
    const labels = parseLabels(match[1]);
    const id = labels.monitor_id;
    const name = labels.monitor_name;
    if (!id || !name) continue;
    const code = Number.parseInt(match[2], 10);
    monitors.push({
      id,
      name,
      type: labels.monitor_type ?? "",
      url: normaliseUrl(labels.monitor_url),
      status: mapStatus(Number.isFinite(code) ? code : -1),
    });
  }
  return monitors;
}

export function summariseMonitors(
  monitors: UptimekumaMonitor[],
): UptimekumaSummary {
  const summary: UptimekumaSummary = {
    total: monitors.length,
    up: 0,
    down: 0,
    pending: 0,
    maintenance: 0,
  };
  for (const m of monitors) {
    summary[m.status] += 1;
  }
  return summary;
}
