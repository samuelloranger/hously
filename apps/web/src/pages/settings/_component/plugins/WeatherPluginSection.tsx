import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWeatherPlugin, useUpdateWeatherPlugin } from "@/hooks/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";

type TemperatureUnit = "fahrenheit" | "celsius";

export function WeatherPluginSection() {
  const { data, isLoading } = useWeatherPlugin();
  return (
    <WeatherPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function WeatherPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useWeatherPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateWeatherPlugin();

  const [address, setAddress] = useState(data?.plugin?.address || "");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(
    (data?.plugin?.temperature_unit as TemperatureUnit) || "fahrenheit",
  );
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      address !== (data.plugin.address || "") ||
      temperatureUnit !== (data.plugin.temperature_unit || "fahrenheit") ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, address, temperatureUnit, enabled]);

  const handleCancel = () => {
    setAddress(data?.plugin.address || "");
    setTemperatureUnit(data?.plugin.temperature_unit || "fahrenheit");
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ address, temperature_unit: temperatureUnit, enabled })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="Weather"
      description="Configure the dashboard weather location and preferred temperature unit."
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Enter address for dashboard weather"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Temperature unit
        </label>
        <select
          value={temperatureUnit}
          onChange={(event) =>
            setTemperatureUnit(event.target.value as TemperatureUnit)
          }
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        >
          <option value="fahrenheit">Fahrenheit (deg F)</option>
          <option value="celsius">Celsius (deg C)</option>
        </select>
      </div>
    </PluginSectionCard>
  );
}
