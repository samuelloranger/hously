import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useWeatherIntegration,
  useUpdateWeatherIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";

type TemperatureUnit = "fahrenheit" | "celsius";

export function WeatherIntegrationSection() {
  const { data, isLoading } = useWeatherIntegration();
  return (
    <WeatherIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function WeatherIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useWeatherIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateWeatherIntegration();

  const [address, setAddress] = useState(data?.integration?.address || "");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(
    (data?.integration?.temperature_unit as TemperatureUnit) || "fahrenheit",
  );
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      address !== (data.integration.address || "") ||
      temperatureUnit !== (data.integration.temperature_unit || "fahrenheit") ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, address, temperatureUnit, enabled]);

  const handleCancel = () => {
    setAddress(data?.integration.address || "");
    setTemperatureUnit(data?.integration.temperature_unit || "fahrenheit");
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ address, temperature_unit: temperatureUnit, enabled })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title={t("settings.integrations.weather.title")}
      description={t("settings.integrations.weather.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="/icons/open-meteo.png"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.weather.address")}
          </label>
          <input
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={t("settings.integrations.weather.addressPlaceholder")}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.weather.temperatureUnit")}
          </label>
          <select
            value={temperatureUnit}
            onChange={(event) =>
              setTemperatureUnit(event.target.value as TemperatureUnit)
            }
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          >
            <option value="fahrenheit">
              {t("settings.integrations.weather.fahrenheit")}
            </option>
            <option value="celsius">
              {t("settings.integrations.weather.celsius")}
            </option>
          </select>
        </div>
      </div>
    </IntegrationSectionCard>
  );
}
