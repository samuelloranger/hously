import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardWeather, getWeatherVisualTheme, getWeatherConditionKey } from '@hously/shared';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

const toCelsius = (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9);

export function WeatherWidget() {
  const { t } = useTranslation('common');
  const weatherQuery = useDashboardWeather();
  const prefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });
  const weatherTheme = useMemo(() => {
    if (!weatherQuery.data) {
      return {
        icon: '🌤️',
        startColor: '#94A3B8',
        endColor: '#64748B',
        textColor: '#F8FAFC',
        subtextColor: '#E2E8F0',
      };
    }

    return getWeatherVisualTheme(weatherQuery.data);
  }, [weatherQuery.data]);
  if (!weatherQuery.data || weatherQuery.isError) return null;

  const unit = weatherQuery.data.temperature_unit || 'fahrenheit';
  const temperatureValue =
    unit === 'celsius' ? toCelsius(weatherQuery.data.temperature_f) : weatherQuery.data.temperature_f;
  const feelsLikeValue = unit === 'celsius' ? toCelsius(weatherQuery.data.feels_like_f) : weatherQuery.data.feels_like_f;
  const unitLabel = unit === 'celsius' ? 'C' : 'F';
  const conditionLabel = t(`dashboard.weather.conditions.${getWeatherConditionKey(weatherQuery.data.weather_code)}`, {
    defaultValue: weatherQuery.data.condition_label,
  });

  return (
    <div
      className="rounded-xl shadow p-4"
      style={{ background: `linear-gradient(135deg, ${weatherTheme.startColor}, ${weatherTheme.endColor})` }}
      {...prefetchIntent}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: weatherTheme.subtextColor }}>
            {t('dashboard.weather.kicker')}
          </p>
          <h3 className="text-sm font-bold" style={{ color: weatherTheme.textColor }}>
            {weatherTheme.icon} {weatherQuery.data.location_name}
          </h3>
        </div>
        {weatherQuery.isFetching ? (
          <span style={{ color: weatherTheme.subtextColor }}>{t('dashboard.weather.updating')}</span>
        ) : null}
      </div>

      <div className="mb-1">
        <p className="text-xl font-bold leading-none" style={{ color: weatherTheme.textColor }}>
          {t('dashboard.weather.temperature', { temp: Math.round(temperatureValue), unit: unitLabel })}
        </p>
        <p className="mt-1 text-xs" style={{ color: weatherTheme.subtextColor }}>
          {t('dashboard.weather.feelsLikeLine', {
            condition: conditionLabel,
            feelsLike: Math.round(feelsLikeValue),
            unit: unitLabel,
          })}
        </p>
      </div>
    </div>
  );
}
