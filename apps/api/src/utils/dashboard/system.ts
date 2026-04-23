import { prisma } from "@hously/api/db";
import { fetchBeszelSummary, buildBeszelDisabledSummary } from "./beszel";
import { fetchNetdataSummary } from "./netdata";
import type { DashboardBeszelSummaryResponse } from "@hously/api/types/dashboardServices";

/**
 * Unified system monitoring summary.
 * Checks which monitoring integration is enabled (beszel or netdata) and returns
 * a single response. Beszel is preferred when both are enabled.
 *
 * The response always uses the Beszel shape — netdata results are mapped
 * to match (cpu_name and disk model are null for netdata).
 */
export async function fetchSystemSummary(): Promise<DashboardBeszelSummaryResponse> {
  const integrations = await prisma.integration.findMany({
    where: { type: { in: ["beszel", "netdata"] } },
    select: { type: true, enabled: true },
  });

  const beszelEnabled = integrations.some((p) => p.type === "beszel" && p.enabled);
  const netdataEnabled = integrations.some((p) => p.type === "netdata" && p.enabled);

  // Prefer Beszel when both are enabled
  if (beszelEnabled) {
    return fetchBeszelSummary();
  }

  if (netdataEnabled) {
    const netdata = await fetchNetdataSummary();
    // Map netdata response to beszel shape
    return {
      enabled: netdata.enabled,
      connected: netdata.connected,
      updated_at: netdata.updated_at,
      summary: {
        ...netdata.summary,
        cpu_name: null,
      },
      disks: netdata.disks.map((d) => ({
        ...d,
        model: null,
      })),
      ...(netdata.error ? { error: netdata.error } : {}),
    };
  }

  return buildBeszelDisabledSummary();
}

export const buildSystemDisabledSummary = buildBeszelDisabledSummary;
