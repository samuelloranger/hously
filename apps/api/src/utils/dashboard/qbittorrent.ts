import { prisma } from '../../db';
import {
  buildQbittorrentDisabledSnapshot,
  fetchQbittorrentSnapshot,
  normalizeQbittorrentConfig,
  type QbittorrentDashboardSnapshot,
} from '../../services/qbittorrentService';

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
