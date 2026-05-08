import { useEffect, useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
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
import { HouseLoader } from "@/components/HouseLoader";
import {
  useAppSettings,
  useUpdateAppSettings,
} from "@/pages/settings/useAppSettings";
import { useCalendarAvailableCountries } from "@/hooks/calendar/useCalendarAvailableCountries";
import { useHolidaySubdivisions } from "@/hooks/calendar/useHolidaySubdivisions";
import { localizedCountryName } from "@/lib/countriesDisplay";
import { SettingsPageHeader } from "@/pages/settings/_component/SettingsPageHeader";

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
      <p className="text-sm text-red-600 dark:text-red-400">
        {t("settings.general.loadError")}
      </p>
    );
  }

  const save = async () => {
    try {
      await updateMut.mutateAsync({
        country_code: countryCode,
        calendar_subdivision_code: calendarSubdivisionCode || null,
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

      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
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
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
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

          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t("settings.general.countryCodeHint")}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => void save()}
          disabled={updateMut.isPending}
        >
          {updateMut.isPending
            ? t("settings.general.saving")
            : t("settings.general.save")}
        </Button>
      </section>
    </div>
  );
}
