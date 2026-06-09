import { X, Droplets, Wind } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WeatherData, WeatherForecastDay } from "@hously/shared/types";
import { getWeatherConditionKey } from "@/lib/utils/weather";
import { useDashboardWeatherForecast } from "@/pages/_component/useWeather";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toCelsius = (f: number) => Math.round((f - 32) * (5 / 9));
const toDisplay = (f: number, unit: "fahrenheit" | "celsius") =>
  unit === "celsius" ? toCelsius(f) : Math.round(f);

function dayIcon(code: number): LucideIcon {
  const key = getWeatherConditionKey(code);
  switch (key) {
    case "clearSky":
      return Sun;
    case "partlyCloudy":
      return CloudSun;
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
      return CloudSun;
  }
}

function dayLabel(
  dateStr: string,
  locale: string,
): { short: string; isToday: boolean } {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  const short = date.toLocaleDateString(locale, { weekday: "short" });
  return { short, isToday };
}

function tempColorClass(f: number): string {
  if (f <= 32) return "from-blue-400 to-blue-300";
  if (f <= 50) return "from-sky-400 to-cyan-300";
  if (f <= 65) return "from-emerald-400 to-teal-300";
  if (f <= 80) return "from-amber-400 to-yellow-300";
  return "from-orange-500 to-red-400";
}

function DayWeatherIcon({
  icon: Icon,
  isToday,
}: {
  icon: LucideIcon;
  isToday: boolean;
}) {
  return (
    <Icon
      className={cn(
        "size-7 shrink-0",
        isToday ? "text-sky-400" : "text-neutral-500",
      )}
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

function DayColumn({
  day,
  icon,
  isToday,
  unit,
  globalMin,
  globalMax,
  index,
}: {
  day: WeatherForecastDay;
  icon: LucideIcon;
  isToday: boolean;
  unit: "fahrenheit" | "celsius";
  globalMin: number;
  globalMax: number;
  index: number;
}) {
  const maxDisplay = toDisplay(day.temperature_max_f, unit);
  const minDisplay = toDisplay(day.temperature_min_f, unit);

  const range = globalMax - globalMin || 1;
  const barBottom = ((day.temperature_min_f - globalMin) / range) * 100;
  const barHeight =
    ((day.temperature_max_f - day.temperature_min_f) / range) * 100;
  const avgF = (day.temperature_max_f + day.temperature_min_f) / 2;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-2 py-3 rounded-xl transition-colors flex-1 min-w-0",
        isToday
          ? "bg-sky-950/40 ring-1 ring-sky-800"
          : "hover:bg-neutral-800/60",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <DayWeatherIcon icon={icon} isToday={isToday} />

      <div className="relative h-16 w-1.5 rounded-full bg-neutral-700/60 overflow-hidden flex-shrink-0">
        <div
          className={cn(
            "absolute w-full rounded-full bg-gradient-to-t",
            tempColorClass(avgF),
          )}
          style={{
            bottom: `${barBottom}%`,
            height: `${Math.max(barHeight, 8)}%`,
          }}
        />
      </div>

      <span
        className={cn(
          "text-sm font-semibold tabular-nums leading-none",
          isToday ? "text-neutral-50" : "text-neutral-300",
        )}
      >
        {maxDisplay}°
      </span>

      <span className="text-xs tabular-nums leading-none text-neutral-500">
        {minDisplay}°
      </span>

      {day.precipitation_probability_max >= 20 ? (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Droplets className="size-2.5 text-sky-400" strokeWidth={2} />
          <span className="text-[10px] font-medium tabular-nums text-sky-400">
            {day.precipitation_probability_max}%
          </span>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface WeatherForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  current: WeatherData;
}

export function WeatherForecastModal({
  isOpen,
  onClose,
  current,
}: WeatherForecastModalProps) {
  const { t, i18n } = useTranslation("common");
  const forecastQuery = useDashboardWeatherForecast(isOpen);
  const unit = current.temperature_unit;
  const days = forecastQuery.data?.days ?? [];

  const globalMin = days.length
    ? Math.min(...days.map((d) => d.temperature_min_f))
    : 0;
  const globalMax = days.length
    ? Math.max(...days.map((d) => d.temperature_max_f))
    : 100;

  const dominantCode = days[0]?.weather_code ?? current.weather_code;
  const condKey = getWeatherConditionKey(dominantCode);
  const headerGradient =
    condKey === "clearSky" || condKey === "partlyCloudy"
      ? "from-sky-400 via-blue-500 to-primary-600"
      : condKey === "rain" ||
          condKey === "drizzle" ||
          condKey === "freezingRain"
        ? "from-slate-500 via-slate-600 to-slate-800"
        : condKey === "thunderstorm"
          ? "from-neutral-700 via-slate-800 to-neutral-900"
          : condKey === "snow"
            ? "from-sky-200 via-blue-300 to-slate-400"
            : condKey === "foggy"
              ? "from-neutral-400 via-neutral-500 to-neutral-600"
              : "from-sky-500 via-blue-600 to-primary-700";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dashboard.weather.forecast.title")}
      hideTitle
      showCloseButton={false}
      panelClassName="max-w-lg p-0 overflow-hidden"
    >
      <div
        className={cn(
          "relative bg-gradient-to-br px-5 pt-5 pb-6",
          headerGradient,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute top-4 right-4 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="size-4" />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-1">
          {current.location_name}
        </p>
        <p className="text-2xl font-bold text-white leading-none tabular-nums">
          {toDisplay(current.temperature_f, unit)}°
          {unit === "celsius" ? "C" : "F"}
        </p>
        <p className="mt-1 text-sm text-white/75">
          {t(
            `dashboard.weather.conditions.${getWeatherConditionKey(current.weather_code)}`,
            { defaultValue: current.condition_label },
          )}
          {" · "}
          {t("dashboard.weather.feelsLike", {
            temp: toDisplay(current.feels_like_f, unit),
            unit: unit === "celsius" ? "C" : "F",
          })}
        </p>
      </div>

      <div className="bg-neutral-900 px-4 pt-4 pb-5">
        {forecastQuery.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs text-neutral-500 animate-pulse">
              {t("common.loading")}
            </span>
          </div>
        ) : forecastQuery.isError || days.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs text-neutral-500">
              {t("dashboard.weather.forecast.unavailable")}
            </span>
          </div>
        ) : (
          <div className="flex gap-1">
            {days.map((day, i) => {
              const { short, isToday } = dayLabel(day.date, i18n.language);
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center gap-0 flex-1 min-w-0"
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-1",
                      isToday ? "text-sky-400" : "text-neutral-500",
                    )}
                  >
                    {isToday ? t("dashboard.weather.forecast.today") : short}
                  </span>
                  <DayColumn
                    day={day}
                    icon={dayIcon(day.weather_code)}
                    isToday={isToday}
                    unit={unit}
                    globalMin={globalMin}
                    globalMax={globalMax}
                    index={i}
                  />
                </div>
              );
            })}
          </div>
        )}

        {days.length > 0 && !forecastQuery.isLoading && (
          <div className="mt-3 pt-3 border-t border-neutral-800 flex gap-1">
            {days.map((day) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                <Wind className="size-2.5 text-neutral-600" strokeWidth={2} />
                <span className="text-[9px] tabular-nums text-neutral-500">
                  {Math.round(day.wind_speed_max_kmh)}
                </span>
              </div>
            ))}
          </div>
        )}

        {days.length > 0 && !forecastQuery.isLoading && (
          <p className="mt-2 text-center text-[9px] text-neutral-600">
            {t("dashboard.weather.forecast.windKmh")}
          </p>
        )}
      </div>
    </Dialog>
  );
}
