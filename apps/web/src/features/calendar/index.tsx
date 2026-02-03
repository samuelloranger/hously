import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageLayout } from "../../components/PageLayout";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import type {
  CalendarEvent,
  CalendarEventCustomEventMetadata,
} from "../../types/api";
import { CreateCustomEventForm } from "./components/CreateCustomEventForm";
import { sortBy } from "lodash-es";
import { formatDate, parseDate, sameDay, sameMonth } from "@/lib/date-utils";
import { getDayName, getMonthName, splitMultiDayEvent } from "./utils";
import { EventCard } from "./components/EventCard";
import { cn } from "@/lib/utils";
import { startOfDay } from "date-fns";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { HouseLoader } from "@/components/HouseLoader";

export function Calendar() {
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const today = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | undefined>(
    undefined,
  );
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [calendarGridRef] = useAutoAnimate();
  const [selectedDayEventsContainerRef] = useAutoAnimate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.calendar.events(currentYear, currentMonth),
    queryFn: () => api.getCalendarEvents(currentYear, currentMonth),
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: number) => api.deleteCustomEvent(eventId),
    onSuccess: () => {
      toast.success(t("calendar.customEventDeleted"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events(currentYear, currentMonth),
      });
      // Clear selected date if the deleted event was selected
      setSelectedDate(null);
    },
    onError: (error: any) => {
      toast.error(
        error?.message ||
          t("calendar.customEventDeleteError") ||
          t("common.error"),
      );
    },
  });

  const events = data?.events || [];

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
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const grid: Date[][] = [];
    let currentWeek: Date[] = [];

    // Add empty cells for days before the first day of the month
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

    // Add days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth - 1, day);
      currentWeek.push(date);

      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add empty cells for days after the last day of the month
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

  const handleDayClick = (date: Date) => {
    if (sameDay(date, selectedDate)) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(date);
  };

  const getDayEvents = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    return eventsByDate[dateStr] || [];
  };

  const isCurrentMonth = (date: Date): boolean => {
    return sameMonth(date, new Date(currentYear, currentMonth - 1, 1));
  };

  const getEventTypeColor = (type: CalendarEvent["type"], metadata?: any) => {
    if (type === "custom_event" && metadata?.color) {
      return metadata.color;
    }
    switch (type) {
      case "chore":
        return "bg-blue-500";
      default:
        return "bg-neutral-500";
    }
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getDayEvents(selectedDate);
  }, [getDayEvents, selectedDate]);

  return (
    <PageLayout>
      <div className="mb-8 flex flex-col md:flex-row items-between md:items-center justify-between">
        <PageHeader
          icon="📅"
          iconColor="text-blue-600"
          title={t("calendar.title")}
          subtitle={t("calendar.subtitle")}
        />
        <Button onClick={() => setIsCreateEventOpen(true)}>
          <span className="mr-2">
            <PlusIcon />
          </span>
          {t("calendar.addEvent")}
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-4 md:p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Previous month"
          >
            <svg
              className="w-5 h-5 text-neutral-600 dark:text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            {getMonthName(t, currentMonth - 1)} {currentYear}
          </h2>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Next month"
          >
            <svg
              className="w-5 h-5 text-neutral-600 dark:text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex flex-col md:flex-row gap-6 overflow-x-auto overflow-y-hidden space-y-4">
          <table className="w-full md:w-[65%]" ref={calendarGridRef}>
            <thead>
              <tr>
                {new Array(7).fill(0).map((_, day) => (
                  <th
                    key={day}
                    className="p-2 text-center text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    {getDayName(t, day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarGrid.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((date, dayIndex) => {
                    const sortedDayEvents = sortBy(
                      getDayEvents(date),
                      (event) => {
                        if (event.type === "custom_event") {
                          const start = parseDate(
                            event.metadata.start_datetime,
                          );
                          if (!start) return 24;
                          return start.getHours();
                        }
                        return 24;
                      },
                    );
                    const isCurrentMonthDay = isCurrentMonth(date);
                    const isTodayDay = sameDay(date, today);
                    const isSelectedDate = sameDay(date, selectedDate);

                    return (
                      <td
                        key={dayIndex}
                        className={`w-[calc(100%/7)] aspect-square p-1 border border-neutral-200 dark:border-neutral-700 ${
                          !isCurrentMonthDay
                            ? "bg-neutral-50 dark:bg-neutral-900 opacity-50"
                            : "bg-white dark:bg-neutral-800"
                        }${isTodayDay ? "bg-blue-50 dark:bg-neutral-900" : ""}`}
                      >
                        <div className="w-full aspect-square flex">
                          <button
                            onClick={() => handleDayClick(date)}
                            className={cn(
                              "w-full h-full min-w-[auto] min-h-[auto] flex flex-col items-start p-1 md:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700",
                              {
                                "ring-2 ring-blue-500 dark:ring-blue-50 dark:bg-neutral-600":
                                  isSelectedDate,
                              },
                            )}
                            disabled={!date}
                          >
                            <span
                              className={`text-xs md:text-xs lg:text-sm font-medium mb-1 ${
                                isCurrentMonthDay
                                  ? "text-neutral-900 dark:text-white"
                                  : "text-neutral-400 dark:text-neutral-500"
                              }`}
                            >
                              {date?.getDate()}
                            </span>
                            <div className="flex items-start flex-wrap gap-1 w-full">
                              {sortedDayEvents.slice(0, 3).map((event) => {
                                return (
                                  <div
                                    key={event.id}
                                    className={
                                      event.type === "custom_event"
                                        ? `flex items-center justify-center w-1 min-w-1 rounded-full h-1`
                                        : `w-1 h-1 rounded-full ${getEventTypeColor(
                                            event.type,
                                          )}`
                                    }
                                    style={{
                                      ...(event.type === "custom_event" && {
                                        backgroundColor: event.metadata?.color,
                                      }),
                                    }}
                                    title={event.title}
                                  />
                                );
                              })}
                            </div>
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="w-full md:w-[45%]">
            {isLoading ? (
              <HouseLoader />
            ) : (
              selectedDate && (
                <>
                  <div className="flex justify-end mb-4">
                    {formatDate(selectedDate, i18n.language)}
                  </div>

                  <div
                    className="flex flex-col gap-2"
                    ref={selectedDayEventsContainerRef}
                  >
                    {selectedDayEvents.length > 0 ? (
                      selectedDayEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onEditEvent={() => {
                            setEventToEdit(event);
                            setIsEditEventOpen(true);
                          }}
                          onDeleteEvent={(eventToDelete) => {
                            if (
                              eventToDelete.type === "custom_event" &&
                              eventToDelete.metadata?.custom_event_id
                            ) {
                              deleteMutation.mutate(
                                eventToDelete.metadata.custom_event_id,
                              );
                            }
                          }}
                        />
                      ))
                    ) : (
                      <div className="text-neutral-500 dark:text-neutral-400">
                        No events for this day
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-neutral-700 dark:text-neutral-300">
              {t("calendar.chores")}
            </span>
          </div>
        </div>
      </div>

      {/* Create Custom Event Dialog */}
      <CreateCustomEventForm
        isOpen={isCreateEventOpen}
        onClose={() => {
          setIsCreateEventOpen(false);
          refetch();
        }}
      />

      {/* Edit Custom Event Dialog */}
      {eventToEdit && (
        <CreateCustomEventForm
          isOpen={isEditEventOpen}
          onClose={() => {
            setIsEditEventOpen(false);
            setEventToEdit(undefined);
            refetch();
          }}
          eventToEdit={
            eventToEdit as CalendarEvent & CalendarEventCustomEventMetadata
          }
        />
      )}
    </PageLayout>
  );
}
