import {
  fetchQbittorrentSnapshot,
  normalizeQbittorrentConfig,
  type QbittorrentDashboardSnapshot,
} from '../../../services/qbittorrentService';
import {
  buildQbittorrentDisabledSnapshot,
  normalizeNetdataConfig,
  normalizeScrutinyConfig,
  prisma,
  toNumberOrNull,
  toRecord,
  toStringOrNull,
} from './core';

export const getQbittorrentSnapshot = async (): Promise<QbittorrentDashboardSnapshot> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'qbittorrent' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildQbittorrentDisabledSnapshot();
  }

  const config = normalizeQbittorrentConfig(plugin.config);
  if (!config) {
    const disabled = buildQbittorrentDisabledSnapshot('qBittorrent plugin is enabled but not configured');
    return { ...disabled, enabled: true };
  }

  return fetchQbittorrentSnapshot(config, true);
};

export interface DashboardScrutinyDrive {
  id: string;
  model_name: string | null;
  serial_number: string | null;
  capacity_bytes: number | null;
  device_status: number | null;
  temperature_c: number | null;
  power_on_hours: number | null;
  firmware: string | null;
  form_factor: string | null;
  updated_at: string | null;
}

export interface DashboardScrutinySummary {
  total_drives: number;
  healthy_drives: number;
  warning_drives: number;
  avg_temp_c: number | null;
  hottest_temp_c: number | null;
}

export interface DashboardScrutinySummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: DashboardScrutinySummary;
  drives: DashboardScrutinyDrive[];
  error?: string;
}

const buildScrutinyDisabledSummary = (error?: string): DashboardScrutinySummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
  summary: {
    total_drives: 0,
    healthy_drives: 0,
    warning_drives: 0,
    avg_temp_c: null,
    hottest_temp_c: null,
  },
  drives: [],
  ...(error ? { error } : {}),
});

export const fetchScrutinySummary = async (): Promise<DashboardScrutinySummaryResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'scrutiny' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildScrutinyDisabledSummary();
  }

  const config = normalizeScrutinyConfig(plugin.config);
  if (!config) {
    return {
      ...buildScrutinyDisabledSummary('Scrutiny plugin is enabled but not configured'),
      enabled: true,
    };
  }

  try {
    const summaryUrl = new URL('/api/summary', config.website_url);
    const response = await fetch(summaryUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ...buildScrutinyDisabledSummary(`Scrutiny request failed with status ${response.status}`),
        enabled: true,
      };
    }

    const payload = (await response.json()) as unknown;
    const root = toRecord(payload);
    const data = toRecord(root?.data);
    const summaryRecord = toRecord(data?.summary);

    if (!summaryRecord) {
      return {
        ...buildScrutinyDisabledSummary('Invalid Scrutiny summary payload'),
        enabled: true,
      };
    }

    const drives = Object.entries(summaryRecord)
      .map(([id, raw]) => {
        const entry = toRecord(raw);
        if (!entry) return null;
        const device = toRecord(entry.device);
        const smart = toRecord(entry.smart);

        const statusRaw = toNumberOrNull(device?.device_status);
        const status = statusRaw == null ? null : Math.trunc(statusRaw);
        const temperatureRaw = toNumberOrNull(smart?.temp);
        const powerOnHoursRaw = toNumberOrNull(smart?.power_on_hours);
        const capacityRaw = toNumberOrNull(device?.capacity);

        const drive: DashboardScrutinyDrive = {
          id,
          model_name: toStringOrNull(device?.model_name),
          serial_number: toStringOrNull(device?.serial_number),
          capacity_bytes: capacityRaw == null ? null : Math.trunc(capacityRaw),
          device_status: status,
          temperature_c: temperatureRaw == null ? null : Math.round(temperatureRaw * 10) / 10,
          power_on_hours: powerOnHoursRaw == null ? null : Math.trunc(powerOnHoursRaw),
          firmware: toStringOrNull(device?.firmware),
          form_factor: toStringOrNull(device?.form_factor),
          updated_at: toStringOrNull(device?.UpdatedAt),
        };

        return drive;
      })
      .filter((drive): drive is DashboardScrutinyDrive => Boolean(drive))
      .sort((a, b) => {
        if (a.temperature_c == null && b.temperature_c == null) return 0;
        if (a.temperature_c == null) return 1;
        if (b.temperature_c == null) return -1;
        return b.temperature_c - a.temperature_c;
      });

    const totalDrives = drives.length;
    const healthyDrives = drives.filter(drive => drive.device_status === 0).length;
    const warningDrives = drives.filter(drive => drive.device_status != null && drive.device_status !== 0).length;
    const temperatures = drives.map(drive => drive.temperature_c).filter((temp): temp is number => temp != null);
    const avgTemp =
      temperatures.length > 0
        ? Math.round((temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length) * 10) / 10
        : null;
    const hottestTemp = temperatures.length > 0 ? Math.max(...temperatures) : null;
    const updatedAt =
      drives.map(drive => drive.updated_at).find((value): value is string => Boolean(value)) ??
      new Date().toISOString();

    return {
      enabled: true,
      connected: true,
      updated_at: updatedAt,
      summary: {
        total_drives: totalDrives,
        healthy_drives: healthyDrives,
        warning_drives: warningDrives,
        avg_temp_c: avgTemp,
        hottest_temp_c: hottestTemp,
      },
      drives,
    };
  } catch (error) {
    console.error('Error fetching Scrutiny summary:', error);
    return {
      ...buildScrutinyDisabledSummary('Failed to fetch Scrutiny summary'),
      enabled: true,
    };
  }
};

export interface DashboardNetdataDiskUsage {
  mount_point: string;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

export interface DashboardNetdataSummary {
  cpu_percent: number | null;
  ram_used_mib: number | null;
  ram_total_mib: number | null;
  ram_used_percent: number | null;
  load_1: number | null;
  load_5: number | null;
  load_15: number | null;
  network_in_kbps: number | null;
  network_out_kbps: number | null;
}

export interface DashboardNetdataSummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: DashboardNetdataSummary;
  disks: DashboardNetdataDiskUsage[];
  error?: string;
}

export const buildNetdataDisabledSummary = (error?: string): DashboardNetdataSummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
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
  ...(error ? { error } : {}),
});

const valueByLabels = (labels: string[], row: unknown[]): Record<string, number> => {
  const result: Record<string, number> = {};
  for (let i = 1; i < labels.length; i += 1) {
    const label = labels[i];
    const value = toNumberOrNull(row[i]);
    if (!label || value == null) continue;
    result[label] = value;
  }
  return result;
};

const normalizeMetricKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const findMetricValue = (values: Record<string, number>, aliases: string[]): number | null => {
  const aliasSet = new Set(aliases.map(normalizeMetricKey));
  for (const [key, value] of Object.entries(values)) {
    if (aliasSet.has(normalizeMetricKey(key))) return value;
  }
  return null;
};

const resolveNetworkRates = (
  values: Record<string, number> | null
): { inKbps: number | null; outKbps: number | null } => {
  if (!values) return { inKbps: null, outKbps: null };

  const inbound = findMetricValue(values, ['InOctets', 'received', 'in', 'rx', 'download', 'ingress']);
  const outbound = findMetricValue(values, ['OutOctets', 'sent', 'out', 'tx', 'upload', 'egress']);

  return {
    inKbps: inbound != null ? Math.round(Math.abs(inbound) * 10) / 10 : null,
    outKbps: outbound != null ? Math.round(Math.abs(outbound) * 10) / 10 : null,
  };
};

const isPreferredNetInterfaceChart = (chartId: string): boolean => {
  if (!chartId.startsWith('net.')) return false;
  const iface = chartId.slice(4).toLowerCase();
  if (!iface) return false;

  return !/^(lo|docker\d*|br-|veth|virbr|vnet|ifb|tun|tap|cni|flannel|kube|dummy)/.test(iface);
};

const fetchNetdataChartLatest = async (
  netdataBaseUrl: string,
  chart: string
): Promise<Record<string, number> | null> => {
  const dataUrl = new URL('/api/v1/data', netdataBaseUrl);
  dataUrl.searchParams.set('chart', chart);
  dataUrl.searchParams.set('after', '-60');
  dataUrl.searchParams.set('points', '1');
  dataUrl.searchParams.set('format', 'json');

  const response = await fetch(dataUrl.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const labels = Array.isArray(payload.labels)
    ? payload.labels.map(label => (typeof label === 'string' ? label : ''))
    : [];
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const row = rows[rows.length - 1];

  if (!Array.isArray(row) || labels.length < 2) return null;
  return valueByLabels(labels, row);
};

export const fetchNetdataSummary = async (): Promise<DashboardNetdataSummaryResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'netdata' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildNetdataDisabledSummary();
  }

  const config = normalizeNetdataConfig(plugin.config);
  if (!config) {
    return {
      ...buildNetdataDisabledSummary('Netdata plugin is enabled but not configured'),
      enabled: true,
    };
  }

  try {
    const chartsUrl = new URL('/api/v1/charts', config.website_url);
    const chartsResponse = await fetch(chartsUrl.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!chartsResponse.ok) {
      return {
        ...buildNetdataDisabledSummary(`Netdata charts request failed with status ${chartsResponse.status}`),
        enabled: true,
      };
    }

    const chartsPayload = (await chartsResponse.json()) as Record<string, unknown>;
    const charts = toRecord(chartsPayload.charts) ?? {};
    const diskCharts = Object.keys(charts)
      .filter(key => key.startsWith('disk_space.'))
      .sort((a, b) => a.localeCompare(b));
    const netInterfaceCharts = Object.keys(charts)
      .filter(key => key.startsWith('net.'))
      .sort((a, b) => a.localeCompare(b));
    const preferredNetCharts = netInterfaceCharts.filter(isPreferredNetInterfaceChart);
    const selectedNetCharts = (
      preferredNetCharts.length > 0
        ? preferredNetCharts
        : netInterfaceCharts.filter(chartId => !chartId.toLowerCase().startsWith('net.lo'))
    ).slice(0, 12);

    const [cpu, ram, load, systemNet, ...restRows] = await Promise.all([
      fetchNetdataChartLatest(config.website_url, 'system.cpu'),
      fetchNetdataChartLatest(config.website_url, 'system.ram'),
      fetchNetdataChartLatest(config.website_url, 'system.load'),
      fetchNetdataChartLatest(config.website_url, 'system.net'),
      ...selectedNetCharts.map(chartId => fetchNetdataChartLatest(config.website_url, chartId)),
      ...diskCharts.map(chartId => fetchNetdataChartLatest(config.website_url, chartId)),
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
      { inKbps: 0, outKbps: 0 }
    );
    const hasInterfaceNetData = netRows.some(values => {
      const rates = resolveNetworkRates(values);
      return rates.inKbps != null || rates.outKbps != null;
    });

    const ramUsed = ram?.used ?? null;
    const ramFree = ram?.free ?? null;
    const ramCached = ram?.cached ?? null;
    const ramBuffers = ram?.buffers ?? null;
    const ramTotal =
      ram?.total ??
      (ramUsed != null && ramFree != null ? ramUsed + ramFree + (ramCached ?? 0) + (ramBuffers ?? 0) : null);
    const ramUsedPercent =
      ramUsed != null && ramTotal != null && ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 1000) / 10 : null;

    const disks: DashboardNetdataDiskUsage[] = diskRows
      .map((values, index) => {
        if (!values) return null;
        const used = values.used ?? 0;
        const avail = values.avail ?? 0;
        const reserved = values['reserved for root'] ?? values.reserved_for_root ?? 0;
        const total = used + avail + reserved;
        const chartName = diskCharts[index] ?? 'disk_space.unknown';
        const mountPointRaw = chartName.slice('disk_space.'.length);
        const mountPoint = decodeURIComponent(mountPointRaw);
        const usedPercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;

        return {
          mount_point: mountPoint || '/',
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
        cpu_percent: cpu?.user != null && cpu?.system != null ? Math.round((cpu.user + cpu.system) * 10) / 10 : null,
        ram_used_mib: ramUsed != null ? Math.round(ramUsed * 10) / 10 : null,
        ram_total_mib: ramTotal != null ? Math.round(ramTotal * 10) / 10 : null,
        ram_used_percent: ramUsedPercent,
        load_1: load?.load1 != null ? Math.round(load.load1 * 100) / 100 : null,
        load_5: load?.load5 != null ? Math.round(load.load5 * 100) / 100 : null,
        load_15: load?.load15 != null ? Math.round(load.load15 * 100) / 100 : null,
        network_in_kbps:
          systemNetRates.inKbps ?? (hasInterfaceNetData ? (interfaceNetTotals || { inKps: 0 }).inKbps : null),
        network_out_kbps:
          systemNetRates.outKbps ?? (hasInterfaceNetData ? (interfaceNetTotals || { outKbps: 0 }).outKbps : null),
      },
      disks,
    };
  } catch (error) {
    console.error('Error fetching Netdata summary:', error);
    return {
      ...buildNetdataDisabledSummary('Failed to fetch Netdata summary'),
      enabled: true,
    };
  }
};
