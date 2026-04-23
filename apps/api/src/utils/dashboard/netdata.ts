import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeNetdataConfig } from "@hously/api/utils/integrations/normalizers";
import { toNumberOrNull, toRecord } from "@hously/shared/utils";
import type {
  DashboardNetdataDiskUsage,
  DashboardNetdataSummaryResponse,
} from "@hously/api/types/dashboardServices";
import { buildDisabledDashboardSummary } from "@hously/api/utils/dashboard/disabledSummary";

export const buildNetdataDisabledSummary = (
  error?: string,
): DashboardNetdataSummaryResponse =>
  buildDisabledDashboardSummary(
    {
      summary: {
        cpu_percent: null,
        ram_used_mib: null,
        ram_total_mib: null,
        ram_used_percent: null,
        load_1: null,
        load_5: null,
        load_15: null,
        network_in_kbps: null,
        network_out_kbps: null,
      },
      disks: [],
    },
    error,
  );

const valueByLabels = (
  labels: string[],
  row: unknown[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (let i = 1; i < labels.length; i += 1) {
    const label = labels[i];
    const value = toNumberOrNull(row[i]);
    if (!label || value == null) continue;
    result[label] = value;
  }
  return result;
};

const normalizeMetricKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findMetricValue = (
  values: Record<string, number>,
  aliases: string[],
): number | null => {
  const aliasSet = new Set(aliases.map(normalizeMetricKey));
  for (const [key, value] of Object.entries(values)) {
    if (aliasSet.has(normalizeMetricKey(key))) return value;
  }
  return null;
};

const resolveNetworkRates = (
  values: Record<string, number> | null,
): { inKbps: number | null; outKbps: number | null } => {
  if (!values) return { inKbps: null, outKbps: null };

  const inbound = findMetricValue(values, [
    "InOctets",
    "received",
    "in",
    "rx",
    "download",
    "ingress",
  ]);
  const outbound = findMetricValue(values, [
    "OutOctets",
    "sent",
    "out",
    "tx",
    "upload",
    "egress",
  ]);

  return {
    inKbps: inbound != null ? Math.round(Math.abs(inbound) * 10) / 10 : null,
    outKbps: outbound != null ? Math.round(Math.abs(outbound) * 10) / 10 : null,
  };
};

const isPreferredNetInterfaceChart = (chartId: string): boolean => {
  if (!chartId.startsWith("net.")) return false;
  const iface = chartId.slice(4).toLowerCase();
  if (!iface) return false;

  return !/^(lo|docker\d*|br-|veth|virbr|vnet|ifb|tun|tap|cni|flannel|kube|dummy)/.test(
    iface,
  );
};

const fetchNetdataChartLatest = async (
  netdataBaseUrl: string,
  chart: string,
): Promise<Record<string, number> | null> => {
  const dataUrl = new URL("/api/v1/data", netdataBaseUrl);
  dataUrl.searchParams.set("chart", chart);
  dataUrl.searchParams.set("after", "-60");
  dataUrl.searchParams.set("points", "1");
  dataUrl.searchParams.set("format", "json");

  const response = await fetch(dataUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const labels = Array.isArray(payload.labels)
    ? payload.labels.map((label) => (typeof label === "string" ? label : ""))
    : [];
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const row = rows[rows.length - 1];

  if (!Array.isArray(row) || labels.length < 2) return null;
  return valueByLabels(labels, row);
};

export const fetchNetdataSummary =
  async (): Promise<DashboardNetdataSummaryResponse> => {
    const integration = await getIntegrationConfigRecord("netdata");

    if (!integration?.enabled) {
      return buildNetdataDisabledSummary();
    }

    const config = normalizeNetdataConfig(integration.config);
    if (!config) {
      return {
        ...buildNetdataDisabledSummary(
          "Netdata integration is enabled but not configured",
        ),
        enabled: true,
      };
    }

    try {
      const chartsUrl = new URL("/api/v1/charts", config.website_url);
      const chartsResponse = await fetch(chartsUrl.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!chartsResponse.ok) {
        return {
          ...buildNetdataDisabledSummary(
            `Netdata charts request failed with status ${chartsResponse.status}`,
          ),
          enabled: true,
        };
      }

      const chartsPayload = (await chartsResponse.json()) as Record<
        string,
        unknown
      >;
      const charts = toRecord(chartsPayload.charts) ?? {};
      const diskCharts = Object.keys(charts)
        .filter((key) => key.startsWith("disk_space."))
        .sort((a, b) => a.localeCompare(b));
      const netInterfaceCharts = Object.keys(charts)
        .filter((key) => key.startsWith("net."))
        .sort((a, b) => a.localeCompare(b));
      const preferredNetCharts = netInterfaceCharts.filter(
        isPreferredNetInterfaceChart,
      );
      const selectedNetCharts = (
        preferredNetCharts.length > 0
          ? preferredNetCharts
          : netInterfaceCharts.filter(
              (chartId) => !chartId.toLowerCase().startsWith("net.lo"),
            )
      ).slice(0, 12);

      const [cpu, ram, load, systemNet, ...restRows] = await Promise.all([
        fetchNetdataChartLatest(config.website_url, "system.cpu"),
        fetchNetdataChartLatest(config.website_url, "system.ram"),
        fetchNetdataChartLatest(config.website_url, "system.load"),
        fetchNetdataChartLatest(config.website_url, "system.net"),
        ...selectedNetCharts.map((chartId) =>
          fetchNetdataChartLatest(config.website_url, chartId),
        ),
        ...diskCharts.map((chartId) =>
          fetchNetdataChartLatest(config.website_url, chartId),
        ),
      ]);
      const netRows = restRows.slice(0, selectedNetCharts.length);
      const diskRows = restRows.slice(selectedNetCharts.length);

      const systemNetRates = resolveNetworkRates(systemNet);
      const interfaceNetTotals = netRows.reduce(
        (acc, values) => {
          const rates = resolveNetworkRates(values);
          return {
            inKbps: (acc || { inKps: 0 }).inKbps + (rates.inKbps ?? 0),
            outKbps: (acc || { outKbps: 0 }).outKbps + (rates.outKbps ?? 0),
          };
        },
        { inKbps: 0, outKbps: 0 },
      );
      const hasInterfaceNetData = netRows.some((values) => {
        const rates = resolveNetworkRates(values);
        return rates.inKbps != null || rates.outKbps != null;
      });

      const ramUsed = ram?.used ?? null;
      const ramFree = ram?.free ?? null;
      const ramCached = ram?.cached ?? null;
      const ramBuffers = ram?.buffers ?? null;
      const ramTotal =
        ram?.total ??
        (ramUsed != null && ramFree != null
          ? ramUsed + ramFree + (ramCached ?? 0) + (ramBuffers ?? 0)
          : null);
      const ramUsedPercent =
        ramUsed != null && ramTotal != null && ramTotal > 0
          ? Math.round((ramUsed / ramTotal) * 1000) / 10
          : null;

      const disks: DashboardNetdataDiskUsage[] = diskRows
        .map((values, index) => {
          if (!values) return null;
          const used = values.used ?? 0;
          const avail = values.avail ?? 0;
          const reserved =
            values["reserved for root"] ?? values.reserved_for_root ?? 0;
          const total = used + avail + reserved;
          const chartName = diskCharts[index] ?? "disk_space.unknown";
          const mountPointRaw = chartName.slice("disk_space.".length);
          const mountPoint = decodeURIComponent(mountPointRaw);
          const usedPercent =
            total > 0 ? Math.round((used / total) * 1000) / 10 : 0;

          return {
            mount_point: mountPoint || "/",
            used_gib: Math.round(used * 10) / 10,
            avail_gib: Math.round(avail * 10) / 10,
            reserved_gib: Math.round(reserved * 10) / 10,
            used_percent: usedPercent,
          };
        })
        .filter((entry): entry is DashboardNetdataDiskUsage => Boolean(entry));

      return {
        enabled: true,
        connected: true,
        updated_at: new Date().toISOString(),
        summary: {
          cpu_percent:
            cpu?.user != null && cpu?.system != null
              ? Math.round((cpu.user + cpu.system) * 10) / 10
              : null,
          ram_used_mib: ramUsed != null ? Math.round(ramUsed * 10) / 10 : null,
          ram_total_mib:
            ramTotal != null ? Math.round(ramTotal * 10) / 10 : null,
          ram_used_percent: ramUsedPercent,
          load_1:
            load?.load1 != null ? Math.round(load.load1 * 100) / 100 : null,
          load_5:
            load?.load5 != null ? Math.round(load.load5 * 100) / 100 : null,
          load_15:
            load?.load15 != null ? Math.round(load.load15 * 100) / 100 : null,
          network_in_kbps:
            systemNetRates.inKbps ??
            (hasInterfaceNetData
              ? (interfaceNetTotals || { inKps: 0 }).inKbps
              : null),
          network_out_kbps:
            systemNetRates.outKbps ??
            (hasInterfaceNetData
              ? (interfaceNetTotals || { outKbps: 0 }).outKbps
              : null),
        },
        disks,
      };
    } catch (error) {
      console.error("Error fetching Netdata summary:", error);
      return {
        ...buildNetdataDisabledSummary("Failed to fetch Netdata summary"),
        enabled: true,
      };
    }
  };
