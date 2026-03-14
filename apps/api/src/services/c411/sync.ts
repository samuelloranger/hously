/**
 * Sync C411 releases into Hously's database.
 */

import { prisma } from '../../db';
import { fetchMyTorrents, fetchTorrentDetail } from './torrents';
import type { C411Session, C411Torrent } from './types';

export interface SyncResult {
  created: number;
  updated: number;
}

/**
 * Fetch all torrents owned by the authenticated user, paginating through results.
 * Uses the isOwner flag set by C411 based on the session.
 */
async function fetchAllOwnedTorrents(session: C411Session): Promise<C411Torrent[]> {
  const all: C411Torrent[] = [];
  let page = 1;

  while (true) {
    const response = await fetchMyTorrents(session, { page, perPage: 100 });
    const owned = response.data.filter((t) => t.isOwner);
    all.push(...owned);
    if (page >= response.meta.totalPages) break;
    page++;
  }

  return all;
}

/**
 * Pull the user's C411 uploads and upsert into C411Release table.
 * Fetches BBCode description for each torrent and stores as presentation.
 */
export async function syncC411Releases(session: C411Session): Promise<SyncResult> {
  console.log('[c411:sync] Fetching owned torrents...');
  const torrents = await fetchAllOwnedTorrents(session);
  console.log(`[c411:sync] Found ${torrents.length} owned torrents`);

  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const torrent of torrents) {
    // Fetch detail to get the description (BBCode)
    let description: string | null = null;
    let tmdbData: any = null;
    let nfoContent: string | null = null;
    try {
      const detail = await fetchTorrentDetail(session, torrent.infoHash);
      description = detail.description || null;
      tmdbData = detail.metadata?.tmdbData || null;
      nfoContent = detail.metadata?.nfoContent || null;
    } catch (err) {
      console.warn(`[c411:sync] Failed to fetch detail for ${torrent.name}: ${err}`);
    }

    const existing = await prisma.c411Release.findUnique({
      where: { c411TorrentId: torrent.id },
      include: { presentation: true },
    });

    if (existing) {
      await prisma.c411Release.update({
        where: { id: existing.id },
        data: {
          status: torrent.status,
          seeders: torrent.seeders,
          leechers: torrent.leechers,
          completions: torrent.completions,
          infoHash: torrent.infoHash,
          tmdbData: tmdbData ?? existing.tmdbData,
          nfoContent: nfoContent ?? existing.nfoContent,
          syncedAt: now,
        },
      });
      // Update or create presentation with BBCode
      if (description && !existing.presentation) {
        await prisma.c411Presentation.create({
          data: { releaseId: existing.id, bbcode: description },
        });
      } else if (description && existing.presentation) {
        await prisma.c411Presentation.update({
          where: { releaseId: existing.id },
          data: { bbcode: description },
        });
      }
      updated++;
    } else {
      const byHash = torrent.infoHash
        ? await prisma.c411Release.findUnique({ where: { infoHash: torrent.infoHash }, include: { presentation: true } })
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
            tmdbData: tmdbData ?? byHash.tmdbData,
            nfoContent: nfoContent ?? byHash.nfoContent,
            syncedAt: now,
          },
        });
        if (description && !byHash.presentation) {
          await prisma.c411Presentation.create({
            data: { releaseId: byHash.id, bbcode: description },
          });
        } else if (description && byHash.presentation) {
          await prisma.c411Presentation.update({
            where: { releaseId: byHash.id },
            data: { bbcode: description },
          });
        }
        updated++;
      } else {
        const release = await prisma.c411Release.create({
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
            tmdbData: tmdbData,
            nfoContent: nfoContent,
            syncedAt: now,
          },
        });
        if (description) {
          await prisma.c411Presentation.create({
            data: { releaseId: release.id, bbcode: description },
          });
        }
        created++;
      }
    }

    // Small delay to avoid hammering C411 API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[c411:sync] Done: ${created} created, ${updated} updated`);
  return { created, updated };
}
