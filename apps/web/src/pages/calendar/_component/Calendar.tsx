import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  useCalendarEvents,
  useDeleteCustomEvent,
} from "@/hooks/calendar/useCalendar";
import { useDashboardUpcoming } from "@/hooks/dashboard/useDashboard";
import type {
  CalendarEvent,
  CalendarEventCustomEventMetadata,
  DashboardUpcomingItem,
  TmdbMediaSearchItem,
} from "@hously/shared/types";
import {
  formatDate,
  parseDate,
  sameDay,
  sameMonth,
} from "@hously/shared/utils";
import { CreateCustomEventForm } from "@/pages/calendar/_component/CreateCustomEventForm";
import { sortBy } from "lodash-es";
import {
  getDayName,
  getMonthName,
  splitMultiDayEvent,
} from "@/pages/calendar/_component/utils";
import { EventCard } from "@/pages/calendar/_component/EventCard";
import { cn } from "@/lib/utils";
import { startOfDay } from "date-fns";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useSearch } from "@tanstack/react-router";
import {
  PlusIcon,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
} from "lucide-react";
import { HouseLoader } from "@/components/HouseLoader";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";
import { useModalSearchParams } from "@/lib/routing/useModalSearchParams";
export type CalendarSearchParams = {
  date?: string;
  eventId?: number;
  modal?: "create" | "edit";
};

function parseCalendarSearchDate(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function upcomingToDialogItem(
  item: DashboardUpcomingItem,
): TmdbMediaSearchItem {
  const numericPart = item.id.split("-").pop() ?? "";
  const tmdbId = parseInt(numericPart, 10);
  return {
    id: item.id,
    tmdb_id: Number.isFinite(tmdbId) ? tmdbId : 0,
    media_type: item.media_type,
    title: item.title,
    release_year: item.release_date
      ? new Date(item.release_date).getUTCFullYear()
      : null,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: item.vote_average ?? null,
    already_exists: false,
    can_add: true,
    source_id: null,
  };
}

export function Calendar() {
  const searchParams = useSearch({
    from: "/calendar/",
  }) as CalendarSearchParams;
  return (
    <CalendarBody
      key={searchParams.date ?? "none"}
      searchParams={searchParams}
    />
  );
}

function CalendarBody({
  searchParams,
}: {
  searchParams: CalendarSearchParams;
}) {
  const { t, i18n } = useTranslation("common");
  const { setParams, resetParams } = useModalSearchParams(
    "/calendar",
    searchParams,
  );

  const today = startOfDay(new Date());
  const initialNotificationDate = useMemo(
    () => parseCalendarSearchDate(searchParams.date),
    [searchParams.date],
  );
  const initialDate = initialNotificationDate ?? today;

  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
  const [selectedDayEventsContainerRef] = useAutoAnimate();

  const {
    data: events = [],
    isLoading,
    refetch,
  } = useCalendarEvents(currentYear, currentMonth);
  const { data: upcomingData, isLoading: upcomingLoading } =
    useDashboardUpcoming();
  const deleteMutation = useDeleteCustomEvent();
  const targetedEventId = searchParams.eventId;
  const [releaseDialogItem, setReleaseDialogItem] =
    useState<TmdbMediaSearchItem | null>(null);

  const releasesByDate = useMemo(() => {
    const map = new Map<string, DashboardUpcomingItem[]>();
    for (const item of upcomingData?.items ?? []) {
      if (!item.release_date) continue;
      const k = item.release_date.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    return map;
  }, [upcomingData?.items]);

  const eventToEdit = useMemo(() => {
    if (searchParams.modal !== "edit" || !targetedEventId) return undefined;
    return events.find(
      (e) =>
        e.type === "custom_event" &&
        e.metadata?.custom_event_id === targetedEventId,
    );
  }, [events, searchParams.modal, targetedEventId]);

  const isCreateEventOpen = searchParams.modal === "create";

  // Split multi-day events and group by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    // Split multi-day events first
    const splitEvents: CalendarEvent[] = [];
    events.forEach((event) => {
      const split = splitMultiDayEvent(event);
      splitEvents.push(...split);
    });

    // Group by date
    splitEvents.forEach((event) => {
      if (!grouped[event.date]) {
        grouped[event.date] = [];
      }
      grouped[event.date].push(event);
    });

    return grouped;
  }, [events]);

  // Get calendar grid
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const grid: Date[][] = [];
    let currentWeek: Date[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
      const date = new Date(
        prevYear,
        prevMonth - 1,
        daysInPrevMonth - startingDayOfWeek + i + 1,
      );
      currentWeek.push(date);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth - 1, day);
      currentWeek.push(date);

      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    let nextMonthDay = 1;

    while (currentWeek.length < 7) {
      const date = new Date(nextYear, nextMonth - 1, nextMonthDay);
      currentWeek.push(date);
      nextMonthDay++;
    }

    if (currentWeek.length > 0) {
      grid.push(currentWeek);
    }

    return grid;
  }, [currentYear, currentMonth]);

  const handlePreviousMonth = () => {
    setSelectedDate(null);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDate(null);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
    setSelectedDate(today);
  };

  const handleDayClick = (date: Date) => {
    if (sameDay(date, selectedDate)) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(date);
  };

  const getDayEvents = (date: Date): CalendarEvent[] => {
    const dateStr = localDateKey(date);
    return eventsByDate[dateStr] || [];
  };

  const getDayReleases = (date: Date): DashboardUpcomingItem[] => {
    const k = localDateKey(date);
    return releasesByDate.get(k) ?? [];
  };

  const isCurrentMonth = (date: Date): boolean => {
    return sameMonth(date, new Date(currentYear, currentMonth - 1, 1));
  };

  const getEventDotColor = (event: CalendarEvent) => {
    if (event.type === "custom_event" && event.metadata?.color) {
      return event.metadata.color;
    }
    if (event.type === "chore") return "#3b82f6";
    if (event.type === "meal_plan") return "#f59e0b";
    return "#6b7280";
  };

  const selectedDayEvents = selectedDate
    ? sortBy(getDayEvents(selectedDate), (event) => {
        if (
          targetedEventId &&
          event.type === "custom_event" &&
          event.metadata?.custom_event_id === targetedEventId
        ) {
          return -1;
        }
        if (event.type === "custom_event") {
          const start = parseDate(event.metadata.start_datetime);
          if (!start) return 24;
          return start.getHours();
        }
        return 24;
      })
    : [];

  const selectedDayReleases = selectedDate ? getDayReleases(selectedDate) : [];

  // Check if viewing the current month
  const isViewingCurrentMonth =
    currentMonth === today.getMonth() + 1 &&
    currentYear === today.getFullYear();

  return (
    <PageLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PageHeader
          icon="📅"
          iconColor="text-blue-600"
          title={t("calendar.title")}
          subtitle={t("calendar.subtitle")}
        />
        <Button
          onClick={() => setParams({ modal: "create" })}
          className="rounded-xl"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("calendar.addEvent")}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Calendar Grid Card */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/90 dark:border-neutral-600/60">
              <button
                onClick={handlePreviousMonth}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
              </button>

              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">
                  {getMonthName(t, currentMonth - 1)} {currentYear}
                </h2>
                {!isViewingCurrentMonth && (
                  <button
                    onClick={handleGoToToday}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    {t("calendar.today") || "Today"}
                  </button>
                )}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-neutral-200/90 dark:border-neutral-600/60">
              {new Array(7).fill(0).map((_, day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
                >
                  {getDayName(t, day)}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarGrid.flat().map((date, index) => {
                const dayEvents = getDayEvents(date);
                const dayReleases = getDayReleases(date);
                const isCurrentMonthDay = isCurrentMonth(date);
                const isTodayDay = sameDay(date, today);
                const isSelectedDate = sameDay(date, selectedDate);
                const maxDots = 4;
                const eventDots = dayEvents.slice(0, maxDots);
                const overflow =
                  dayEvents.length > maxDots ? dayEvents.length - maxDots : 0;
                const hasEventDots = dayEvents.length > 0;

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(date)}
                    className={cn(
                      "relative aspect-square min-h-0 p-1 sm:p-1.5 flex flex-col items-stretch transition-all duration-150 border-b border-r border-neutral-200/90 dark:border-neutral-600/55",
                      !isCurrentMonthDay && "opacity-30",
                      isCurrentMonthDay &&
                        "hover:bg-primary-50/50 dark:hover:bg-primary-900/10",
                      isSelectedDate && "bg-primary-50 dark:bg-primary-900/20",
                    )}
                  >
                    <div className="flex flex-col items-center flex-1 min-h-0 w-full h-full">
                      {/* Day number */}
                      <span
                        className={cn(
                          "relative z-10 shrink-0 text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200",
                          isTodayDay &&
                            "bg-primary-600 text-white font-semibold shadow-sm shadow-primary-600/30",
                          isSelectedDate &&
                            !isTodayDay &&
                            "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold",
                          !isTodayDay &&
                            !isSelectedDate &&
                            isCurrentMonthDay &&
                            "text-neutral-700 dark:text-neutral-300",
                          !isCurrentMonthDay &&
                            "text-neutral-400 dark:text-neutral-600",
                        )}
                      >
                        {date?.getDate()}
                      </span>

                      {/* Event dots — directly under the date */}
                      {hasEventDots && (
                        <div className="flex items-center justify-center gap-0.5 pt-0.5 flex-wrap shrink-0">
                          {eventDots.map((event) => (
                            <div
                              key={event.id}
                              className="w-1.5 h-1.5 rounded-full transition-transform duration-200 shrink-0"
                              style={{
                                backgroundColor: getEventDotColor(event),
                              }}
                            />
                          ))}
                          {overflow > 0 && (
                            <span className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400 ml-0.5 tabular-nums">
                              +{overflow}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Spacer so release posters sit at the bottom of the cell */}
                      <div
                        className="flex-1 min-h-[2px] w-full shrink"
                        aria-hidden
                      />

                      {/* Release posters — bottom of square */}
                      {dayReleases.length > 0 && (
                        <div className="flex w-full shrink-0 items-end justify-center gap-0.5 px-0.5 pb-0.5 overflow-hidden">
                          {dayReleases.slice(0, 2).map((item) =>
                            item.poster_url ? (
                              <img
                                key={item.id}
                                src={item.poster_url}
                                alt=""
                                className="h-7 w-[18px] sm:h-8 sm:w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-black/15 dark:ring-black/50"
                              />
                            ) : (
                              <div
                                key={item.id}
                                className="flex h-7 w-[18px] sm:h-8 sm:w-[22px] shrink-0 items-center justify-center rounded-[3px] bg-neutral-200/80 dark:bg-neutral-700/80 text-[10px]"
                                aria-hidden
                              >
                                🎞️
                              </div>
                            ),
                          )}
                          {dayReleases.length > 2 && (
                            <div className="flex h-7 w-[18px] sm:h-8 sm:w-[22px] shrink-0 items-center justify-center rounded-[3px] bg-neutral-200/90 dark:bg-neutral-800/90 ring-1 ring-neutral-300/80 dark:ring-neutral-600/80">
                              <span className="text-[8px] font-bold text-neutral-500 dark:text-neutral-400 tabular-nums">
                                +{dayReleases.length - 2}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-5 py-3 border-t border-neutral-200/90 dark:border-neutral-600/60 flex flex-wrap gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{t("calendar.chores")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{t("calendar.mealPlans") || "Meal Plans"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Day Events Panel */}
        <div className="w-full lg:w-[380px] shrink-0">
          {isLoading ? (
            <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-8 flex items-center justify-center">
              <HouseLoader />
            </div>
          ) : selectedDate ? (
            <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 overflow-hidden sticky top-6">
              {/* Panel Header */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {formatDate(selectedDate, i18n.language)}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {selectedDayEvents.length === 0 &&
                    selectedDayReleases.length === 0 &&
                    upcomingLoading
                      ? t("calendar.loadingReleases")
                      : selectedDayEvents.length === 0 &&
                          selectedDayReleases.length === 0
                        ? t("calendar.nothingScheduled")
                        : [
                            selectedDayEvents.length > 0 &&
                              `${selectedDayEvents.length} ${
                                selectedDayEvents.length === 1
                                  ? t("calendar.event") || "event"
                                  : t("calendar.events") || "events"
                              }`,
                            selectedDayReleases.length > 0 &&
                              `${selectedDayReleases.length} ${
                                selectedDayReleases.length === 1
                                  ? t("calendar.releaseSingular")
                                  : t("calendar.releasePlural")
                              }`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Events List */}
              <div
                className="p-3 max-h-[calc(100vh-280px)] overflow-y-auto no-scrollbar"
                ref={selectedDayEventsContainerRef}
              >
                {selectedDayEvents.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        highlighted={Boolean(
                          targetedEventId &&
                          event.type === "custom_event" &&
                          event.metadata?.custom_event_id === targetedEventId,
                        )}
                        onEditEvent={() => {
                          if (
                            event.type === "custom_event" &&
                            event.metadata?.custom_event_id
                          ) {
                            setParams({
                              modal: "edit",
                              eventId: event.metadata.custom_event_id,
                            });
                          }
                        }}
                        onDeleteEvent={(eventToDelete) => {
                          if (
                            eventToDelete.type === "custom_event" &&
                            eventToDelete.metadata?.custom_event_id
                          ) {
                            deleteMutation.mutate(
                              eventToDelete.metadata.custom_event_id,
                              {
                                onSuccess: () => {
                                  toast.success(
                                    t("calendar.customEventDeleted"),
                                  );
                                  setSelectedDate(null);
                                },
                                onError: (error: any) => {
                                  toast.error(
                                    error?.message ||
                                      t("calendar.customEventDeleteError") ||
                                      t("common.error"),
                                  );
                                },
                              },
                            );
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                {selectedDayReleases.length > 0 ? (
                  <div
                    className={cn(
                      "flex flex-col gap-2",
                      selectedDayEvents.length > 0 &&
                        "mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700/50",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-0.5">
                      {t("calendar.releasesSection")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {selectedDayReleases.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setReleaseDialogItem(upcomingToDialogItem(item))
                          }
                          className="flex items-center gap-3 rounded-xl p-2 text-left ring-1 ring-neutral-200/80 dark:ring-neutral-700/80 transition-[background-color] hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
                        >
                          {item.poster_url ? (
                            <img
                              src={item.poster_url}
                              alt=""
                              className="h-14 w-10 shrink-0 rounded-md object-cover ring-1 ring-black/10 dark:ring-black/50"
                            />
                          ) : (
                            <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-900 text-lg ring-1 ring-neutral-200 dark:ring-neutral-800">
                              🎞️
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
                              {item.title}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="rounded-full border border-neutral-200 dark:border-neutral-600 px-1.5 py-px text-[8px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                {item.media_type === "movie"
                                  ? t("calendar.film")
                                  : t("calendar.tv")}
                              </span>
                              {item.vote_average ? (
                                <span className="text-[10px] text-neutral-500 tabular-nums">
                                  {Math.round(item.vote_average * 10)}%
                                </span>
                              ) : null}
                            </div>
                            {item.providers.length > 0 && (
                              <div className="mt-1.5 flex gap-1">
                                {item.providers.slice(0, 4).map((p) => (
                                  <img
                                    key={p.id}
                                    src={p.logo_url}
                                    alt={p.name}
                                    title={p.name}
                                    className="h-4 w-4 rounded-[3px] object-contain"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : upcomingLoading && selectedDayEvents.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <HouseLoader size="sm" />
                  </div>
                ) : selectedDayEvents.length === 0 ? (
                  <div className="py-10 flex flex-col items-center text-center">
                    <CalendarDays className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mb-3" />
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">
                      {t("calendar.noEvents") || "No events for this day"}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                      {t("calendar.noReleasesThisDay")}
                    </p>
                    <button
                      onClick={() => setParams({ modal: "create" })}
                      className="mt-3 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                      + {t("calendar.addEvent")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-8 flex flex-col items-center text-center">
              <CalendarDays className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mb-3" />
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t("calendar.selectDay") || "Select a day to view events"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Custom Event Dialog */}
      <CreateCustomEventForm
        key="calendar-create-event"
        isOpen={isCreateEventOpen}
        onClose={() => {
          resetParams(["modal"]);
          refetch();
        }}
      />

      {/* Edit Custom Event Dialog */}
      {eventToEdit && (
        <CreateCustomEventForm
          key={
            eventToEdit.type === "custom_event" &&
            eventToEdit.metadata &&
            "custom_event_id" in eventToEdit.metadata
              ? String(
                  (eventToEdit.metadata as { custom_event_id: number })
                    .custom_event_id,
                )
              : "edit"
          }
          isOpen={searchParams.modal === "edit"}
          onClose={() => {
            resetParams(["modal", "eventId"]);
            refetch();
          }}
          eventToEdit={
            eventToEdit as CalendarEvent & CalendarEventCustomEventMetadata
          }
        />
      )}

      {releaseDialogItem && (
        <ExploreCardDetailDialog
          item={releaseDialogItem}
          isOpen={true}
          onClose={() => setReleaseDialogItem(null)}
          onAdded={() => setReleaseDialogItem(null)}
        />
      )}
    </PageLayout>
  );
}
