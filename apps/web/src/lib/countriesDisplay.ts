import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import fr from "i18n-iso-countries/langs/fr.json";

let registered = false;

export function ensureIsoCountriesRegistered(): void {
  if (registered) return;
  countries.registerLocale(en);
  countries.registerLocale(fr);
  registered = true;
}

/** Uses ISO 3166-1 names in the active UI language (en/fr registered); falls back to API default_name. */
export function localizedCountryName(
  code: string,
  i18nLanguage: string,
  defaultName: string,
): string {
  ensureIsoCountriesRegistered();
  const lang = i18nLanguage.split("-")[0]?.toLowerCase() || "en";
  return countries.getName(code, lang, { select: "official" }) || defaultName;
}
