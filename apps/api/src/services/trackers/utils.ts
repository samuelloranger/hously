export const parseNumber = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, ' ').trim().replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};
