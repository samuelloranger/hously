import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment } from "react";
import { createPortal } from "react-dom";
import { X, Droplets, Wind } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WeatherData, WeatherForecastDay } from "@hously/shared/types";
import { getWeatherConditionKey } from "@hously/shared/utils";
import { useDashboardWeatherForecast } from "@/hooks/useWeather";
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
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toCelsius = (f: number) => Math.round((f - 32) * (5 / 9));
const toDisplay = (f: number, unit: "fahrenheit" | "celsius") =>
  unit === "celsius" ? toCelsius(f) : Math.round(f);

function dayIcon(code: number): LucideIcon {
  const key = getWeatherConditionKey(code);
  switch (key) {
    case "clearSky": return Sun;
    case "partlyCloudy": return CloudSun;
    case "overcast": return Cloud;
    case "foggy": return CloudFog;
    case "drizzle":
    case "freezingDrizzle": return CloudDrizzle;
    case "rain":
    case "freezingRain": return CloudRain;
    case "snow": return CloudSnow;
    case "thunderstorm": return CloudLightning;
    default: return CloudSun;
  }
}

function dayLabel(dateStr: string, locale: string): { short: string; isToday: boolean } {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  const short = date.toLocaleDateString(locale, { weekday: "short" });
  return { short, isToday };
}

/** Maps a temperature (°F) to a colour class for the range bar. */
function tempColorClass(f: number): string {
  if (f <= 32) return "from-blue-400 to-blue-300";
  if (f <= 50) return "from-sky-400 to-cyan-300";
  if (f <= 65) return "from-emerald-400 to-teal-300";
  if (f <= 80) return "from-amber-400 to-yellow-300";
  return "from-orange-500 to-red-400";
}

// ─── Day icon wrapper (module-level — avoids static-components lint rule) ─────

function DayWeatherIcon({ icon: Icon, isToday }: { icon: LucideIcon; isToday: boolean }) {
  return (
    <Icon
      className={cn(
        "size-7 shrink-0",
        isToday
          ? "text-sky-500 dark:text-sky-400"
          : "text-zinc-400 dark:text-zinc-500",
      )}
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

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

  // Position the temperature range bar within the week's overall range
  const range = globalMax - globalMin || 1;
  const barBottom = ((day.temperature_min_f - globalMin) / range) * 100;
  const barHeight = ((day.temperature_max_f - day.temperature_min_f) / range) * 100;
  const avgF = (day.temperature_max_f + day.temperature_min_f) / 2;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-2 py-3 rounded-xl transition-colors flex-1 min-w-0",
        isToday
          ? "bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-200 dark:ring-sky-800"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Day label */}
      <span
        className={cn(
          "text-[11px] font-bold uppercase tracking-widest",
          isToday
            ? "text-sky-600 dark:text-sky-400"
            : "text-zinc-400 dark:text-zinc-500",
        )}
      >
        {isToday ? "—" : ""}
        {/* rendered by parent via dayLabel */}
      </span>

      {/* Weather icon */}
      <DayWeatherIcon icon={icon} isToday={isToday} />

      {/* Temperature range bar */}
      <div className="relative h-16 w-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700/60 overflow-hidden flex-shrink-0">
        <div
          className={cn("absolute w-full rounded-full bg-gradient-to-t", tempColorClass(avgF))}
          style={{
            bottom: `${barBottom}%`,
            height: `${Math.max(barHeight, 8)}%`,
          }}
        />
      </div>

      {/* High */}
      <span className={cn(
        "text-sm font-semibold tabular-nums leading-none",
        isToday ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300",
      )}>
        {maxDisplay}°
      </span>

      {/* Low */}
      <span className="text-xs tabular-nums leading-none text-zinc-400 dark:text-zinc-500">
        {minDisplay}°
      </span>

      {/* Precipitation */}
      {day.precipitation_probability_max >= 20 ? (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Droplets className="size-2.5 text-sky-400" strokeWidth={2} />
          <span className="text-[10px] font-medium tabular-nums text-sky-500 dark:text-sky-400">
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

  // Gradient background based on the dominant week weather
  const dominantCode = days[0]?.weather_code ?? current.weather_code;
  const condKey = getWeatherConditionKey(dominantCode);
  const headerGradient =
    condKey === "clearSky" || condKey === "partlyCloudy"
      ? "from-sky-400 via-blue-500 to-indigo-600"
      : condKey === "rain" || condKey === "drizzle" || condKey === "freezingRain"
        ? "from-slate-500 via-slate-600 to-slate-800"
        : condKey === "thunderstorm"
          ? "from-zinc-700 via-slate-800 to-zinc-900"
          : condKey === "snow"
            ? "from-sky-200 via-blue-300 to-slate-400"
            : condKey === "foggy"
              ? "from-zinc-400 via-zinc-500 to-zinc-600"
              : "from-sky-500 via-blue-600 to-indigo-700";

  const PORTAL_ID = "hously-dialog-root";

  return createPortal(
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        open={isOpen}
        as="div"
        className="fixed inset-0 z-[var(--z-modal)]"
        onClose={onClose}
      >
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        {/* Panel */}
        <div className="fixed inset-0 overflow-y-auto overscroll-contain pointer-events-none">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-2"
            >
              <DialogPanel className="pointer-events-auto w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-700">

                {/* Gradient header */}
                <div className={cn("relative bg-gradient-to-br px-5 pt-5 pb-6", headerGradient)}>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("common.close")}
                    className="absolute top-4 right-4 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="size-4" />
                  </button>

                  <DialogTitle className="sr-only">
                    {t("dashboard.weather.forecast.title")}
                  </DialogTitle>

                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-1">
                    {current.location_name}
                  </p>
                  <p className="text-2xl font-bold text-white leading-none tabular-nums">
                    {toDisplay(current.temperature_f, unit)}°{unit === "celsius" ? "C" : "F"}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    {t(`dashboard.weather.conditions.${getWeatherConditionKey(current.weather_code)}`, {
                      defaultValue: current.condition_label,
                    })}
                    {" · "}
                    {t("dashboard.weather.feelsLike", {
                      temp: toDisplay(current.feels_like_f, unit),
                      unit: unit === "celsius" ? "C" : "F",
                    })}
                  </p>
                </div>

                {/* Week grid */}
                <div className="bg-white dark:bg-zinc-900 px-4 pt-4 pb-5">
                  {forecastQuery.isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">
                        {t("common.loading")}
                      </span>
                    </div>
                  ) : forecastQuery.isError || days.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t("dashboard.weather.forecast.unavailable")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {days.map((day, i) => {
                        const { short, isToday } = dayLabel(day.date, i18n.language);
                        return (
                          <div key={day.date} className="flex flex-col items-center gap-0 flex-1 min-w-0">
                            {/* Day label above the column */}
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-widest mb-1",
                                isToday
                                  ? "text-sky-500 dark:text-sky-400"
                                  : "text-zinc-400 dark:text-zinc-500",
                              )}
                            >
                              {isToday
                                ? t("dashboard.weather.forecast.today")
                                : short}
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

                  {/* Wind row */}
                  {days.length > 0 && !forecastQuery.isLoading && (
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-1">
                      {days.map((day) => (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                          <Wind className="size-2.5 text-zinc-300 dark:text-zinc-600" strokeWidth={2} />
                          <span className="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            {Math.round(day.wind_speed_max_kmh)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {days.length > 0 && !forecastQuery.isLoading && (
                    <p className="mt-2 text-center text-[9px] text-zinc-300 dark:text-zinc-600">
                      {t("dashboard.weather.forecast.windKmh")}
                    </p>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>,
    document.body,
    PORTAL_ID,
  );
}
