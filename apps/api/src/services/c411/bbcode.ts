/**
 * BBCode presentation generator for C411 releases.
 */

import type { TmdbDetails } from './tmdb';
import type { MediaInfoData, SubtitleStreamInfo } from './mediainfo';
import { buildC411ReleaseName, formatChannels, parseSeason, parseTeam, extractHdrFromName, type C411ReleaseInfo } from './release-name';
import { getFlagCode, getShortLangLabel, getFullLangName } from './lang-mapping';
import { formatSize } from './utils';

const BBCODE_TEMPLATE = `[h1]{TMDB_TITLE}[/h1]


{IF MOVIE}
[h2]({TMDB_RELEASE_YEAR})[/h2]
{ELSE IF TV SHOW}
[h2](Saison {TMDB_SEASON_NUMBER})[/h2]
{/IF}


[img]{TMDB_POSTER_URL}[/img]
[img]https://i.ibb.co/bjykMFB5/undefined-Imgur-2.png[/img]


[b]Pays :[/b] {TMDB_ORIGIN_COUNTRY}
[b]Genres :[/b] {TMDB_GENRES}
[b]Date de sortie :[/b] {TMDB_RELEASE_DATE}
[b]Durée :[/b] {TMDB_LENGTH}
[b]Réalisateur(s) :[/b] {TMDB_DIRECTOR}
[b]Acteur(s) :[/b] {TMDB_MAIN_CAST}
[b]Note TMDB :[/b] {TMDB_NOTE}
[b]IMDB :[/b] [url=https://www.imdb.com/title/{TMDB_ID}/]Fiche du Film[/url]

[b]
[/b]

[b][img]https://i.ibb.co/5XmM7ZGB/undefined-Imgur-3.png[/img][/b]

[b]
{TMDB_DESCRIPTION}
[/b]

[b][img]https://i.ibb.co/1JLfJk7n/undefined-Imgur-1.png[/img][/b]

[b]
Source : {SOURCE_TYPE} {SI WEB}{TMDB_ORIGINAL_PLATFORM}{END SI}
Conteneur : {CONTAINER}
Résolution : {RESOLUTION}
Codec Vidéo : {CODEC}
Débit vidéo : {BITRATE}
Codec Audio : {AUDIO_CODEC}
Bitrate Audio : {AUDIO_BITRATE}
Canaux : {AUDIO_CHANNELS}
[/b]

[b][img]https://i.ibb.co/fY1QSG11/undefined-Imgur-4.png[/img][/b]

[b][/b]
[table]
[tr][th][b]#[/b][/th][th][b]Langue[/b][/th][th][b]Canaux[/b][/th][th][b]Codec[/b][/th][th][b]Bitrate[/b][/th][/tr]
[tr][td][b]{LANGUAGE_INDEX}[/b][/td][td][b][img=20x15]https://flagcdn.com/20x15/{LANGUAGE_FLAG}.png[/img] {LANGUAGE}[/b][/td][td][b]{LANGUAGE_CHANNELS}[/b][/td][td][b]{LANGUAGE_CODEC}[/b][/td][td][b]{LANGUAGE_BITRATE}[/b][/td][/tr]
[/table]

[b][img]https://i.ibb.co/b54zr3nG/undefined-Imgur-5.png[/img][/b]

[b][/b]
[table]
[tr][th][b]#[/b][/th][th][b]Langue[/b][/th][th][b]Format[/b][/th][th][b]Type[/b][/th][/tr]
[tr][td][b]{LANGUAGE_INDEX}[/b][/td][td][b][img=20x15]https://flagcdn.com/20x15/{LANGUAGE_FLAG}.png[/img] {LANGUAGE}[/b][/td][td][b]{LANGUAGE_FORMAT}[/b][/td][td][b]{LANGUAGE_TYPE}[/b][/td][/tr]
[/table]

[b][img]https://i.ibb.co/V6h3X4n/undefined-Imgur.png[/img][/b]

[b]
Release : {RELEASE_NAME}
Team : {RELEASE_TEAM}
Nombre de fichier(s) : {NBR_FICHIERS}
Poids Total : {POIDS_TOTAL}
Bannières de prez par [/b][url=https://c411.org/user/djoontah][b]djoontah[/b][/url]`;

// ─── Helpers ─────────────────────────────────────────────

export function formatFrenchDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function normalizeBitrate(value: string): string {
  return value.replace('kbps', 'kb/s').replace('Mbps', 'Mb/s');
}

export function replacePlaceholders(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Z0-9_ ]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function renderConditionals(template: string, tmdb: TmdbDetails): string {
  return template.replace(
    /\{IF MOVIE\}\s*([\s\S]*?)\s*\{ELSE IF TV SHOW\}\s*([\s\S]*?)\s*\{\/IF\}/g,
    (_, movieBlock: string, tvBlock: string) => (tmdb.type === 'movie' ? movieBlock : tvBlock),
  );
}

export function renderSourceConditionals(template: string, media: MediaInfoData | null, platform: string): string {
  const shouldShow = Boolean(media?.source?.toUpperCase().includes('WEB') && platform && platform !== 'N/A');
  return template.replace(/\{SI WEB\}([\s\S]*?)\{END SI\}/g, (_, block: string) => (shouldShow ? block : ''));
}

function stripForcedMarker(title: string): string {
  return title.replace(/\s*\(\s*forced\s*\)\s*/gi, '').trim();
}

export function removeSubtitleSection(template: string): string {
  return template.replace(
    /\n*\[b\]\[img\]https:\/\/i\.ibb\.co\/b54zr3nG\/undefined-Imgur-5\.png\[\/img\]\[\/b\]\n\n\[b\]\[\/b\]\n\[table\]\n[\s\S]*?\n\[\/table\]\n*/m,
    '\n',
  );
}

/**
 * When audio streams have no language metadata, generate virtual rows
 * based on the detected language tag (e.g., MULTI.VF2 → VFF + VFQ + VO).
 */
function expandAudioByLangTag(
  streams: AudioStreamInfo[],
  langTag?: string,
): AudioStreamInfo[] {
  const hasLang = streams.some((s) => s.language && s.language !== 'und');
  if (hasLang || !langTag) return streams;

  const base = streams[0] ?? { codec: 'N/A', channels: 'N/A', bitrate: 'N/A', language: 'und', title: '' };
  const make = (lang: string, title: string): AudioStreamInfo => ({ ...base, language: lang, title });

  switch (langTag) {
    case 'MULTI.VF2':
      return [make('fre', 'VFF'), make('fre', 'VFQ'), make('eng', 'VO')];
    case 'MULTI.VFF':
      return [make('fre', 'VFF'), make('eng', 'VO')];
    case 'MULTI.VFQ':
      return [make('fre', 'VFQ'), make('eng', 'VO')];
    case 'MULTI.VFI':
      return [make('fre', 'VFI'), make('eng', 'VO')];
    case 'VFF':
      return [make('fre', 'VFF')];
    case 'VFQ':
      return [make('fre', 'VFQ')];
    case 'VFI':
      return [make('fre', 'VFI')];
    case 'EN':
      return [make('eng', 'VO')];
    default:
      return streams;
  }
}

export function buildAudioRows(template: string, media: MediaInfoData | null, langTag?: string): string {
  const audioRowPattern = /(^\[tr\].*\{LANGUAGE_FLAG\}.*\{LANGUAGE_BITRATE\}.*\[\/tr\]$)/m;
  const match = template.match(audioRowPattern);
  if (!match) return template;

  const rowTemplate = match[1];
  const rawStreams = media?.audioStreams ?? [];
  const audioStreams = expandAudioByLangTag(rawStreams, langTag);
  const rows = (audioStreams.length > 0 ? audioStreams : [{ language: 'und', title: '', channels: 'N/A', codec: 'N/A', bitrate: 'N/A' }])
    .map((audio, index) => replacePlaceholders(rowTemplate, {
      LANGUAGE_INDEX: String(index + 1),
      LANGUAGE_FLAG: getFlagCode(audio.language, audio.title),
      LANGUAGE: getShortLangLabel(audio.language, audio.title),
      LANGUAGE_CHANNELS: audio.channels === 'N/A' ? 'N/A' : formatChannels(audio.channels),
      LANGUAGE_CODEC: audio.codec || 'N/A',
      LANGUAGE_BITRATE: audio.bitrate ? normalizeBitrate(audio.bitrate) : 'N/A',
    }));
  return template.replace(rowTemplate, rows.join('\n'));
}

function buildSubtitleLanguage(subtitle: SubtitleStreamInfo): string {
  const cleanedTitle = stripForcedMarker(subtitle.title);
  const t = cleanedTitle.toLowerCase();
  // Detect French variants from title
  if (/canad|québ|quebec|vfq/.test(t)) return 'VFQ';
  if (/vff|france|european/.test(t)) return 'VFF';
  if (/vfi|international/.test(t)) return 'VFI';
  const langOnly = cleanedTitle.replace(/\s*(Full|Forced|SDH)\s*[:/]?\s*(SRT|ASS|SSA|PGS|VobSub|SUP|WebVTT)?\s*$/i, '').trim();
  return getFullLangName(subtitle.language, langOnly);
}

/** Normalize BCP-47 tags like "en-US" or "fr-CA" to their base language code. */
function normalizeLangCode(code: string): string {
  return code.toLowerCase().split('-')[0];
}

/** Only French and English subtitles are allowed in C411 presentations. */
function filterAllowedSubtitles(subtitles: SubtitleStreamInfo[]): SubtitleStreamInfo[] {
  return subtitles.filter((s) => {
    const lang = normalizeLangCode(s.language);
    const title = (s.title || '').toLowerCase();
    // French variants
    if (/^(fre|fra|fr)$/.test(lang)) return true;
    if (/vff|vfq|french|francais|canada|québ|quebec/.test(title)) return true;
    // English
    if (/^(eng|en)$/.test(lang)) return true;
    if (/english|vo\b/.test(title)) return true;
    return false;
  });
}

export function buildSubtitleRows(template: string, media: MediaInfoData | null): string {
  const allSubtitles = media?.subtitles ?? [];
  const subtitles = filterAllowedSubtitles(allSubtitles);
  if (subtitles.length === 0) return removeSubtitleSection(template);

  const subtitleRowPattern = /(^\[tr\].*\{LANGUAGE_FORMAT\}.*\{LANGUAGE_TYPE\}.*\[\/tr\]$)/m;
  const match = template.match(subtitleRowPattern);
  if (!match) return template;

  const rowTemplate = match[1];
  const rows = subtitles.map((subtitle, index) => {
    const cleanedTitle = stripForcedMarker(subtitle.title);
    const languageLabel = buildSubtitleLanguage(subtitle);
    return replacePlaceholders(rowTemplate, {
      LANGUAGE_INDEX: String(index + 1),
      LANGUAGE_FLAG: getFlagCode(subtitle.language, cleanedTitle || subtitle.language),
      LANGUAGE: languageLabel,
      LANGUAGE_FORMAT: subtitle.format || 'N/A',
      LANGUAGE_TYPE: subtitle.forced ? 'Force' : 'Complet',
    });
  });
  return template.replace(rowTemplate, rows.join('\n'));
}

export function buildReleaseInfo(
  tmdb: TmdbDetails,
  media: MediaInfoData | null,
  releaseName: string,
  languages?: string,
): C411ReleaseInfo {
  return {
    title: tmdb.title || releaseName,
    year: tmdb.year || undefined,
    languages,
    resolution: media?.resolution ?? undefined,
    source: media?.source ?? undefined,
    hdr: extractHdrFromName(releaseName) ?? undefined,
    audioCodec: media?.audioStreams?.[0]?.codec ?? undefined,
    audioChannels: media?.audioStreams?.[0]?.channels && media.audioStreams[0].channels !== 'N/A'
      ? formatChannels(media.audioStreams[0].channels) : undefined,
    videoCodec: media?.videoCodec ?? undefined,
  };
}

// ─── Main generator ──────────────────────────────────────

export interface PrezContext {
  tmdb: TmdbDetails;
  media: MediaInfoData | null;
  releaseName: string;
  fileCount: number;
  totalSize: string;
  languages?: string;
  teamOverride?: string;
}

export function generateBBCode(ctx: PrezContext): string {
  const template = BBCODE_TEMPLATE;
  const { tmdb, media, releaseName } = ctx;
  const season = parseSeason(releaseName);
  const seasonValue = season?.replace(/^Saison\s+/i, '') ?? 'N/A';
  const originalPlatform = tmdb.network || 'N/A';

  const renderedTemplate = buildSubtitleRows(
    buildAudioRows(
      renderSourceConditionals(renderConditionals(template, tmdb), media, originalPlatform),
      media,
      ctx.languages,
    ),
    media,
  );

  const info = buildReleaseInfo(tmdb, media, releaseName, ctx.languages);
  const team = ctx.teamOverride || parseTeam(releaseName);

  return replacePlaceholders(renderedTemplate, {
    TMDB_TITLE: tmdb.title || 'N/A',
    TMDB_RELEASE_YEAR: tmdb.year || 'N/A',
    TMDB_SEASON_NUMBER: seasonValue,
    TMDB_POSTER_URL: tmdb.posterUrl || '',
    TMDB_ORIGIN_COUNTRY: tmdb.productionCountries.join(', ') || 'N/A',
    TMDB_GENRES: tmdb.genres.join(', ') || 'N/A',
    TMDB_RELEASE_DATE: formatFrenchDate(tmdb.releaseDate),
    TMDB_LENGTH: tmdb.runtime || 'N/A',
    TMDB_DIRECTOR: tmdb.director || 'N/A',
    TMDB_MAIN_CAST: tmdb.cast.join(', ') || 'N/A',
    TMDB_NOTE: tmdb.rating || 'N/A',
    TMDB_ID: tmdb.imdbId || 'N/A',
    TMDB_DESCRIPTION: tmdb.overview || 'Aucun synopsis disponible.',
    SOURCE_TYPE: media?.source ?? 'N/A',
    TMDB_ORIGINAL_PLATFORM: originalPlatform,
    CONTAINER: media?.container ?? 'N/A',
    RESOLUTION: media?.resolution ?? 'N/A',
    CODEC: media?.videoCodec ?? 'N/A',
    BITRATE: normalizeBitrate(media?.videoBitrate ?? 'N/A'),
    AUDIO_CODEC: media?.audioStreams?.[0]?.codec ?? 'N/A',
    AUDIO_BITRATE: media?.audioStreams?.[0]?.bitrate ? normalizeBitrate(media.audioStreams[0].bitrate) : 'N/A',
    AUDIO_CHANNELS: media?.audioStreams?.[0]?.channels ? formatChannels(media.audioStreams[0].channels) : 'N/A',
    RELEASE_NAME: buildC411ReleaseName(info, releaseName, ctx.teamOverride),
    RELEASE_TEAM: team === 'N/A' ? 'NOTAG' : team,
    NBR_FICHIERS: ctx.fileCount > 0 ? String(ctx.fileCount) : 'N/A',
    POIDS_TOTAL: ctx.totalSize,
  });
}
