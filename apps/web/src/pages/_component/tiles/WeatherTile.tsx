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
import type { WeatherData } from "@hously/shared/types";
import { useDashboardWeather } from "@/pages/_component/useWeather";
import { getWeatherConditionKey } from "@/lib/utils/weather";
import { TileCard } from "@/pages/_component/tiles/TileCard";

const toCelsius = (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9);

function WeatherIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon size={22} strokeWidth={1.75} className="shrink-0 text-sky-400" />
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

export function WeatherTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardWeather();

  if (!data) {
    return (
      <TileCard label={t("dashboard.tiles.weatherLabel")}>
        <span className="text-sm text-neutral-400">—</span>
      </TileCard>
    );
  }

  const statusIcon = weatherStatusIcon(data);
  const unit = data.temperature_unit || "fahrenheit";
  const temp =
    unit === "celsius" ? toCelsius(data.temperature_f) : data.temperature_f;
  const unitLabel = unit === "celsius" ? "C" : "F";
  const condition = t(
    `dashboard.weather.conditions.${getWeatherConditionKey(data.weather_code)}`,
    { defaultValue: data.condition_label },
  );

  return (
    <TileCard label={t("dashboard.tiles.weatherLabel")}>
      <div className="flex items-center gap-2.5">
        <WeatherIcon icon={statusIcon} />
        <div className="min-w-0 flex-1">
          <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
            {t("dashboard.weather.temperature", {
              temp: Math.round(temp),
              unit: unitLabel,
            })}
          </span>
          <p className="truncate text-xs text-neutral-400">{condition}</p>
        </div>
      </div>
    </TileCard>
  );
}
