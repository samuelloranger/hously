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

export function getFlagCode(langCode: string, title: string): string {
  const t = (title || langCode).toLowerCase();
  if (t.includes('vfq') || t.includes('vqc') || t.includes('quebec') || t.includes('canadien') || t.includes('canadian') || t.includes('canada')) return 'ca';
  if (t.includes('vff') || t.includes('france') || t.includes('truefrench') || t.includes('european')) return 'fr';
  if (t.includes('french') || t.includes('vfi') || langCode === 'fre' || langCode === 'fra' || langCode === 'fr') return 'fr';
  if (t.includes('vo') || t.includes('english') || langCode === 'eng' || langCode === 'en') return 'gb';
  return FLAG_CODE_MAP[langCode.toLowerCase()] ?? 'un';
}

export function getShortLangLabel(langCode: string, title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('vfq') || t.includes('vqc') || t.includes('canadian') || t.includes('canada') || t.includes('quebec') || t.includes('québ')) return 'VFQ';
  if (t.includes('vff') || t.includes('european') || t.includes('france')) return 'VFF';
  if (t.includes('vfi')) return 'VFI';
  if (t.includes('truefrench')) return 'TRUEFRENCH';
  if (t.includes('french') || t === 'francais') return 'French';
  if (t.includes('vo') || t === 'english') return 'VO';
  if (title) return title;
  return SHORT_LABEL_MAP[langCode.toLowerCase()] ?? langCode;
}

export function getFullLangName(langCode: string, title: string): string {
  const t = (title || langCode).toLowerCase();
  return FULL_LANG_NAME_MAP[langCode.toLowerCase()] ?? FULL_LANG_NAME_MAP[t] ?? (title || langCode);
}
