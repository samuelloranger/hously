/**
 * Sync C411 releases into Hously's database.
 */

import { prisma } from '../../db';
import { fetchMyTorrents, fetchTorrentDetail } from './torrents';
import type { C411Session, C411Torrent } from './types';

export interface SyncResult {
  created: number;
  updated: number;
  merged: number;
}

/**
 * Normalize a release name for fuzzy matching.
 * C411 renames H264→x264, H265→x265 during validation, so we normalize those.
 */
function normalizeName(name: string): string {
  return name
    .replace(/\bH\.?264\b/gi, 'x264')
    .replace(/\bH\.?265\b/gi, 'x265')
    .replace(/\bHEVC\b/gi, 'x265')
    .toLowerCase();
}

/**
 * Normalize name and strip the release group (everything after the last hyphen).
 * Handles cases where C411 changes the group name during validation.
 */
function normalizeNameWithoutGroup(name: string): string {
  const normalized = normalizeName(name);
  const lastHyphen = normalized.lastIndexOf('-');
  return lastHyphen > 0 ? normalized.substring(0, lastHyphen) : normalized;
}

/**
 * Fetch all torrents by a specific uploader (the C411 display username), paginating.
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
 * Update stats and sync metadata on an existing release.
 * Never overwrites existing BBCode presentation with C411's HTML description.
 */
async function updateExistingRelease(
  existing: { id: number; tmdbId: number | null; tmdbData: any; nfoContent: string | null; presentation: { id: number; bbcode: string } | null },
  torrent: C411Torrent,
  detail: { description: string | null; tmdbData: any; nfoContent: string | null },
  now: Date,
  extraData?: Record<string, any>,
) {
  // Extract TMDB ID from tmdbData if the release doesn't have one yet
  const newTmdbData = detail.tmdbData ?? existing.tmdbData;
  const tmdbId = existing.tmdbId ?? (newTmdbData?.id ? parseInt(String(newTmdbData.id), 10) : null) ?? undefined;
  const tmdbType = tmdbId && !existing.tmdbId
    ? (newTmdbData?.media_type || (newTmdbData?.title ? 'movie' : newTmdbData?.name ? 'tv' : null))
    : undefined;
  const imdbId = tmdbId && !existing.tmdbId ? (newTmdbData?.imdb_id || null) : undefined;

  await prisma.c411Release.update({
    where: { id: existing.id },
    data: {
      c411TorrentId: torrent.id,
      infoHash: torrent.infoHash,
      name: torrent.name,
      status: torrent.status,
      seeders: torrent.seeders,
      leechers: torrent.leechers,
      completions: torrent.completions,
      tmdbData: newTmdbData,
      nfoContent: detail.nfoContent ?? existing.nfoContent,
      ...(tmdbId !== undefined ? { tmdbId } : {}),
      ...(tmdbType !== undefined ? { tmdbType } : {}),
      ...(imdbId !== undefined ? { imdbId } : {}),
      syncedAt: now,
      ...extraData,
    },
  });

  // Only set presentation if none exists (don't overwrite BBCode with HTML)
  if (detail.description && !existing.presentation) {
    await prisma.c411Presentation.create({
      data: { releaseId: existing.id, bbcode: detail.description },
    });
  }
}

/**
 * Pull the user's C411 uploads and upsert into C411Release table.
 * Uses the C411 display username (from plugin config) as the uploader filter.
 *
 * Matching priority:
 * 1. By c411TorrentId (exact)
 * 2. By infoHash (exact)
 * 3. By normalized name against "local" releases (fuzzy — handles H264→x264 renames)
 *
 * Never overwrites existing BBCode presentations with C411's HTML descriptions.
 */
export async function syncC411Releases(session: C411Session, username: string): Promise<SyncResult> {
  console.log(`[c411:sync] Fetching all torrents for uploader "${username}"...`);
  const torrents = await fetchAllByUploader(session, username);
  console.log(`[c411:sync] Found ${torrents.length} torrents`);

  let created = 0;
  let updated = 0;
  let merged = 0;
  const now = new Date();

  // Pre-fetch all local releases for name-based matching
  const localReleases = await prisma.c411Release.findMany({
    where: { status: 'local' },
    select: { id: true, name: true, tmdbId: true, tmdbData: true, nfoContent: true, presentation: true },
  });
  const localByNormalizedName = new Map<string, typeof localReleases[0]>();
  const localByNormalizedNameNoGroup = new Map<string, typeof localReleases[0]>();
  for (const r of localReleases) {
    localByNormalizedName.set(normalizeName(r.name), r);
    localByNormalizedNameNoGroup.set(normalizeNameWithoutGroup(r.name), r);
  }

  for (const torrent of torrents) {
    // Fetch detail to get the description (HTML), TMDB data, NFO
    let description: string | null = null;
    let tmdbData: any = null;
    let nfoContent: string | null = null;
    try {
      const detailResult = await fetchTorrentDetail(session, torrent.infoHash);
      description = detailResult.description || null;
      tmdbData = detailResult.metadata?.tmdbData || null;
      nfoContent = detailResult.metadata?.nfoContent || null;
    } catch (err) {
      console.warn(`[c411:sync] Failed to fetch detail for ${torrent.name}: ${err}`);
    }

    // Extract TMDB ID from tmdbData if available
    const extractedTmdbId = tmdbData?.id ? parseInt(String(tmdbData.id), 10) : null;
    const extractedTmdbType = tmdbData?.media_type || (tmdbData?.title ? 'movie' : tmdbData?.name ? 'tv' : null);
    const extractedImdbId = tmdbData?.imdb_id || null;

    const detail = { description, tmdbData, nfoContent };

    // 1. Match by c411TorrentId
    const byTorrentId = await prisma.c411Release.findUnique({
      where: { c411TorrentId: torrent.id },
      select: { id: true, tmdbId: true, tmdbData: true, nfoContent: true, presentation: true },
    });

    if (byTorrentId) {
      await updateExistingRelease(byTorrentId, torrent, detail, now);
      updated++;
    } else {
      // 2. Match by infoHash
      const byHash = torrent.infoHash
        ? await prisma.c411Release.findUnique({ where: { infoHash: torrent.infoHash }, select: { id: true, tmdbId: true, tmdbData: true, nfoContent: true, presentation: true } })
        : null;

      if (byHash) {
        await updateExistingRelease(byHash, torrent, detail, now);
        updated++;
      } else {
        // 3. Match by normalized name against local releases
        const normalizedTorrentName = normalizeName(torrent.name);
        let localMatch = localByNormalizedName.get(normalizedTorrentName);

        // 3b. Fallback: match by name without release group (handles group renames)
        if (!localMatch) {
          const normalizedNoGroup = normalizeNameWithoutGroup(torrent.name);
          localMatch = localByNormalizedNameNoGroup.get(normalizedNoGroup);
        }

        if (localMatch) {
          console.log(`[c411:sync] Merging C411 torrent "${torrent.name}" with local release "${localMatch.name}" (id=${localMatch.id})`);
          await updateExistingRelease(localMatch, torrent, detail, now);
          // Remove from maps so it can't be matched again
          localByNormalizedName.delete(normalizeName(localMatch.name));
          localByNormalizedNameNoGroup.delete(normalizeNameWithoutGroup(localMatch.name));
          merged++;
        } else {
          // 4. No match — create new
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
              tmdbId: extractedTmdbId,
              tmdbType: extractedTmdbType,
              imdbId: extractedImdbId,
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
    }

    // Delay between detail fetches to avoid 429
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[c411:sync] Done: ${created} created, ${updated} updated, ${merged} merged`);
  return { created, updated, merged };
}
