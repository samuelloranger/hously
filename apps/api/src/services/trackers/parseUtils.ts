const SIZE_PATTERN =
  /(-?\d+(?:[.,]\d+)?)\s*(KiB|MiB|GiB|TiB|o|b|Ko|Mo|Go|To|KB|MB|GB|TB)\b/i;

/**
 * Parse a human-readable size string into gigabytes.
 *
 * Pass `binary: true` for trackers that use 1024-based units (KiB/MiB/GiB/TiB).
 * Default is 1000-based decimal (Ko/Mo/Go/To and their ASCII equivalents).
 */
export function parseSizeToGo(
  text: string,
  { binary = false }: { binary?: boolean } = {},
): number | null {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(",", ".");

  const match = normalized.match(SIZE_PATTERN);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const K = binary ? 1024 : 1000;

  switch (match[2].toLowerCase()) {
    case "o":
    case "b":
      return value / K / K / K;
    case "kib":
    case "ko":
    case "kb":
      return value / K / K;
    case "mib":
    case "mo":
    case "mb":
      return value / K;
    case "gib":
    case "go":
    case "gb":
      return value;
    case "tib":
    case "to":
    case "tb":
      return value * K;
    default:
      return null;
  }
}

/**
 * Parse a ratio string, returning null for infinity representations.
 */
export function parseRatio(text: string): number | null {
  const t = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(",", ".");

  if (t === "∞" || t.toLowerCase() === "inf") return null;

  const match = t.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}
