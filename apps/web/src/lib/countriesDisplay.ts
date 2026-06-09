import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import fr from "i18n-iso-countries/langs/fr.json";

let registered = false;

function ensureIsoCountriesRegistered(): void {
  if (registered) return;
  countries.registerLocale(en);
  countries.registerLocale(fr);
  registered = true;
}

/** All ISO 3166-1 alpha-2 country options, localized and sorted by label. */
export function getCountryOptions(
  i18nLanguage: string,
): { code: string; label: string }[] {
  ensureIsoCountriesRegistered();
  const lang = i18nLanguage.split("-")[0]?.toLowerCase() || "en";
  const names = countries.getNames(lang, { select: "official" });
  return Object.entries(names)
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
