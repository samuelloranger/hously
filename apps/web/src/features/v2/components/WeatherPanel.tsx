import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import { type WeatherData, useDashboardWeather, getWeatherVisualTheme, getWeatherConditionKey } from '@hously/shared';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

const toCelsius = (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9);

function weatherStatusIcon(weather: WeatherData): LucideIcon {
  const key = getWeatherConditionKey(weather.weather_code);
  const day = weather.is_day;

  switch (key) {
    case 'clearSky':
      return day ? Sun : Moon;
    case 'partlyCloudy':
      return day ? CloudSun : CloudMoon;
    case 'overcast':
      return Cloud;
    case 'foggy':
      return CloudFog;
    case 'drizzle':
    case 'freezingDrizzle':
      return CloudDrizzle;
    case 'rain':
    case 'freezingRain':
      return CloudRain;
    case 'snow':
      return CloudSnow;
    case 'thunderstorm':
      return CloudLightning;
    default:
      return day ? CloudSun : CloudMoon;
  }
}

export function WeatherPanel() {
  const { t } = useTranslation('common');
  const weatherQuery = useDashboardWeather();
  const prefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });

  const weatherTheme = useMemo(() => {
    if (!weatherQuery.data) {
      return {
        startColor: '#94A3B8',
        endColor: '#64748B',
        textColor: '#F8FAFC',
        subtextColor: '#E2E8F0',
      };
    }
    const full = getWeatherVisualTheme(weatherQuery.data);
    return {
      startColor: full.startColor,
      endColor: full.endColor,
      textColor: full.textColor,
      subtextColor: full.subtextColor,
    };
  }, [weatherQuery.data]);

  if (!weatherQuery.data || weatherQuery.isError) return null;

  const unit = weatherQuery.data.temperature_unit || 'fahrenheit';
  const temperatureValue =
    unit === 'celsius' ? toCelsius(weatherQuery.data.temperature_f) : weatherQuery.data.temperature_f;
  const feelsLikeValue =
    unit === 'celsius' ? toCelsius(weatherQuery.data.feels_like_f) : weatherQuery.data.feels_like_f;
  const unitLabel = unit === 'celsius' ? 'C' : 'F';
  const conditionLabel = t(`dashboard.weather.conditions.${getWeatherConditionKey(weatherQuery.data.weather_code)}`, {
    defaultValue: weatherQuery.data.condition_label,
  });

  const StatusIcon = weatherStatusIcon(weatherQuery.data);

  return (
    <div
      className="rounded-xl border border-white/20 shadow-md p-4"
      style={{ background: `linear-gradient(135deg, ${weatherTheme.startColor}, ${weatherTheme.endColor})` }}
      {...prefetchIntent}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusIcon
            className="size-9 shrink-0"
            style={{ color: weatherTheme.textColor }}
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: weatherTheme.subtextColor }}
            >
              {t('dashboard.weather.kicker')}
            </p>
            <h3 className="truncate text-sm font-bold" style={{ color: weatherTheme.textColor }}>
              {weatherQuery.data.location_name}
            </h3>
          </div>
        </div>
        {weatherQuery.isFetching ? (
          <span className="shrink-0 text-xs" style={{ color: weatherTheme.subtextColor }}>
            {t('dashboard.weather.updating')}
          </span>
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
