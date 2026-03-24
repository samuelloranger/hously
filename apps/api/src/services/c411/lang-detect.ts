/**
 * Language detection from media files via ffprobe.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { LanguageTag } from './types';

const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.avi', '.wmv', '.ts', '.m2ts']);

export async function findMediaFile(contentPath: string): Promise<string | null> {
  const s = await stat(contentPath).catch(() => null);
  if (!s) return null;
  if (s.isFile()) {
    return VIDEO_EXTS.has(extname(contentPath).toLowerCase()) ? contentPath : null;
  }
  if (s.isDirectory()) return findLargestVideo(contentPath);
  return null;
}

async function findLargestVideo(dir: string): Promise<string | null> {
  let largest: { path: string; size: number } | null = null;
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!VIDEO_EXTS.has(extname(entry.name).toLowerCase())) continue;
    const fullPath = join(entry.parentPath ?? dir, entry.name);
    const s = await stat(fullPath);
    if (!largest || s.size > largest.size) largest = { path: fullPath, size: s.size };
  }
  return largest?.path ?? null;
}

interface AudioTrack {
  language: string;
  title: string;
}

async function getAudioLanguages(filePath: string): Promise<AudioTrack[]> {
  const proc = Bun.spawn(
    ['ffprobe', '-v', 'quiet', '-show_entries', 'stream=index:stream_tags=language,title', '-select_streams', 'a', '-of', 'json', filePath],
    { stdout: 'pipe' as const, stderr: 'pipe' as const, env: { ...process.env, LANG: 'C.UTF-8' } },
  );
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return [];
  try {
    const data = JSON.parse(output);
    return (data.streams ?? []).map((s: any) => ({
      language: s.tags?.language ?? 'und',
      title: s.tags?.title ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * If TMDB identifies the production as Canadian and the detected tag is a generic
 * French variant, upgrade to the Québécois equivalent.
 */
export function applyCanadianLanguageOverride(languageTag: LanguageTag, productionCountries: string[]): LanguageTag {
  if (!productionCountries.some((c) => /canada/i.test(c))) return languageTag;
  if (languageTag === 'VFF') return 'VFQ';
  if (languageTag === 'MULTI.VFF') return 'MULTI.VFQ';
  return languageTag;
}

export async function detectLanguages(contentPath: string): Promise<LanguageTag> {
  const mediaFile = await findMediaFile(contentPath);
  if (!mediaFile) return 'UNKNOWN';

  const tracks = await getAudioLanguages(mediaFile);
  if (tracks.length === 0) return 'UNKNOWN';

  let frCount = 0;
  let enCount = 0;
  let hasVff = false;
  let hasVfq = false;
  let hasVfi = false;

  for (const track of tracks) {
    const lang = track.language.toLowerCase().split('-')[0];
    const title = track.title.toLowerCase();
    if (/^(fre|fra|fr)$/.test(lang)) {
      frCount++;
      if (/vff|france|truefrench|european/.test(title)) hasVff = true;
      else if (/vfq|québ|quebec|qué|canadien|canadian/.test(title)) hasVfq = true;
      else if (/vfi|international/.test(title)) hasVfi = true;
    } else if (/^(eng|en)$/.test(lang)) {
      enCount++;
    }
  }

  if (frCount > 0 && enCount > 0) {
    if (frCount >= 2) return 'MULTI.VF2';
    if (hasVff) return 'MULTI.VFF';
    if (hasVfq) return 'MULTI.VFQ';
    if (hasVfi) return 'MULTI.VFI';
    return 'MULTI.VFF'; // Default to VFF when variant unspecified
  }
  if (frCount > 0) {
    if (hasVff) return 'VFF';
    if (hasVfq) return 'VFQ';
    if (hasVfi) return 'VFI';
    return 'VFF'; // C411 requires specific tag — default to VFF when unspecified
  }
  if (enCount > 0) return 'EN';
  return 'UNKNOWN';
}
