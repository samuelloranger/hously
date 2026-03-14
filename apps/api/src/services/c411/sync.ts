/**
 * Sync C411 releases into Hously's database.
 */

import { prisma } from '../../db';
import { fetchMyTorrents } from './torrents';
import type { C411Session, C411Torrent } from './types';

export interface SyncResult {
  created: number;
  updated: number;
}

/**
 * Fetch all torrents owned by the authenticated user, paginating through results.
 * Uses the isOwner flag set by C411 based on the session, not the uploader filter.
 */
async function fetchAllOwnedTorrents(session: C411Session): Promise<C411Torrent[]> {
  const all: C411Torrent[] = [];
  let page = 1;

  while (true) {
    const response = await fetchMyTorrents(session, { page, perPage: 100 });
    const owned = response.data.filter((t) => t.isOwner);
    all.push(...owned);

    // If we got fewer owned torrents than total, and there are more pages, keep going
    if (page >= response.meta.totalPages) break;
    page++;
  }

  return all;
}

/**
 * Pull the user's C411 uploads and upsert into C411Release table.
 * Does NOT overwrite locally-prepared data (bbcode, torrentS3Key, hardlinkPath).
 */
export async function syncC411Releases(session: C411Session): Promise<SyncResult> {
  console.log('[c411:sync] Fetching owned torrents...');
  const torrents = await fetchAllOwnedTorrents(session);
  console.log(`[c411:sync] Found ${torrents.length} owned torrents`);

  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const torrent of torrents) {
    const existing = await prisma.c411Release.findUnique({
      where: { c411TorrentId: torrent.id },
    });

    if (existing) {
      // Update remote-sourced fields only
      await prisma.c411Release.update({
        where: { id: existing.id },
        data: {
          status: torrent.status,
          seeders: torrent.seeders,
          leechers: torrent.leechers,
          completions: torrent.completions,
          infoHash: torrent.infoHash,
          syncedAt: now,
        },
      });
      updated++;
    } else {
      // Also check by infoHash in case it was prepared locally
      const byHash = torrent.infoHash
        ? await prisma.c411Release.findUnique({ where: { infoHash: torrent.infoHash } })
        : null;

      if (byHash) {
        await prisma.c411Release.update({
          where: { id: byHash.id },
          data: {
            c411TorrentId: torrent.id,
            status: torrent.status,
            seeders: torrent.seeders,
            leechers: torrent.leechers,
            completions: torrent.completions,
            syncedAt: now,
          },
        });
        updated++;
      } else {
        // Create new release from C411 data
        await prisma.c411Release.create({
          data: {
            c411TorrentId: torrent.id,
            infoHash: torrent.infoHash,
            name: torrent.name,
            categoryId: torrent.category?.id ?? null,
            subcategoryId: torrent.subcategory?.id ?? null,
            categoryName: torrent.category?.name ?? null,
            subcategoryName: torrent.subcategory?.name ?? null,
            language: torrent.language || null,
            size: BigInt(torrent.size),
            status: torrent.status,
            seeders: torrent.seeders,
            leechers: torrent.leechers,
            completions: torrent.completions,
            syncedAt: now,
          },
        });
        created++;
      }
    }
  }

  console.log(`[c411:sync] Done: ${created} created, ${updated} updated`);
  return { created, updated };
}
