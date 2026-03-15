/**
 * Language mappings for display (flags, labels, names).
 * Used by BBCode generation.
 */

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

export function getFlagCode(langCode: string, title: string): string {
  const t = (title || langCode).toLowerCase();
  const lc = normalizeLangCode(langCode);
  if (t.includes('vfq') || t.includes('vqc') || t.includes('quebec') || t.includes('canadien') || t.includes('canadian') || t.includes('canada')) return 'ca';
  if (t.includes('vff') || t.includes('france') || t.includes('truefrench') || t.includes('european')) return 'fr';
  if (t.includes('french') || t.includes('vfi') || lc === 'fre' || lc === 'fra' || lc === 'fr') return 'fr';
  if (t.includes('vo') || t.includes('english') || lc === 'eng' || lc === 'en') return 'gb';
  return FLAG_CODE_MAP[lc] ?? 'un';
}

export function getShortLangLabel(langCode: string, title: string): string {
  const t = (title || '').toLowerCase();
  const lc = normalizeLangCode(langCode);
  if (t.includes('vfq') || t.includes('vqc') || t.includes('canadian') || t.includes('canada') || t.includes('quebec') || t.includes('québ')) return 'VFQ';
  if (t.includes('vff') || t.includes('european') || t.includes('france')) return 'VFF';
  if (t.includes('vfi')) return 'VFI';
  if (t.includes('truefrench')) return 'TRUEFRENCH';
  if (t.includes('french') || t === 'francais') return 'French';
  if (t.includes('vo') || t === 'english' || /\beng\b/.test(t)) return 'VO';
  // Check langCode before falling back to raw title (which may contain codec info)
  const fromLangCode = SHORT_LABEL_MAP[lc];
  if (fromLangCode) return fromLangCode;
  if (title && !/\d/.test(title)) return title; // Only use title if it's not technical info
  return langCode;
}

export function getFullLangName(langCode: string, title: string): string {
  const lc = normalizeLangCode(langCode);
  const t = (title || langCode).toLowerCase();
  return FULL_LANG_NAME_MAP[lc] ?? FULL_LANG_NAME_MAP[t] ?? (title || langCode);
}
