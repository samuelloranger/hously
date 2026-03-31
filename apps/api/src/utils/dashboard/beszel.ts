import { prisma } from '../../db';
import { normalizeBeszelConfig } from '../plugins/normalizers';
import type { DashboardBeszelDiskUsage, DashboardBeszelSummaryResponse } from '../../types/dashboardServices';

export const buildBeszelDisabledSummary = (error?: string): DashboardBeszelSummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
  summary: {
    cpu_percent: null,
    cpu_name: null,
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

// Stats are stored as a JSON string inside the `stats` field
type BeszelStatsPayload = {
  cpu: number;       // CPU percent
  m: number;         // RAM total GiB
  mu: number;        // RAM used GiB
  mp: number;        // RAM used percent
  d: number;         // root disk total GiB
  du: number;        // root disk used GiB
  dp: number;        // root disk used percent
  b?: [number, number]; // [rx bytes/s, tx bytes/s]
  la?: [number, number, number]; // load averages [1m, 5m, 15m]
  efs?: Record<string, { d: number; du: number }>; // extra filesystems: total/used GiB
};

type BeszelStatsRecord = {
  id: string;
  system: string;
  stats: string; // JSON string
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
    statsUrl.searchParams.set('filter', `system="${system.id}" && type="1m"`);
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

    const record = statsData.items[0];
    const s: BeszelStatsPayload = typeof record.stats === 'string' ? JSON.parse(record.stats) : record.stats;

    // Fetch system details for CPU name (best-effort)
    let cpuName: string | null = null;
    // Map from device path (e.g. "/dev/sda") to model name
    const deviceModelMap: Record<string, string> = {};
    try {
      const detailsUrl = new URL('/api/collections/system_details/records', config.website_url);
      detailsUrl.searchParams.set('filter', `system="${system.id}"`);
      detailsUrl.searchParams.set('perPage', '1');
      const detailsRes = await fetch(detailsUrl.toString(), { headers });
      if (detailsRes.ok) {
        const detailsData = (await detailsRes.json()) as { items: { cpu?: string }[] };
        cpuName = detailsData.items[0]?.cpu ?? null;
      }

      const smartUrl = new URL('/api/collections/smart_devices/records', config.website_url);
      smartUrl.searchParams.set('filter', `system="${system.id}"`);
      smartUrl.searchParams.set('perPage', '50');
      smartUrl.searchParams.set('fields', 'name,model');
      const smartRes = await fetch(smartUrl.toString(), { headers });
      if (smartRes.ok) {
        const smartData = (await smartRes.json()) as { items: { name: string; model: string }[] };
        for (const d of smartData.items) {
          if (d.name && d.model) deviceModelMap[d.name] = d.model;
        }
      }
    } catch {
      // ignore
    }

    // Helper: given an efs mount key like "sda1" → look up "/dev/sda" model
    const resolveModel = (mountKey: string): string | null => {
      // Strip trailing digits to get base device name (sda1 → sda, nvme0n1p1 → nvme0n1)
      const base = mountKey.replace(/p?\d+$/, '');
      return deviceModelMap[`/dev/${base}`] ?? null;
    };

    // For root "/": find the smart device not claimed by any efs mount
    const efsMountDevices = new Set(
      Object.keys(s.efs ?? {}).map(k => `/dev/${k.replace(/p?\d+$/, '')}`)
    );
    const rootModel =
      Object.entries(deviceModelMap).find(([dev]) => !efsMountDevices.has(dev))?.[1] ?? null;

    // RAM: stored in GiB, convert to MiB
    const ramUsedMib = s.mu != null ? Math.round(s.mu * 1024 * 10) / 10 : null;
    const ramTotalMib = s.m != null ? Math.round(s.m * 1024 * 10) / 10 : null;

    // Root disk
    const mainDiskPct = s.dp ?? (s.d > 0 ? Math.round((s.du / s.d) * 1000) / 10 : 0);
    const disks: DashboardBeszelDiskUsage[] = [
      {
        mount_point: '/',
        model: rootModel,
        used_gib: Math.round(s.du * 10) / 10,
        avail_gib: Math.round((s.d - s.du) * 10) / 10,
        reserved_gib: 0,
        used_percent: Math.round(mainDiskPct * 10) / 10,
      },
    ];

    // Extra filesystems
    const efs = s.efs ?? {};
    for (const [mountKey, fsData] of Object.entries(efs)) {
      if (!fsData || typeof fsData.d !== 'number' || fsData.d === 0) continue;
      // mergerfs pools report as "source1:source2:source3" — normalize to a friendly label
      const isMergerfs = mountKey.includes(':');
      disks.push({
        mount_point: isMergerfs ? 'mergerfs' : mountKey,
        model: isMergerfs ? 'MergerFS Pool' : resolveModel(mountKey),
        used_gib: Math.round(fsData.du * 10) / 10,
        avail_gib: Math.round((fsData.d - fsData.du) * 10) / 10,
        reserved_gib: 0,
        used_percent: Math.round((fsData.du / fsData.d) * 1000) / 10,
      });
    }

    // Network: b = [rx bytes/s, tx bytes/s] → Kbps = bytes/s * 8 / 1000
    const networkIn = s.b?.[0] != null ? Math.round((s.b[0] * 8) / 1000 * 10) / 10 : null;
    const networkOut = s.b?.[1] != null ? Math.round((s.b[1] * 8) / 1000 * 10) / 10 : null;

    return {
      enabled: true,
      connected: true,
      updated_at: record.created,
      summary: {
        cpu_percent: s.cpu != null ? Math.round(s.cpu * 10) / 10 : null,
        cpu_name: cpuName,
        ram_used_mib: ramUsedMib,
        ram_total_mib: ramTotalMib,
        ram_used_percent: s.mp != null ? Math.round(s.mp * 10) / 10 : null,
        load_1: s.la?.[0] ?? null,
        load_5: s.la?.[1] ?? null,
        load_15: s.la?.[2] ?? null,
        network_in_kbps: networkIn,
        network_out_kbps: networkOut,
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
