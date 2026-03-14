/**
 * Static resolution of C411 options (category, language, genre).
 * No API calls — purely local mappings.
 */

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
  'action': 39, 'animalier': 40, 'animation': 41, 'aventure': 44,
  'biopic': 46, 'comédie dramatique': 50, 'comédie': 49, 'crime': 81,
  'documentaire': 56, 'drame': 57, 'famille': 61, 'familial': 61,
  'fantastique': 62, 'fantasy': 62, 'guerre': 66, 'histoire': 67,
  'historique': 67, 'horreur': 59, 'épouvante': 59, 'musical': 73,
  'musique': 73, 'mystère': 92, 'policier': 81, 'romance': 84,
  'science-fiction': 86, 'science fiction': 86, 'thriller': 92,
  'western': 95, 'sport': 89,
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
