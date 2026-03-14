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
 * Discover the authenticated user's C411 display username.
 * Fetches page 1 of all torrents and finds one with isOwner=true.
 */
async function discoverC411Username(session: C411Session): Promise<string | null> {
  // Fetch a small page — we just need to find one torrent we own
  const response = await fetchMyTorrents(session, { page: 1, perPage: 25 });
  const owned = response.data.find((t) => t.isOwner);
  return owned?.uploader ?? null;
}

/**
 * Fetch all torrents by a specific uploader, paginating.
 */
async function fetchAllByUploader(session: C411Session, uploader: string): Promise<C411Torrent[]> {
  const all: C411Torrent[] = [];
  let page = 1;

  while (true) {
    const response = await fetchMyTorrents(session, { uploader, page, perPage: 100 });
    all.push(...response.data);
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
  // Step 1: Discover our C411 username
  console.log('[c411:sync] Discovering C411 username...');
  const username = await discoverC411Username(session);
  if (!username) {
    console.log('[c411:sync] Could not find any owned torrents to discover username');
    return { created: 0, updated: 0 };
  }
  console.log(`[c411:sync] Username: ${username}`);

  // Step 2: Fetch all torrents by this uploader
  console.log(`[c411:sync] Fetching all torrents for uploader ${username}...`);
  const torrents = await fetchAllByUploader(session, username);
  console.log(`[c411:sync] Found ${torrents.length} torrents`);

  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const torrent of torrents) {
    // Fetch detail to get the description (BBCode), TMDB data, NFO
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

    // Delay between detail fetches to avoid 429
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[c411:sync] Done: ${created} created, ${updated} updated`);
  return { created, updated };
}
