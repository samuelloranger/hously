import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";
import { useState } from "react";
import { useDashboardWeather } from "@/pages/_component/useWeather";
import { WeatherForecastModal } from "@/pages/_component/WeatherForecastModal";
import type { WeatherData } from "@hously/shared/types";
import { getWeatherConditionKey } from "@/lib/utils/weather";
import { usePrefetchIntent } from "@/lib/routing/usePrefetchIntent";

const toCelsius = (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
      {children}
    </span>
  );
}

function WeatherIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      className="size-9 shrink-0 text-sky-600 dark:text-sky-400"
      strokeWidth={1.75}
      aria-hidden
    />
  );
}

function weatherStatusIcon(weather: WeatherData): LucideIcon {
  const key = getWeatherConditionKey(weather.weather_code);
  const day = weather.is_day;

  switch (key) {
    case "clearSky":
      return day ? Sun : Moon;
    case "partlyCloudy":
      return day ? CloudSun : CloudMoon;
    case "overcast":
      return Cloud;
    case "foggy":
      return CloudFog;
    case "drizzle":
    case "freezingDrizzle":
      return CloudDrizzle;
    case "rain":
    case "freezingRain":
      return CloudRain;
    case "snow":
      return CloudSnow;
    case "thunderstorm":
      return CloudLightning;
    default:
      return day ? CloudSun : CloudMoon;
  }
}

export function WeatherPanel() {
  const { t } = useTranslation("common");
  const weatherQuery = useDashboardWeather();
  const prefetchIntent = usePrefetchIntent("/settings", { tab: "integrations" });
  const [forecastOpen, setForecastOpen] = useState(false);

  if (!weatherQuery.data || weatherQuery.isError) return null;

  const statusIcon = weatherStatusIcon(weatherQuery.data);

  const unit = weatherQuery.data.temperature_unit || "fahrenheit";
  const temperatureValue =
    unit === "celsius"
      ? toCelsius(weatherQuery.data.temperature_f)
      : weatherQuery.data.temperature_f;
  const feelsLikeValue =
    unit === "celsius"
      ? toCelsius(weatherQuery.data.feels_like_f)
      : weatherQuery.data.feels_like_f;
  const unitLabel = unit === "celsius" ? "C" : "F";
  const conditionLabel = t(
    `dashboard.weather.conditions.${getWeatherConditionKey(weatherQuery.data.weather_code)}`,
    {
      defaultValue: weatherQuery.data.condition_label,
    },
  );

  return (
    <>
      {forecastOpen && (
        <WeatherForecastModal
          isOpen={forecastOpen}
          onClose={() => setForecastOpen(false)}
          current={weatherQuery.data}
        />
      )}
      <section
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden cursor-pointer"
        onClick={() => setForecastOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setForecastOpen(true)}
        {...prefetchIntent}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-1 h-4 rounded-full bg-sky-500 shrink-0" />
            <CloudSun
              className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
              strokeWidth={2}
            />
            <SectionTitle>{t("dashboard.weather.kicker")}</SectionTitle>
          </div>
          {weatherQuery.isFetching ? (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("dashboard.weather.updating")}
            </span>
          ) : null}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <WeatherIcon icon={statusIcon} />
            <div className="min-w-0 flex-1">
              <Kicker>{weatherQuery.data.location_name}</Kicker>
              <p className="mt-2 text-xl font-bold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                {t("dashboard.weather.temperature", {
                  temp: Math.round(temperatureValue),
                  unit: unitLabel,
                })}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t("dashboard.weather.feelsLikeLine", {
                  condition: conditionLabel,
                  feelsLike: Math.round(feelsLikeValue),
                  unit: unitLabel,
                })}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
