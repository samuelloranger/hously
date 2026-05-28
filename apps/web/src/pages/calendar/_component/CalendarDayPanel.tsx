import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarDays, Film, X } from "lucide-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import type {
  CalendarEvent,
  DashboardUpcomingItem,
} from "@hously/shared/types";
import { formatDate } from "@hously/shared/utils";
import { cn } from "@/lib/utils";
import { EventCard } from "@/pages/calendar/_component/EventCard";
import { useDeleteCustomEvent } from "@/pages/calendar/useCalendar";

interface CalendarDayPanelProps {
  selectedDate: Date | null;
  selectedDayEvents: CalendarEvent[];
  selectedDayReleases: DashboardUpcomingItem[];
  isLoading: boolean;
  upcomingLoading: boolean;
  targetedEventId: number | undefined;
  onClearSelectedDate: () => void;
  onCreateEvent: () => void;
  onEditEvent: (eventId: number) => void;
  onReleaseClick: (item: DashboardUpcomingItem) => void;
}

export function CalendarDayPanel({
  selectedDate,
  selectedDayEvents,
  selectedDayReleases,
  isLoading,
  upcomingLoading,
  targetedEventId,
  onClearSelectedDate,
  onCreateEvent,
  onEditEvent,
  onReleaseClick,
}: CalendarDayPanelProps) {
  const { t, i18n } = useTranslation("common");
  const [selectedDayEventsContainerRef] = useAutoAnimate();
  const deleteMutation = useDeleteCustomEvent();

  return (
    <div className="w-full lg:w-[380px] shrink-0">
      {isLoading ? (
        <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 overflow-hidden sticky top-6">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
            <div className="h-4 w-28 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse mt-2" />
          </div>
          <div className="p-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/60 dark:bg-neutral-900/20 overflow-hidden flex"
              >
                <div className="w-1 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                <div className="px-3 py-2.5 flex-1 space-y-1.5">
                  <div
                    className="h-3 w-3/4 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                  <div
                    className="h-2.5 w-1/3 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                    style={{ animationDelay: `${i * 60 + 40}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
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
              onClick={onClearSelectedDate}
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
                        onEditEvent(event.metadata.custom_event_id);
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
                              toast.success(t("calendar.customEventDeleted"));
                              onClearSelectedDate();
                            },
                            onError: (error: Error) => {
                              toast.error(
                                error.message ||
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
                      onClick={() => onReleaseClick(item)}
                      className="flex items-center gap-3 rounded-xl p-2 text-left ring-1 ring-neutral-200/80 dark:ring-neutral-700/80 transition-[background-color] hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
                    >
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt=""
                          className="h-14 w-10 shrink-0 rounded-md object-cover ring-1 ring-black/10 dark:ring-black/50"
                        />
                      ) : (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-900 ring-1 ring-neutral-200 dark:ring-neutral-800">
                          <Film className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
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
              <div className="flex flex-col gap-2 pt-1">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/60 dark:bg-neutral-900/20 overflow-hidden flex"
                  >
                    <div className="w-1 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                    <div className="px-3 py-2.5 flex-1 space-y-1.5">
                      <div
                        className="h-3 w-2/3 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                        style={{ animationDelay: `${i * 60}ms` }}
                      />
                      <div
                        className="h-2.5 w-1/3 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                        style={{ animationDelay: `${i * 60 + 40}ms` }}
                      />
                    </div>
                  </div>
                ))}
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
                  onClick={onCreateEvent}
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
  );
}
