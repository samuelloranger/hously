import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeatherPlugin, useUpdateWeatherPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

type TemperatureUnit = 'fahrenheit' | 'celsius';

export function WeatherPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useWeatherPlugin();
  const saveMutation = useUpdateWeatherPlugin();

  const [address, setAddress] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('fahrenheit');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setAddress(data.plugin.address || '');
    setTemperatureUnit(data.plugin.temperature_unit || 'fahrenheit');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      address !== (data.plugin.address || '') ||
      temperatureUnit !== (data.plugin.temperature_unit || 'fahrenheit') ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, address, temperatureUnit, enabled]);

  const handleCancel = () => {
    setAddress(data?.plugin.address || '');
    setTemperatureUnit(data?.plugin.temperature_unit || 'fahrenheit');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ address, temperature_unit: temperatureUnit, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
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
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Address</label>
        <input
          type="text"
          value={address}
          onChange={event => setAddress(event.target.value)}
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
          onChange={event => setTemperatureUnit(event.target.value as TemperatureUnit)}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        >
          <option value="fahrenheit">Fahrenheit (deg F)</option>
          <option value="celsius">Celsius (deg C)</option>
        </select>
      </div>
    </PluginSectionCard>
  );
}
