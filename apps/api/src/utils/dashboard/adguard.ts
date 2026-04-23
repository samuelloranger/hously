import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeAdguardConfig } from "@hously/api/utils/integrations/normalizers";
import { toNumberOrNull, toRecord, toStringOrNull } from "@hously/shared/utils";
import type {
  DashboardAdguardSummaryResponse,
  DashboardAdguardTopEntry,
} from "@hously/shared";
import { buildDisabledDashboardSummary } from "@hously/api/utils/dashboard/disabledSummary";

const buildAdguardDisabledSummary = (
  error?: string,
): DashboardAdguardSummaryResponse =>
  buildDisabledDashboardSummary(
    {
      protection_enabled: false,
      version: null,
      summary: {
        dns_queries: 0,
        blocked_queries: 0,
        blocked_ratio: null,
        avg_processing_time_ms: null,
        safebrowsing_blocked: 0,
        safesearch_rewritten: 0,
        parental_blocked: 0,
      },
      top_blocked_domains: [],
      top_clients: [],
    },
    error,
  );

const toBoolean = (value: unknown): boolean => value === true;

const parseTopEntries = (value: unknown): DashboardAdguardTopEntry[] => {
  const rawEntries: Array<[string, number]> = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const name = toStringOrNull(entry[0]);
        const hits = toNumberOrNull(entry[1]);
        if (name && hits != null) {
          rawEntries.push([name, Math.max(0, Math.trunc(hits))]);
        }
        continue;
      }

      const record = toRecord(entry);
      if (!record) continue;
      for (const [key, rawValue] of Object.entries(record)) {
        const name = toStringOrNull(key);
        const hits = toNumberOrNull(rawValue);
        if (name && hits != null) {
          rawEntries.push([name, Math.max(0, Math.trunc(hits))]);
        }
      }
    }
  } else {
    const record = toRecord(value);
    if (record) {
      for (const [key, rawValue] of Object.entries(record)) {
        const name = toStringOrNull(key);
        const hits = toNumberOrNull(rawValue);
        if (name && hits != null) {
          rawEntries.push([name, Math.max(0, Math.trunc(hits))]);
        }
      }
    }
  }

  return rawEntries
    .map(([name, hits]) => ({ name, hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);
};

export const fetchAdguardSummary =
  async (): Promise<DashboardAdguardSummaryResponse> => {
    const integration = await getIntegrationConfigRecord("adguard");

    if (!integration?.enabled) {
      return buildAdguardDisabledSummary();
    }

    const config = normalizeAdguardConfig(integration.config);
    if (!config) {
      return {
        ...buildAdguardDisabledSummary(
          "AdGuard Home integration is enabled but not configured",
        ),
        enabled: true,
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
      const statusUrl = new URL("/control/status", config.website_url);
      const statsUrl = new URL("/control/stats", config.website_url);

      const [statusResponse, statsResponse] = await Promise.all([
        fetch(statusUrl.toString(), {
          headers: {
            Accept: "application/json",
            Authorization: authHeader,
          },
        }),
        fetch(statsUrl.toString(), {
          headers: {
            Accept: "application/json",
            Authorization: authHeader,
          },
        }),
      ]);

      if (!statusResponse.ok) {
        return {
          ...buildAdguardDisabledSummary(
            `AdGuard status request failed with status ${statusResponse.status}`,
          ),
          enabled: true,
        };
      }

      if (!statsResponse.ok) {
        return {
          ...buildAdguardDisabledSummary(
            `AdGuard stats request failed with status ${statsResponse.status}`,
          ),
          enabled: true,
        };
      }

      const [statusPayload, statsPayload] = (await Promise.all([
        statusResponse.json(),
        statsResponse.json(),
      ])) as [unknown, unknown];

      const status = toRecord(statusPayload);
      const stats = toRecord(statsPayload);

      if (!status || !stats) {
        return {
          ...buildAdguardDisabledSummary("Invalid AdGuard Home payload"),
          enabled: true,
        };
      }

      const dnsQueries = Math.max(
        0,
        Math.trunc(toNumberOrNull(stats.num_dns_queries) ?? 0),
      );
      const blockedQueries = Math.max(
        0,
        Math.trunc(toNumberOrNull(stats.num_blocked_filtering) ?? 0),
      );
      const blockedRatio =
        dnsQueries > 0
          ? Math.round((blockedQueries / dnsQueries) * 1000) / 10
          : null;

      return {
        enabled: true,
        connected: true,
        updated_at: new Date().toISOString(),
        protection_enabled: toBoolean(status.protection_enabled),
        version: toStringOrNull(status.version),
        summary: {
          dns_queries: dnsQueries,
          blocked_queries: blockedQueries,
          blocked_ratio: blockedRatio,
          avg_processing_time_ms: toNumberOrNull(stats.avg_processing_time),
          safebrowsing_blocked: Math.max(
            0,
            Math.trunc(toNumberOrNull(stats.num_replaced_safebrowsing) ?? 0),
          ),
          safesearch_rewritten: Math.max(
            0,
            Math.trunc(toNumberOrNull(stats.num_replaced_safesearch) ?? 0),
          ),
          parental_blocked: Math.max(
            0,
            Math.trunc(toNumberOrNull(stats.num_replaced_parental) ?? 0),
          ),
        },
        top_blocked_domains: parseTopEntries(stats.top_blocked_domains),
        top_clients: parseTopEntries(stats.top_clients),
      };
    } catch (error) {
      console.error("Error fetching AdGuard Home summary:", error);
      return {
        ...buildAdguardDisabledSummary("Failed to fetch AdGuard Home summary"),
        enabled: true,
      };
    }
  };
