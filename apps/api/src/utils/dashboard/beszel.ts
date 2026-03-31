import { prisma } from '../../db';
import { normalizeBeszelConfig } from '../plugins/normalizers';
import type { DashboardBeszelDiskUsage, DashboardBeszelSummaryResponse } from '../../types/dashboardServices';

export const buildBeszelDisabledSummary = (error?: string): DashboardBeszelSummaryResponse => ({
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

type BeszelSystemRecord = {
  id: string;
  name: string;
  status: string;
};

type BeszelExtraFsEntry = { t: number; u: number };

type BeszelStatsRecord = {
  id: string;
  system: string;
  cpu: number;
  mem: number;
  mt: number;
  d: number;
  dt: number;
  ns: number;
  nr: number;
  efs: Record<string, BeszelExtraFsEntry> | null;
  created: string;
};

type PocketBaseList<T> = {
  items: T[];
  totalItems: number;
};

export const fetchBeszelSummary = async (): Promise<DashboardBeszelSummaryResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'beszel' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildBeszelDisabledSummary();
  }

  const config = normalizeBeszelConfig(plugin.config);
  if (!config) {
    return {
      ...buildBeszelDisabledSummary('Beszel plugin is enabled but not configured'),
      enabled: true,
    };
  }

  try {
    const authUrl = new URL('/api/collections/users/auth-with-password', config.website_url);
    const authRes = await fetch(authUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identity: config.email, password: config.password }),
    });
    if (!authRes.ok) {
      return {
        ...buildBeszelDisabledSummary(`Beszel authentication failed with status ${authRes.status}`),
        enabled: true,
      };
    }
    const authData = (await authRes.json()) as { token?: string };
    if (!authData.token) {
      return {
        ...buildBeszelDisabledSummary('Beszel authentication response missing token'),
        enabled: true,
      };
    }

    const headers = { Accept: 'application/json', Authorization: authData.token };

    const systemsUrl = new URL('/api/collections/systems/records?perPage=1&sort=created', config.website_url);
    const systemsRes = await fetch(systemsUrl.toString(), { headers });
    if (!systemsRes.ok) {
      return {
        ...buildBeszelDisabledSummary(`Beszel systems request failed with status ${systemsRes.status}`),
        enabled: true,
      };
    }

    const systemsData = (await systemsRes.json()) as PocketBaseList<BeszelSystemRecord>;
    if (!systemsData.items.length) {
      return {
        ...buildBeszelDisabledSummary('No systems found in Beszel'),
        enabled: true,
      };
    }

    const system = systemsData.items[0];

    const statsUrl = new URL('/api/collections/system_stats/records', config.website_url);
    statsUrl.searchParams.set('filter', `system="${system.id}"`);
    statsUrl.searchParams.set('sort', '-created');
    statsUrl.searchParams.set('perPage', '1');

    const statsRes = await fetch(statsUrl.toString(), { headers });
    if (!statsRes.ok) {
      return {
        ...buildBeszelDisabledSummary(`Beszel stats request failed with status ${statsRes.status}`),
        enabled: true,
      };
    }

    const statsData = (await statsRes.json()) as PocketBaseList<BeszelStatsRecord>;
    if (!statsData.items.length) {
      return {
        ...buildBeszelDisabledSummary('No stats available yet for this system'),
        enabled: true,
      };
    }

    const s = statsData.items[0];
    const ramUsedPercent = s.mt > 0 ? Math.round((s.mem / s.mt) * 1000) / 10 : null;
    const mainDiskPct = s.dt > 0 ? Math.round((s.d / s.dt) * 1000) / 10 : 0;

    const disks: DashboardBeszelDiskUsage[] = [
      {
        mount_point: '/',
        used_gib: Math.round(s.d * 10) / 10,
        avail_gib: Math.round((s.dt - s.d) * 10) / 10,
        reserved_gib: 0,
        used_percent: mainDiskPct,
      },
    ];

    const efs = s.efs ?? {};
    for (const [mountPoint, fsData] of Object.entries(efs)) {
      if (!fsData || typeof fsData.t !== 'number' || fsData.t === 0) continue;
      disks.push({
        mount_point: mountPoint,
        used_gib: Math.round(fsData.u * 10) / 10,
        avail_gib: Math.round((fsData.t - fsData.u) * 10) / 10,
        reserved_gib: 0,
        used_percent: Math.round((fsData.u / fsData.t) * 1000) / 10,
      });
    }

    return {
      enabled: true,
      connected: true,
      updated_at: s.created,
      summary: {
        cpu_percent: Math.round(s.cpu * 10) / 10,
        ram_used_mib: Math.round(s.mem * 10) / 10,
        ram_total_mib: Math.round(s.mt * 10) / 10,
        ram_used_percent: ramUsedPercent,
        load_1: null,
        load_5: null,
        load_15: null,
        network_in_kbps: s.nr != null ? Math.round(s.nr * 8000 * 10) / 10 : null,
        network_out_kbps: s.ns != null ? Math.round(s.ns * 8000 * 10) / 10 : null,
      },
      disks,
    };
  } catch (error) {
    console.error('Error fetching Beszel summary:', error);
    return {
      ...buildBeszelDisabledSummary('Failed to fetch Beszel summary'),
      enabled: true,
    };
  }
};
