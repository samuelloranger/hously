/**
 * Shared Release utilities for both frontend and backend (initially designed for C411).
 */

/**
 * Capitalize first letter of a status string for display.
 */
export function capitalizeStatus(status: string): string {
  if (!status) return '';
  const normalized = status.replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// --- Release Naming ---

const VIDEO_EXTENSIONS = /\.(mkv|avi|mp4|m4v|wmv|ts|m2ts)$/i;

const TECHNICAL_TOKENS = /^(2160p|1080p|720p|480p|4K|WEB|WEB[-.]?DL|WEBRip|BluRay|BDRip|HDRip|DVDRip|HDTV|REMUX|HDLight|x264|x265|H264|H265|HEVC|AVC|AV1|AAC|AC3|EAC3|DTS|FLAC|TrueHD|MULTI|VFF|VFQ|VFI|FRENCH|TRUEFRENCH)$/i;

export function parseTeam(releaseName: string): string {
  const normalized = releaseName.replace(VIDEO_EXTENSIONS, '').trim().replace(/\s*[\[(].*[\])]$/, '');
  const match = normalized.match(/-([A-Za-z0-9_]+)$/);
  if (!match) return 'N/A';
  // Reject matches that are technical tokens (resolution, codec, source, etc.)
  if (TECHNICAL_TOKENS.test(match[1])) return 'N/A';
  return match[1];
}

export function parseSeason(releaseName: string): string | null {
  const saisonMatch = releaseName.match(/Saison[.\s]?(\d+)/i);
  if (saisonMatch) return `Saison ${String(parseInt(saisonMatch[1])).padStart(2, '0')}`;
  const sMatch = releaseName.match(/S(\d{2})(E\d{2})?/i);
  if (sMatch) return `Saison ${sMatch[1]}`;
  if (/int[eé]grale/i.test(releaseName)) return 'Integrale';
  return null;
}

export function formatChannels(channels: string): string {
  const ch = parseInt(channels);
  if (isNaN(ch)) return channels;
  if (ch === 1) return '1.0';
  if (ch === 2) return '2.0';
  if (ch === 6) return '5.1';
  if (ch === 8) return '7.1';
  return `${ch - 1}.1`;
}

export interface ReleaseInfo {
  title: string;
  year?: string;
  languages?: string;
  resolution?: string;
  source?: string;
  hdr?: string;
  audioCodec?: string;
  audioChannels?: string;
  videoCodec?: string;
}

export function buildReleaseName(info: ReleaseInfo, originalName: string, teamOverride?: string): string {
  const tokens: string[] = [];

  const cleanTitle = info.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '.')
    .replace(/[…]+/g, '')
    .replace(/[:!?,;()[\]{}«»"]/g, '')
    .replace(/[-–—]/g, '.')
    .replace(/\s+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
  tokens.push(cleanTitle);

  if (info.year) tokens.push(info.year);

  const season = parseSeason(originalName);
  if (season) {
    if (/^Saison\s+(\d+)$/i.test(season)) {
      tokens.push(`S${season.replace(/^Saison\s+/i, '')}`);
    } else if (/integrale/i.test(season)) {
      tokens.push('INTEGRALE');
    }
  }

  if (info.languages) tokens.push(...info.languages.split('.'));
  if (info.resolution) tokens.push(info.resolution.replace(/\s*\(4K\)/i, '').replace(/^4K$/i, '2160p'));
  if (info.source) tokens.push(info.source.replace(/WEB-?DL|WEBRip/i, 'WEB'));
  if (info.hdr) tokens.push(info.hdr);

  if (info.audioCodec) {
    const codec = info.audioCodec.replace(/\s+/g, '.').replace(/^AAC\.LC$/i, 'AAC').replace(/^DTS\.ES$/i, 'DTS');
    tokens.push(codec);
  }
  if (info.audioChannels) tokens.push(info.audioChannels);
  if (info.videoCodec) {
    const isWebSource = /WEB/i.test(info.source ?? '');
    const codec = isWebSource
      ? info.videoCodec.replace(/^H264$/i, 'x264').replace(/^H265$/i, 'x265')
      : info.videoCodec;
    tokens.push(codec);
  }

  // Priority: explicit override > parsed from filename
  const rawTeam = teamOverride || parseTeam(originalName);
  const team = rawTeam === 'N/A' ? 'NOTAG' : rawTeam;
  let result = tokens.join('.') + `-${team}`;

  result = result
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, '')
    .replace(/^\.+|\.+$/g, '');
  return result;
}

// --- Resolution ---

export function resolveCategory(
  category?: string,
  tmdbType?: string,
): { categoryId: number; subcategoryId: number } {
  const cat = (category ?? '').toLowerCase();
  const type = (tmdbType ?? '').toLowerCase();

  if (cat.includes('série') || cat.includes('series') || type === 'tv') {
    return { categoryId: 1, subcategoryId: 7 };
  }
  if (cat.includes('animation') || type === 'animation') {
    return { categoryId: 1, subcategoryId: 1 };
  }
  if (cat.includes('documentaire') || type === 'documentary') {
    return { categoryId: 1, subcategoryId: 4 };
  }
  return { categoryId: 1, subcategoryId: 6 }; // Film
}

export function resolveLanguage(releaseName: string): number[] {
  const name = releaseName.toUpperCase();
  if (name.includes('MULTI') && name.includes('VF2')) return [422];
  if (name.includes('MULTI') && name.includes('VFQ')) return [5];
  if (name.includes('MULTI')) return [4];
  if (name.includes('VFQ')) return [6];
  if (name.includes('VFF') || name.includes('TRUEFRENCH')) return [2];
  if (name.includes('VOSTFR')) return [8];
  if (name.includes('VFSTFR')) return [7];
  return [4];
}

const GENRE_MAP: Record<string, number> = {
  action: 39, animalier: 40, animation: 41, aventure: 44,
  biopic: 46, 'comédie dramatique': 50, comédie: 49, crime: 81,
  documentaire: 56, drame: 57, famille: 61, familial: 61,
  fantastique: 62, fantasy: 62, guerre: 66, histoire: 67,
  historique: 67, horreur: 59, épouvante: 59, musical: 73,
  musique: 73, mystère: 92, policier: 81, romance: 84,
  'science-fiction': 86, 'science fiction': 86, thriller: 92,
  western: 95, sport: 89,
};

export function resolveGenres(description: string): number[] {
  const match = description.match(/Genres\s*:\s*(?:\[\/b\]\s*)?(.+?)(?:\n|\[|<)/i);
  if (!match) return [];

  const genreStr = match[1].trim();
  const genres = genreStr.split(/\s*,\s*/);
  const ids: number[] = [];

  for (const g of genres) {
    const key = g.trim().toLowerCase();
    if (GENRE_MAP[key] != null && !ids.includes(GENRE_MAP[key])) {
      ids.push(GENRE_MAP[key]);
    }
  }
  return ids;
}

export function extractHdrFromName(name: string): string | null {
  const match = name.match(/\b(HDR10\+?|HDR|DV|Dolby\.?Vision|10bit|4KLight)\b/i);
  return match ? match[1] : null;
}

export function extractTitleFromDescription(description: string): string | null {
  const match = description.match(/\[h1\](.*?)\[\/h1\]/i);
  return match ? match[1].trim() : null;
}

export function extractYearFromDescription(description: string): string | null {
  const match = description.match(/\[h2\].*?(\d{4}).*?\[\/h2\]/i);
  return match ? match[1] : null;
}
