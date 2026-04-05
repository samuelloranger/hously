import type { CalendarEvent } from "@hously/shared/types";
import { formatTime, formatDateTime, parseDate, sameDay } from "@hously/shared/utils";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/SafeHtml";
import { ConditionalWrapper } from "@/components/ConditionalWrapper";
import { RecurrenceBadge } from "@/pages/chores/_component/RecurrenceBadge";
import { Link } from "@tanstack/react-router";
import { Clock, Pencil, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  event: CalendarEvent;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  highlighted?: boolean;
};

export const EventCard = ({
  event,
  onEditEvent,
  onDeleteEvent,
  highlighted = false,
}: Props) => {
  const { t, i18n } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getEventAccentColor = (type: CalendarEvent["type"], metadata?: any) => {
    if (type === "custom_event" && metadata?.color) {
      return metadata.color;
    }
    switch (type) {
      case "chore":
        return "#3b82f6";
      case "meal_plan":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getEventBgClass = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "chore":
        return "bg-blue-50/60 dark:bg-blue-950/20";
      case "meal_plan":
        return "bg-amber-50/60 dark:bg-amber-950/20";
      default:
        return "bg-neutral-50/60 dark:bg-neutral-800/40";
    }
  };

  const getEventLink = (event: CalendarEvent) => {
    switch (event.type) {
      case "chore":
        return "/chores";
      default:
        return "/";
    }
  };

  const getEventText = (event: CalendarEvent) => {
    if (event.type === "custom_event") {
      const start = parseDate(event.metadata.start_datetime);
      const end = parseDate(event.metadata.end_datetime);
      if (!start || !end) return "";
      if (sameDay(start, end)) {
        return `${formatTime(start, i18n.language)} - ${formatTime(end.toISOString(), i18n.language)}`;
      }
      return `${formatDateTime(start, i18n.language)} - ${formatDateTime(end, i18n.language)}`;
    }
    if (event.type === "chore" && event.metadata?.reminder_datetime) {
      const reminderDate = parseDate(event.metadata.reminder_datetime);
      if (reminderDate) {
        return formatTime(reminderDate, i18n.language);
      }
    }
    return "";
  };

  const accentColor = getEventAccentColor(event.type, event.metadata);
  const timeText = getEventText(event);

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden transition-all duration-200",
        "hover:shadow-sm",
        event.type === "custom_event"
          ? "bg-neutral-50/60 dark:bg-neutral-800/40"
          : getEventBgClass(event.type),
        highlighted &&
          "ring-2 ring-indigo-500/70 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900",
      )}
    >
      {/* Accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <ConditionalWrapper
            condition={event.type === "custom_event"}
            wrapper={(children) => (
              <div className="flex-1 min-w-0">{children}</div>
            )}
            elseWrapper={(children) => (
              <Link to={getEventLink(event)} className="flex-1 min-w-0">
                {children}
              </Link>
            )}
          >
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h4 className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                  {event.title}
                </h4>
                {event.type === "chore" && (
                  <RecurrenceBadge
                    recurrence_type={event.metadata?.recurrence_type}
                    recurrence_interval_days={
                      event.metadata?.recurrence_interval_days
                    }
                    recurrence_weekday={event.metadata?.recurrence_weekday}
                  />
                )}
                {event.type === "chore" && event.metadata?.assigned_to && (
                  <span className="flex items-center gap-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                    <User className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Time */}
              {timeText && (
                <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{timeText}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <SafeHtml
                  html={event.description}
                  className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 [&_p]:m-0"
                />
              )}
            </div>
          </ConditionalWrapper>

          {/* Actions */}
          {event.type === "custom_event" ? (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
              <button
                onClick={() => onEditEvent(event)}
                className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-600/40 transition-colors"
                title={t("calendar.customEventEdit")}
              >
                <Pencil className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              </button>
              {onDeleteEvent && (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors"
                    title={t("calendar.customEventDelete")}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  </button>
                  <Dialog
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    title={t("calendar.customEventDelete")}
                  >
                    <p className="mb-6 text-neutral-700 dark:text-neutral-300">
                      {t("calendar.customEventDeleteConfirm")}
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          onDeleteEvent(event);
                          setShowDeleteConfirm(false);
                        }}
                      >
                        {t("calendar.customEventDelete")}
                      </Button>
                    </div>
                  </Dialog>
                </>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5">
              {event.type === "chore" ? t("calendar.chores") : event.type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
