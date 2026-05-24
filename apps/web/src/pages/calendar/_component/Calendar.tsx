import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useCalendarEvents } from "@/pages/calendar/useCalendar";
import { useDashboardUpcoming } from "@/pages/_component/useDashboardUpcoming";
import type {
  CalendarEvent,
  CalendarEventCustomEventMetadata,
  DashboardUpcomingItem,
  TmdbMediaSearchItem,
} from "@hously/shared/types";
import { parseDate, sameDay } from "@hously/shared/utils";
import { CreateCustomEventForm } from "@/pages/calendar/_component/CreateCustomEventForm";
import { sortBy } from "lodash-es";
import { splitMultiDayEvent } from "@/pages/calendar/_component/utils";
import { startOfDay } from "date-fns";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";
import { useModalSearchParams } from "@/lib/routing/useModalSearchParams";
import {
  parseCalendarSearchDate,
  localDateKey,
  upcomingToDialogItem,
} from "@/pages/calendar/_component/calendarUtils";
import { CalendarGrid } from "@/pages/calendar/_component/CalendarGrid";
import { CalendarDayPanel } from "@/pages/calendar/_component/CalendarDayPanel";

export type CalendarSearchParams = {
  date?: string;
  eventId?: number;
  modal?: "create" | "edit";
};

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
  const { t } = useTranslation("common");
  const navigate = useNavigate();
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

  const {
    data: events = [],
    isLoading,
    refetch,
  } = useCalendarEvents(currentYear, currentMonth);
  const { data: upcomingData, isLoading: upcomingLoading } =
    useDashboardUpcoming();
  const targetedEventId = searchParams.eventId;
  const [releaseDialogItem, setReleaseDialogItem] =
    useState<TmdbMediaSearchItem | null>(null);

  const handleReleaseClick = (item: DashboardUpcomingItem) => {
    if (item.library_id != null) {
      navigate({
        to: "/library/$libraryId",
        params: { libraryId: String(item.library_id) },
      });
      return;
    }

    setReleaseDialogItem(upcomingToDialogItem(item));
  };

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

  const getEventDotColor = (event: CalendarEvent) => {
    if (event.type === "custom_event" && event.metadata?.color) {
      return event.metadata.color;
    }
    if (event.type === "chore") return "#3b82f6";
    if (event.type === "public_holiday") return "#f59e0b";
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
        if (event.type === "public_holiday") return -1;
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
          icon={CalendarIcon}
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
        <CalendarGrid
          currentYear={currentYear}
          currentMonth={currentMonth}
          today={today}
          selectedDate={selectedDate}
          calendarGrid={calendarGrid}
          isViewingCurrentMonth={isViewingCurrentMonth}
          getDayEvents={getDayEvents}
          getDayReleases={getDayReleases}
          getEventDotColor={getEventDotColor}
          onDayClick={handleDayClick}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onGoToToday={handleGoToToday}
        />

        <CalendarDayPanel
          selectedDate={selectedDate}
          selectedDayEvents={selectedDayEvents}
          selectedDayReleases={selectedDayReleases}
          isLoading={isLoading}
          upcomingLoading={upcomingLoading}
          targetedEventId={targetedEventId}
          onClearSelectedDate={() => setSelectedDate(null)}
          onCreateEvent={() => setParams({ modal: "create" })}
          onEditEvent={(eventId) =>
            setParams({ modal: "edit", eventId })
          }
          onReleaseClick={handleReleaseClick}
        />
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
