import type { ArrProfile } from "@hously/shared/types";
export const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const toProfiles = (value: unknown): ArrProfile[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return null;
      const raw = entry as Record<string, unknown>;
      const id =
        typeof raw.id === "number"
          ? Math.trunc(raw.id)
          : typeof raw.id === "string"
            ? parseInt(raw.id, 10)
            : Number.NaN;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!Number.isFinite(id) || id <= 0 || !name) return null;
      return { id, name };
    })
    .filter((entry): entry is ArrProfile => Boolean(entry));
};

export const clampInteger = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const parsed =
    typeof value === "number"
      ? Math.trunc(value)
      : typeof value === "string"
        ? parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};
