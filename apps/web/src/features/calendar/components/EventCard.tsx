import { formatTime, formatDateTime, parseDate, sameDay, type CalendarEvent } from '@hously/shared';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Dialog } from '@/components/dialog';
import { Button } from '@/components/ui/button';
import { SafeHtml } from '@/components/SafeHtml';
import { ConditionalWrapper } from '@/components/ConditionalWrapper';
import { RecurrenceBadge } from '@/features/chores/components/RecurrenceBadge';
import { Link } from '@tanstack/react-router';

type Props = {
  event: CalendarEvent;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
};

export const EventCard = ({ event, onEditEvent, onDeleteEvent }: Props) => {
  const { t, i18n } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const getEventTypeColor = (type: CalendarEvent['type'], metadata?: any) => {
    if (type === 'custom_event' && metadata?.color) {
      return `bg-[${metadata.color}] text-white`;
    }
    switch (type) {
      case 'chore':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200';
    }
  };

  const getEventLink = (event: CalendarEvent) => {
    switch (event.type) {
      case 'chore':
        return '/chores';
      default:
        return '/';
    }
  };

  const getEventText = (event: CalendarEvent) => {
    if (event.type === 'custom_event') {
      const start = parseDate(event.metadata.start_datetime);
      const end = parseDate(event.metadata.end_datetime);
      if (!start || !end) return '';
      if (sameDay(start, end)) {
        return `${formatTime(start, i18n.language)} - ${formatTime(end.toISOString(), i18n.language)}`;
      }
      return `${formatDateTime(start, i18n.language)} - ${formatDateTime(end, i18n.language)}`;
    }
    if (event.type === 'chore' && event.metadata?.reminder_datetime) {
      const reminderDate = parseDate(event.metadata.reminder_datetime);
      if (reminderDate) {
        return formatTime(reminderDate, i18n.language);
      }
    }
    return '';
  };

  return (
    <div
      key={event.id}
      className={`block p-4 rounded-lg border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors ${
        event.type === 'custom_event' ? '' : getEventTypeColor(event.type)
      }`}
      style={
        event.type === 'custom_event' && event.metadata?.color
          ? {
              borderColor: event.metadata.color,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <ConditionalWrapper
          condition={event.type === 'custom_event'}
          wrapper={children => <div className="flex-1 text-left">{children}</div>}
          elseWrapper={children => (
            <Link to={getEventLink(event)} className="flex-1">
              {children}
            </Link>
          )}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold text-sm">{event.title}</h4>
              {event.type === 'chore' && (
                <RecurrenceBadge
                  recurrence_type={event.metadata?.recurrence_type}
                  recurrence_interval_days={event.metadata?.recurrence_interval_days}
                  recurrence_weekday={event.metadata?.recurrence_weekday}
                />
              )}
              {event.type === 'chore' && event.metadata?.assigned_to && <span className="text-xs opacity-75">👤</span>}
            </div>
            {getEventText(event) && <div className="text-xs opacity-75 mb-1">⏰ {getEventText(event)}</div>}
            {event.description && <SafeHtml html={event.description} className="text-xs opacity-90 mt-1" />}
          </div>
        </ConditionalWrapper>
        {event.type === 'custom_event' ? (
          <div className="flex flex-col items-center gap-2 ml-2">
            <>
              <span
                className="capitalize text-xs font-medium opacity-75 cursor-pointer hover:opacity-100"
                onClick={() => {
                  onEditEvent(event);
                }}
              >
                {t('calendar.customEventEdit')}
              </span>
              {onDeleteEvent && (
                <>
                  <span
                    className="text-xs font-medium opacity-75 cursor-pointer hover:opacity-100 text-red-600 dark:text-red-400"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t('calendar.customEventDelete')}
                  </span>
                  <Dialog
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    title={t('calendar.customEventDelete')}
                  >
                    <p className="mb-6 text-neutral-700 dark:text-neutral-300">
                      {t('calendar.customEventDeleteConfirm')}
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          onDeleteEvent(event);
                          setShowDeleteConfirm(false);
                        }}
                      >
                        {t('calendar.customEventDelete')}
                      </Button>
                    </div>
                  </Dialog>
                </>
              )}
            </>
          </div>
        ) : (
          <span className="capitalize text-xs font-medium opacity-75 ml-2">{event.type}</span>
        )}
      </div>
    </div>
  );
};
