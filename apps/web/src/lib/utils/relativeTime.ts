import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, fr } from "date-fns/locale";

export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  options: { addSuffix?: boolean; locale: Locale },
): string | null {
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return formatDistanceToNow(date, {
      addSuffix: options?.addSuffix ?? true,
      locale: options?.locale,
    });
  } catch {
    return null;
  }
}

export function resolveDateFnsLocale(
  languageTag: string | null | undefined,
): Locale {
  const base = (languageTag ?? "").split("-")[0]?.toLowerCase();
  if (base === "fr") return fr;
  return enUS;
}
