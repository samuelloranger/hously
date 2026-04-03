import { RECIPES_ENDPOINTS } from '../endpoints/recipes';
import { CHORES_ENDPOINTS } from '../endpoints/chores';

function stripApiSuffix(baseUrl: string): string {
  return baseUrl.replace(/\/api\/?$/, '');
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getDashboardMediaUrl(path: string | null | undefined, baseUrl: string = ''): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return joinUrl(stripApiSuffix(baseUrl), path);
}

export function getRecipeImageUrl(imagePath: string | null | undefined, baseUrl: string = ''): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return joinUrl(stripApiSuffix(baseUrl), RECIPES_ENDPOINTS.IMAGE(imagePath));
}

export function getChoreImageUrl(imagePath: string | null | undefined, baseUrl: string = ''): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return joinUrl(stripApiSuffix(baseUrl), CHORES_ENDPOINTS.IMAGE(imagePath));
}

export function getChoreThumbnailUrl(imagePath: string | null | undefined, baseUrl: string = ''): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return joinUrl(stripApiSuffix(baseUrl), CHORES_ENDPOINTS.THUMBNAIL(imagePath));
}

// --- Media Normalization & Detection ---

function normalizeResolution(value: string | null | undefined): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes('2160') || upper.includes('4K') || upper.includes('UHD')) return '2160P';
  if (upper.includes('1080')) return '1080P';
  if (upper.includes('720')) return '720P';
  if (upper.includes('480')) return '480P';
  return null;
}

function normalizeVideoCodec(format: string, profile: string = '', codecId: string = ''): string {
  const f = format.toLowerCase();
  const cid = codecId.toLowerCase();
  if (f === 'hevc' || f === 'h.265' || cid.includes('hev1') || cid.includes('hvc1')) return 'H265';
  if (f === 'avc' || f === 'h.264' || cid.includes('avc1') || cid.includes('v_mpeg4/iso/avc')) return 'H264';
  if (f === 'av1') return 'AV1';
  if (f === 'mpeg video') return profile.includes('4') ? 'MPEG-4' : 'MPEG-2';
  if (f === 'vp9') return 'VP9';
  return format || 'Unknown';
}

function normalizeContainer(format: string): string {
  const f = format.toLowerCase();
  if (f === 'matroska') return 'MKV';
  if (f === 'mpeg-4' || f === 'mp4') return 'MP4';
  if (f === 'avi') return 'AVI';
  if (f === 'mpeg-ts' || f === 'mpegts') return 'TS';
  if (f === 'wmv') return 'WMV';
  return format.toUpperCase();
}

function normalizeAudioCodec(format: string, commercialName: string, _codecId: string = ''): string {
  const f = format.toLowerCase();
  const cn = commercialName.toLowerCase();
  if (f === 'ac-3' || f === 'ac3') return 'AC3';
  if (f === 'e-ac-3' || f === 'eac3') return 'EAC3';
  if (cn.includes('dts-hd ma') || cn.includes('dts-hd master')) return 'DTS-HD MA';
  if (cn.includes('dts-hd')) return 'DTS-HD';
  if (f === 'dts') return 'DTS';
  if (cn.includes('truehd') || f.includes('truehd')) return 'TrueHD';
  if (f === 'aac') return 'AAC';
  if (f === 'flac') return 'FLAC';
  if (f === 'opus') return 'Opus';
  if (f === 'vorbis') return 'Vorbis';
  if (f === 'mp3' || f === 'mpeg audio') return 'MP3';
  if (f === 'pcm') return 'PCM';
  return format || 'Unknown';
}

function normalizeSubtitleFormat(format: string, codecId: string): string {
  const f = format.toLowerCase();
  const cid = codecId.toLowerCase();
  if (f === 'utf-8' || f === 'ascii' || cid.includes('s_text/utf8') || cid === 's_utf8') return 'SRT';
  if (f === 'subrip' || cid.includes('srt')) return 'SRT';
  if (f === 'ass' || f === 'ssa' || cid.includes('s_text/ass') || cid.includes('s_text/ssa')) return 'ASS';
  if (f === 'pgs' || cid.includes('s_hdmv/pgs')) return 'PGS';
  if (f === 'vobsub' || cid.includes('s_vobsub')) return 'VobSub';
  if (f === 'webvtt' || cid.includes('webvtt')) return 'WebVTT';
  if (f === 'dvb subtitle' || f === 'dvbsub') return 'DVB';
  return format || 'N/A';
}

function detectSource(fileName: string): string {
  const name = fileName.toLowerCase();
  let source = '';
  if (/blu-?ray|bdremux|bdmux/.test(name)) source = 'BluRay';
  else if (/web-?dl/.test(name)) source = 'WEB-DL';
  else if (/webrip/.test(name)) source = 'WEBRip';
  else if (/bdrip/.test(name)) source = 'BDRip';
  else if (/hdrip/.test(name)) source = 'HDRip';
  else if (/dvdrip/.test(name)) source = 'DVDRip';
  else if (/hdtv/.test(name)) source = 'HDTV';
  else if (/web(?!.*(dl|rip))/.test(name)) source = 'WEB';

  let encoding = '';
  if (/hdlight/.test(name)) encoding = 'HDLight';
  else if (/remux/.test(name)) encoding = 'Remux';

  if (encoding === 'HDLight' && !source) source = 'BluRay';
  if (encoding === 'HDLight') return 'HDLight';
  if (source && encoding) return `${source} (${encoding})`;
  if (source) return source;
  if (encoding) return encoding;
  return 'N/A';
}

function detectLangFromName(name: string): { lang: string; label: string }[] {
  const n = name.toUpperCase();
  const langs: { lang: string; label: string }[] = [];

  if (/\bMULTI\.VF2\b/.test(n)) {
    langs.push({ lang: 'French', label: 'VFF' }, { lang: 'French', label: 'VFQ' }, { lang: 'English', label: 'VO' });
    return langs;
  }
  if (/\bMULTI\b/.test(n)) {
    if (/\bVFF\b/.test(n)) langs.push({ lang: 'French', label: 'VFF' });
    else if (/\bVFQ\b/.test(n) || /\bVQC\b/.test(n)) langs.push({ lang: 'French', label: 'VFQ' });
    else if (/\bVFI\b/.test(n)) langs.push({ lang: 'French', label: 'VFI' });
    else langs.push({ lang: 'French', label: 'French' });
    langs.push({ lang: 'English', label: 'VO' });
    return langs;
  }

  if (/\bVFF\b/.test(n)) return [{ lang: 'French', label: 'VFF' }];
  if (/\bVFQ\b/.test(n) || /\bVQC\b/.test(n)) return [{ lang: 'French', label: 'VFQ' }];
  if (/\bVFI\b/.test(n)) return [{ lang: 'French', label: 'VFI' }];
  if (/\bTRUEFRENCH\b/.test(n)) return [{ lang: 'French', label: 'TRUEFRENCH' }];
  if (/\bFRENCH\b/.test(n)) return [{ lang: 'French', label: 'French' }];
  if (/\bVOSTFR\b/.test(n)) return [{ lang: 'French', label: 'VOSTFR (sous-titres)' }];
  return [];
}

function detectSourceType(value: string | null | undefined): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('bdmv')) return 'BDMV';
  if (lower.includes('remux')) return 'REMUX';
  if (lower.includes('4klight')) return '4KLIGHT';
  if (lower.includes('hdlight')) return 'HDLIGHT';
  if (lower.includes('web-dl') || lower.includes('webdl')) return 'WEB-DL';
  if (lower.includes('webrip')) return 'WEBRIP';
  if (lower.includes('bdrip') || lower.includes('brrip')) return 'BDRIP';
  if (lower.includes('bluray') || lower.includes('blu-ray')) return 'BLURAY';
  if (/\bweb\b/.test(lower)) return 'WEB';
  if (lower.includes('hdtv')) return 'HDTV';
  if (lower.includes('dvd')) return 'DVDRIP';
  return null;
}

function detectHdr(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\b(hdr10|hdr|dolby[ .-]?vision|dv)\b/i.test(value);
}

function parseVideoBitrateMbps(value: string | null | undefined): number | null {
  if (!value || value === 'N/A') return null;
  const mbpsMatch = value.match(/([\d.]+)\s*Mbps/i);
  if (mbpsMatch) return Number(mbpsMatch[1]);
  const kbpsMatch = value.match(/([\d.]+)\s*kbps/i);
  if (kbpsMatch) return Number(kbpsMatch[1]) / 1000;
  return null;
}

// --- Language Mapping ---

const FLAG_CODE_MAP: Record<string, string> = {
  jpn: 'jp', ja: 'jp', ger: 'de', deu: 'de', de: 'de',
  spa: 'es', es: 'es', ita: 'it', it: 'it',
  por: 'pt', pt: 'pt', rus: 'ru', ru: 'ru',
  kor: 'kr', ko: 'kr', zho: 'cn', zh: 'cn',
  ara: 'sa', ar: 'sa',
};

const FULL_LANG_NAME_MAP: Record<string, string> = {
  fr: 'Français', fre: 'Français', fra: 'Français', french: 'Français',
  en: 'Anglais', eng: 'Anglais', english: 'Anglais',
  de: 'Allemand', ger: 'Allemand', deu: 'Allemand',
  es: 'Espagnol', spa: 'Espagnol',
  it: 'Italien', ita: 'Italien',
  pt: 'Portugais', por: 'Portugais',
  ja: 'Japonais', jpn: 'Japonais',
  ko: 'Coréen', kor: 'Coréen',
  zh: 'Chinois', zho: 'Chinois',
  ru: 'Russe', rus: 'Russe',
  ar: 'Arabe', ara: 'Arabe',
  nl: 'Néerlandais', dut: 'Néerlandais', nld: 'Néerlandais',
  pl: 'Polonais', pol: 'Polonais',
  sv: 'Suédois', swe: 'Suédois',
  da: 'Danois', dan: 'Danois',
  no: 'Norvégien', nor: 'Norvégien',
  fi: 'Finnois', fin: 'Finnois',
  tr: 'Turc', tur: 'Turc',
  el: 'Grec', gre: 'Grec', ell: 'Grec',
  he: 'Hébreu', heb: 'Hébreu',
  hi: 'Hindi', hin: 'Hindi',
  th: 'Thaï', tha: 'Thaï',
  vi: 'Vietnamien', vie: 'Vietnamien',
  ro: 'Roumain', rum: 'Roumain', ron: 'Roumain',
  cs: 'Tchèque', cze: 'Tchèque', ces: 'Tchèque',
  hu: 'Hongrois', hun: 'Hongrois',
};

const SHORT_LABEL_MAP: Record<string, string> = {
  fre: 'French', fra: 'French', fr: 'French',
  eng: 'VO', en: 'VO',
};

/** Normalize BCP-47 tags like "en-US" or "fr-CA" to their base language code. */
function normalizeLangCode(code: string): string {
  return code.toLowerCase().split('-')[0];
}

function getFlagCode(langCode: string, title: string): string {
  const t = (title || langCode).toLowerCase();
  const lc = normalizeLangCode(langCode);
  if (t.includes('vfq') || t.includes('vqc') || t.includes('quebec') || t.includes('canadien') || t.includes('canadian') || t.includes('canada')) return 'ca';
  if (t.includes('vff') || t.includes('france') || t.includes('truefrench') || t.includes('european')) return 'fr';
  if (t.includes('french') || t.includes('vfi') || lc === 'fre' || lc === 'fra' || lc === 'fr') return 'fr';
  if (t.includes('vo') || t.includes('english') || lc === 'eng' || lc === 'en') return 'gb';
  return FLAG_CODE_MAP[lc] ?? 'un';
}

function getShortLangLabel(langCode: string, title: string): string {
  const t = (title || '').toLowerCase();
  const lc = normalizeLangCode(langCode);
  if (t.includes('vfq') || t.includes('vqc') || t.includes('canadian') || t.includes('canada') || t.includes('quebec') || t.includes('québ')) return 'VFQ';
  if (t.includes('vff') || t.includes('european') || t.includes('france')) return 'VFF';
  if (t.includes('vfi')) return 'VFI';
  if (t.includes('truefrench')) return 'TRUEFRENCH';
  if (t.includes('french') || t === 'francais') return 'French';
  if (t.includes('vo') || t === 'english' || /\beng\b/.test(t)) return 'VO';
  const fromLangCode = SHORT_LABEL_MAP[lc];
  if (fromLangCode) return fromLangCode;
  if (title && !/\d/.test(title)) return title;
  return langCode;
}

function getFullLangName(langCode: string, title: string): string {
  const lc = normalizeLangCode(langCode);
  const t = (title || langCode).toLowerCase();
  return FULL_LANG_NAME_MAP[lc] ?? FULL_LANG_NAME_MAP[t] ?? (title || langCode);
}

// --- Release Parsing ---

function parseReleaseName(name: string): { title: string; year: string } {
  let clean = name.replace(/\.[^.]+$/, '');
  const yearMatch = clean.match(/(19|20)\d{2}/);
  const year = yearMatch?.[0] ?? '';
  let title: string;
  if (year) {
    title = clean.replace(new RegExp(`[\\s.\\-_]*[\\(\\[]?${year}.*`), '');
  } else {
    title = clean.replace(
      /[.\-_ ](MULTi|FRENCH|VOSTFR|VFF|VFQ|TRUEFRENCH|1080p|720p|2160p|4K|BluRay|WEB|HDRip|BDRip|HDTV|x26[45]|HEVC|S\d{2}|iNTEGRALE|Integrale|Saison|Season).*/i,
      '',
    );
  }
  title = title.replace(/[._]/g, ' ').replace(/\s*-\s*$/, '').trim().replace(/\s+/g, ' ');
  return { title, year };
}

function isTvShow(name: string): boolean {
  return /S\d{2}|Saison|Season|Complete|Int[eé]grale/i.test(name);
}

function formatRuntime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }
  return `${minutes}min`;
}

/** Encode an ArrayBuffer to base64 without blowing the call stack. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(chunks.join(''));
}

/** Only allow safe URL schemes to prevent XSS. */
export function sanitizeUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '#';
}
