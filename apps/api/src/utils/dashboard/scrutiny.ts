import { prisma } from '../../db';
import { normalizeScrutinyConfig } from '../plugins/normalizers';
import { toNumberOrNull, toRecord, toStringOrNull } from '@hously/shared';
import type { DashboardScrutinyDrive, DashboardScrutinySummaryResponse } from '../../types/dashboardServices';

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
