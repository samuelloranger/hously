import { useEffect, useMemo, useState } from "react";
import { Globe2, Tv2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { HouseLoader } from "@/components/HouseLoader";
import {
  useAppSettings,
  useUpdateAppSettings,
} from "@/pages/settings/useAppSettings";
import { useCalendarAvailableCountries } from "@/hooks/calendar/useCalendarAvailableCountries";
import { useHolidaySubdivisions } from "@/hooks/calendar/useHolidaySubdivisions";
import { localizedCountryName } from "@/lib/countriesDisplay";
import { SettingsPageHeader } from "@/pages/settings/_component/SettingsPageHeader";
import { WIDGETS } from "@hously/shared/constants";
import type { WidgetVisibility } from "@hously/shared/constants";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

const WINDOW_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "1 year" },
  { value: 24, label: "2 years" },
];

const DEFAULT_VISIBILITY = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w.defaultVisible]),
) as WidgetVisibility;

export function GeneralSettingsTab() {
  const { t, i18n } = useTranslation("common");
  const { data, isLoading, error } = useAppSettings();
  const { data: countriesPayload } = useCalendarAvailableCountries();
  const updateMut = useUpdateAppSettings();
  const [countryCode, setCountryCode] = useState(
    data?.settings.country_code ?? "US",
  );
  const [calendarSubdivisionCode, setCalendarSubdivisionCode] = useState(
    data?.settings.calendar_subdivision_code ?? "",
  );
  const [upcomingWindowMonths, setUpcomingWindowMonths] = useState(
    data?.settings.upcoming_window_months ?? 12,
  );
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    new Set((data?.settings.upcoming_languages ?? "en,fr").split(",")),
  );
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibility>(
    data?.settings.dashboard_widget_visibility ?? DEFAULT_VISIBILITY,
  );

  const { data: subdivisionsPayload, isLoading: subdivisionsLoading } =
    useHolidaySubdivisions(
      countryCode && countryCode.length === 2 ? countryCode : undefined,
    );

  const sortedCountryOptions = useMemo(() => {
    const list = countriesPayload?.countries ?? [];
    return [...list]
      .map((c) => ({
        code: c.country_code,
        label: localizedCountryName(
          c.country_code,
          i18n.language,
          c.default_name,
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [countriesPayload?.countries, i18n.language]);

  const countryLabel =
    sortedCountryOptions.find((option) => option.code === countryCode)?.label ??
    countryCode;
  const subdivisionLabel =
    (subdivisionsPayload?.subdivisions ?? []).find(
      (subdivision) => subdivision.subdivision_code === calendarSubdivisionCode,
    )?.default_name ?? t("settings.general.subdivisionPlaceholder");

  useEffect(() => {
    if (!data?.settings) return;
    setCountryCode(data.settings.country_code);
    setCalendarSubdivisionCode(data.settings.calendar_subdivision_code ?? "");
    setUpcomingWindowMonths(data.settings.upcoming_window_months);
    setSelectedLanguages(
      new Set((data.settings.upcoming_languages ?? "en,fr").split(",")),
    );
    setWidgetVisibility(
      data.settings.dashboard_widget_visibility ?? DEFAULT_VISIBILITY,
    );
  }, [data?.settings]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-500">
        <HouseLoader size="md" />
        <span className="text-sm">{t("settings.general.loading")}</span>
      </div>
    );
  }

  if (error || !data?.settings) {
    return (
      <p className="text-sm text-red-400">
        {t("settings.general.loadError")}
      </p>
    );
  }

  const toggleLanguage = (code: string) => {
    const newLangs = new Set(selectedLanguages);
    if (newLangs.has(code)) {
      newLangs.delete(code);
    } else {
      newLangs.add(code);
    }
    setSelectedLanguages(newLangs);
  };

  const toggleWidget = (key: keyof WidgetVisibility) => {
    setWidgetVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const save = async () => {
    try {
      if (selectedLanguages.size === 0) {
        toast.error(t("settings.general.languageRequired"));
        return;
      }

      await updateMut.mutateAsync({
        country_code: countryCode,
        calendar_subdivision_code: calendarSubdivisionCode || null,
        upcoming_window_months: upcomingWindowMonths,
        upcoming_languages: Array.from(selectedLanguages).join(","),
        dashboard_widget_visibility: widgetVisibility,
      });
      toast.success(t("settings.general.saveSuccess"));
    } catch {
      toast.error(t("settings.general.saveError"));
    }
  };

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        icon={Globe2}
        title={t("settings.general.title")}
        description={t("settings.general.description")}
      />

      {/* Location Settings */}
      <section className="space-y-4 rounded-xl border p-6 border-neutral-700 bg-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-100">
          Location & Calendar
        </h3>
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              {t("settings.general.countryCode")}
            </label>
            <Select
              value={countryCode}
              onValueChange={(value) => {
                setCountryCode(value);
                setCalendarSubdivisionCode("");
              }}
            >
              <SelectTrigger>
                <SelectValue>{countryLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {sortedCountryOptions.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              {t("settings.general.subdivisionCode")}
            </label>
            <Select
              value={calendarSubdivisionCode || "__national__"}
              onValueChange={(value) =>
                setCalendarSubdivisionCode(
                  value === "__national__" ? "" : value,
                )
              }
              disabled={
                !countryCode ||
                subdivisionsLoading ||
                (subdivisionsPayload?.subdivisions.length ?? 0) === 0
              }
            >
              <SelectTrigger>
                <SelectValue>{subdivisionLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value="__national__">
                  {t("settings.general.subdivisionPlaceholder")}
                </SelectItem>
                {(subdivisionsPayload?.subdivisions ?? []).map((s) => (
                  <SelectItem
                    key={s.subdivision_code}
                    value={s.subdivision_code}
                  >
                    {s.default_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mt-1 text-xs text-neutral-400">
            {t("settings.general.countryCodeHint")}
          </p>
        </div>
      </section>

      {/* Upcoming Media Settings */}
      <section className="space-y-4 rounded-xl border p-6 border-neutral-700 bg-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-100">
          Upcoming Releases
        </h3>
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Look-ahead window
            </label>
            <Select
              value={String(upcomingWindowMonths)}
              onValueChange={(value) =>
                setUpcomingWindowMonths(parseInt(value, 10))
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {
                    WINDOW_OPTIONS.find((w) => w.value === upcomingWindowMonths)
                      ?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((w) => (
                  <SelectItem key={w.value} value={String(w.value)}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-neutral-400">
              How far ahead to show upcoming movies and TV releases
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Languages to include
            </label>
            <div className="space-y-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <label
                  key={lang.code}
                  className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700/50 p-2 rounded-md"
                >
                  <Checkbox
                    checked={selectedLanguages.has(lang.code)}
                    onChange={() => toggleLanguage(lang.code)}
                  />
                  <span className="text-sm text-neutral-300">
                    {lang.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Select which languages to include in release searches
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard Widgets */}
      <section className="space-y-4 rounded-xl border p-6 border-neutral-700 bg-neutral-800">
        <div className="flex items-center gap-2">
          <Tv2 className="w-4 h-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-100">
            Dashboard Widgets
          </h3>
        </div>
        <div className="space-y-2">
          {WIDGETS.map((w) => (
            <label
              key={w.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700/50 p-2 rounded-md"
            >
              <Checkbox
                checked={widgetVisibility[w.id] ?? w.defaultVisible}
                onChange={() => toggleWidget(w.id)}
              />
              <span className="text-sm text-neutral-300">
                {t(`widgets.${w.id}`)}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          Show or hide dashboard panels
        </p>
      </section>

      <Button
        type="button"
        onClick={() => void save()}
        disabled={updateMut.isPending}
      >
        {updateMut.isPending
          ? t("settings.general.saving")
          : t("settings.general.save")}
      </Button>
    </div>
  );
}
