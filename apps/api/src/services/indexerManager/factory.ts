import { prisma } from "../../db";
import { getIntegrationConfigRecord } from "../integrationConfigCache";
import {
  normalizeProwlarrConfig,
  normalizeJackettConfig,
} from "../../utils/integrations/normalizers";
import { ProwlarrAdapter } from "./prowlarrAdapter";
import { JackettAdapter } from "./jackettAdapter";
import type { IndexerManagerAdapter } from "./types";

/**
 * Return the currently active IndexerManagerAdapter based on
 * MediaSettings.activeIndexerManager.
 *
 * Returns null if no indexer is configured or the selected integration is disabled.
 */
export async function getActiveIndexerManager(): Promise<IndexerManagerAdapter | null> {
  let row = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.mediaSettings.create({ data: { id: 1 } });
  }

  const active = row.activeIndexerManager;
  if (!active) return null;

  if (active === "prowlarr") {
    const integration = await getIntegrationConfigRecord("prowlarr");
    if (!integration?.enabled) return null;
    const config = normalizeProwlarrConfig(integration.config);
    if (!config) return null;
    return new ProwlarrAdapter(config);
  }

  if (active === "jackett") {
    const integration = await getIntegrationConfigRecord("jackett");
    if (!integration?.enabled) return null;
    const config = normalizeJackettConfig(integration.config);
    if (!config) return null;
    return new JackettAdapter(config);
  }

  return null;
}
