import { prisma } from "../../db";
import { getPluginConfigRecord } from "../pluginConfigCache";
import {
  normalizeProwlarrConfig,
  normalizeJackettConfig,
} from "../../utils/plugins/normalizers";
import { ProwlarrAdapter } from "./prowlarrAdapter";
import { JackettAdapter } from "./jackettAdapter";
import type { IndexerManagerAdapter } from "./types";

/**
 * Return the currently active IndexerManagerAdapter based on
 * MediaSettings.activeIndexerManager.
 *
 * Returns null if no indexer is configured or the selected plugin is disabled.
 */
export async function getActiveIndexerManager(): Promise<IndexerManagerAdapter | null> {
  let row = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.mediaSettings.create({ data: { id: 1 } });
  }

  const active = row.activeIndexerManager;
  if (!active) return null;

  if (active === "prowlarr") {
    const plugin = await getPluginConfigRecord("prowlarr");
    if (!plugin?.enabled) return null;
    const config = normalizeProwlarrConfig(plugin.config);
    if (!config) return null;
    return new ProwlarrAdapter(config);
  }

  if (active === "jackett") {
    const plugin = await getPluginConfigRecord("jackett");
    if (!plugin?.enabled) return null;
    const config = normalizeJackettConfig(plugin.config);
    if (!config) return null;
    return new JackettAdapter(config);
  }

  return null;
}
