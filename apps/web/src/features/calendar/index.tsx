import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  formatDate,
  parseDate,
  sameDay,
  sameMonth,
  useCalendarEvents,
  useDeleteCustomEvent,
  type CalendarEvent,
  type CalendarEventCustomEventMetadata,
} from '@hously/shared';
import { CreateCustomEventForm } from './components/CreateCustomEventForm';
import { sortBy } from 'lodash-es';
import { getDayName, getMonthName, splitMultiDayEvent } from './utils';
import { EventCard } from './components/EventCard';
import { cn } from '@/lib/utils';
import { startOfDay } from 'date-fns';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useSearch } from '@tanstack/react-router';
import { PlusIcon, ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { HouseLoader } from '@/components/HouseLoader';
import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import type { CalendarSearchParams } from '@/router';

function parseCalendarSearchDate(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
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

export function Calendar() {
  const { t, i18n } = useTranslation('common');
  const searchParams = useSearch({ from: '/calendar' }) as CalendarSearchParams;
  const { setParams, resetParams } = useModalSearchParams('/calendar', searchParams);
  
  const today = startOfDay(new Date());
  const initialNotificationDate = useMemo(() => parseCalendarSearchDate(searchParams.date), [searchParams.date]);
  const initialDate = initialNotificationDate ?? today;
  
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
  const [selectedDayEventsContainerRef] = useAutoAnimate();

  const { data: events = [], isLoading, refetch } = useCalendarEvents(currentYear, currentMonth);
  const deleteMutation = useDeleteCustomEvent();
  const notificationDate = initialNotificationDate;
  const targetedEventId = searchParams.eventId;

  const eventToEdit = useMemo(() => {
    if (searchParams.modal !== 'edit' || !targetedEventId) return undefined;
    return events.find(e => e.type === 'custom_event' && e.metadata?.custom_event_id === targetedEventId);
  }, [events, searchParams.modal, targetedEventId]);

  const isCreateEventOpen = searchParams.modal === 'create';

  useEffect(() => {
    if (!notificationDate) return;
    setCurrentMonth(notificationDate.getMonth() + 1);
    setCurrentYear(notificationDate.getFullYear());
    setSelectedDate(notificationDate);
  }, [notificationDate]);

  // Split multi-day events and group by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    // Split multi-day events first
    const splitEvents: CalendarEvent[] = [];
    events.forEach(event => {
      const split = splitMultiDayEvent(event);
      splitEvents.push(...split);
    });

    // Group by date
    splitEvents.forEach(event => {
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
      const date = new Date(prevYear, prevMonth - 1, daysInPrevMonth - startingDayOfWeek + i + 1);
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
    const dateStr = date.toISOString().split('T')[0];
    return eventsByDate[dateStr] || [];
  };

  const isCurrentMonth = (date: Date): boolean => {
    return sameMonth(date, new Date(currentYear, currentMonth - 1, 1));
  };

  const getEventDotColor = (event: CalendarEvent) => {
    if (event.type === 'custom_event' && event.metadata?.color) {
      return event.metadata.color;
    }
    if (event.type === 'chore') return '#3b82f6';
    if (event.type === 'meal_plan') return '#f59e0b';
    return '#6b7280';
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dayEvents = getDayEvents(selectedDate);
    return sortBy(dayEvents, event => {
      if (targetedEventId && event.type === 'custom_event' && event.metadata?.custom_event_id === targetedEventId) {
        return -1;
      }
      if (event.type === 'custom_event') {
        const start = parseDate(event.metadata.start_datetime);
        if (!start) return 24;
        return start.getHours();
      }
      return 24;
    });
  }, [getDayEvents, selectedDate, targetedEventId]);

  // Check if viewing the current month
  const isViewingCurrentMonth = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

  return (
    <PageLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PageHeader icon="📅" iconColor="text-blue-600" title={t('calendar.title')} subtitle={t('calendar.subtitle')} />
        <Button onClick={() => setParams({ modal: 'create' })} className="rounded-xl">
          <PlusIcon className="w-4 h-4 mr-2" />
          {t('calendar.addEvent')}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Calendar Grid Card */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
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
                    {t('calendar.today') || 'Today'}
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
            <div className="grid grid-cols-7 border-b border-neutral-100 dark:border-neutral-700/50">
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
                const isCurrentMonthDay = isCurrentMonth(date);
                const isTodayDay = sameDay(date, today);
                const isSelectedDate = sameDay(date, selectedDate);
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(date)}
                    className={cn(
                      'relative aspect-square p-1 sm:p-2 flex flex-col items-center transition-all duration-150 border-b border-r border-neutral-50 dark:border-neutral-800/80',
                      !isCurrentMonthDay && 'opacity-30',
                      isCurrentMonthDay && 'hover:bg-primary-50/50 dark:hover:bg-primary-900/10',
                      isSelectedDate && 'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    {/* Day number */}
                    <span
                      className={cn(
                        'relative z-10 text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200',
                        isTodayDay && 'bg-primary-600 text-white font-semibold shadow-sm shadow-primary-600/30',
                        isSelectedDate &&
                          !isTodayDay &&
                          'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold',
                        !isTodayDay && !isSelectedDate && isCurrentMonthDay && 'text-neutral-700 dark:text-neutral-300',
                        !isCurrentMonthDay && 'text-neutral-400 dark:text-neutral-600'
                      )}
                    >
                      {date?.getDate()}
                    </span>

                    {/* Event indicators */}
                    {hasEvents && (
                      <div className="flex items-center gap-0.5 mt-auto pb-0.5">
                        {dayEvents.slice(0, 4).map(event => (
                          <div
                            key={event.id}
                            className="w-1.5 h-1.5 rounded-full transition-transform duration-200"
                            style={{ backgroundColor: getEventDotColor(event) }}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="text-[9px] font-medium text-neutral-400 ml-0.5">
                            +{dayEvents.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-700/50 flex flex-wrap gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{t('calendar.chores')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{t('calendar.mealPlans') || 'Meal Plans'}</span>
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
                    {selectedDayEvents.length}{' '}
                    {selectedDayEvents.length === 1 ? t('calendar.event') || 'event' : t('calendar.events') || 'events'}
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
                    {selectedDayEvents.map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        highlighted={Boolean(
                          targetedEventId &&
                            event.type === 'custom_event' &&
                            event.metadata?.custom_event_id === targetedEventId
                        )}
                        onEditEvent={() => {
                          if (event.type === 'custom_event' && event.metadata?.custom_event_id) {
                            setParams({ modal: 'edit', eventId: event.metadata.custom_event_id });
                          }
                        }}
                        onDeleteEvent={eventToDelete => {
                          if (eventToDelete.type === 'custom_event' && eventToDelete.metadata?.custom_event_id) {
                            deleteMutation.mutate(eventToDelete.metadata.custom_event_id, {
                              onSuccess: () => {
                                toast.success(t('calendar.customEventDeleted'));
                                setSelectedDate(null);
                              },
                              onError: (error: any) => {
                                toast.error(
                                  error?.message || t('calendar.customEventDeleteError') || t('common.error')
                                );
                              },
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center text-center">
                    <CalendarDays className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mb-3" />
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">
                      {t('calendar.noEvents') || 'No events for this day'}
                    </p>
                    <button
                      onClick={() => setParams({ modal: 'create' })}
                      className="mt-3 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                      + {t('calendar.addEvent')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-8 flex flex-col items-center text-center">
              <CalendarDays className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mb-3" />
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('calendar.selectDay') || 'Select a day to view events'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Custom Event Dialog */}
      <CreateCustomEventForm
        isOpen={isCreateEventOpen}
        onClose={() => {
          resetParams(['modal']);
          refetch();
        }}
      />

      {/* Edit Custom Event Dialog */}
      {eventToEdit && (
        <CreateCustomEventForm
          isOpen={searchParams.modal === 'edit'}
          onClose={() => {
            resetParams(['modal', 'eventId']);
            refetch();
          }}
          eventToEdit={eventToEdit as CalendarEvent & CalendarEventCustomEventMetadata}
        />
      )}
    </PageLayout>
  );
}
