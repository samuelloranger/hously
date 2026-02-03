import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  addMonths,
  subMonths,
  format,
} from "date-fns";

export interface CalendarRange {
  from?: Date;
  to?: Date;
}

interface CalendarProps {
  selected?: Date;
  range?: CalendarRange;
  onSelect?: (date: Date | undefined) => void;
  onRangeSelect?: (range: CalendarRange) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  mode?: "single" | "range";
}

export function Calendar({
  selected,
  range,
  onSelect,
  onRangeSelect,
  disabled,
  className,
  mode = "single",
}: CalendarProps) {
  const { t } = useTranslation("common");
  const [currentMonth, setCurrentMonth] = useState<Date>(
    selected || range?.from || new Date()
  );
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);

  // Week day labels
  const weekDays = [
    t("calendar.sunday"),
    t("calendar.monday"),
    t("calendar.tuesday"),
    t("calendar.wednesday"),
    t("calendar.thursday"),
    t("calendar.friday"),
    t("calendar.saturday"),
  ];

  // Get calendar days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Normalize date to start of day
  const normalizeDate = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Calculate hover preview range
  const getHoverRange = (): { from: Date; to: Date } | undefined => {
    if (mode === "range" && range?.from && hoveredDate && !range.to) {
      const from = normalizeDate(range.from);
      const to = normalizeDate(hoveredDate);

      if (isAfter(from, to)) {
        return { from: to, to: from };
      }
      return { from, to };
    }
    return undefined;
  };

  const hoverRange = getHoverRange();

  // Check if date is in range
  const isInRange = (date: Date, from?: Date, to?: Date): boolean => {
    if (!from || !to) return false;
    const dateNorm = normalizeDate(date);
    const fromNorm = normalizeDate(from);
    const toNorm = normalizeDate(to);

    return isAfter(dateNorm, fromNorm) && isBefore(dateNorm, toNorm);
  };

  // Check if date is range start
  const isRangeStart = (date: Date, from?: Date): boolean => {
    if (!from) return false;
    return isSameDay(normalizeDate(date), normalizeDate(from));
  };

  // Check if date is range end
  const isRangeEnd = (date: Date, to?: Date): boolean => {
    if (!to) return false;
    return isSameDay(normalizeDate(date), normalizeDate(to));
  };

  const handleDateClick = (date: Date) => {
    if (disabled?.(date)) return;

    if (mode === "range" && onRangeSelect) {
      // If range is complete, reset and start new selection
      if (range?.from && range?.to) {
        onRangeSelect({ from: date, to: undefined });
        return;
      }

      // If no start date, set start
      if (!range?.from) {
        onRangeSelect({ from: date, to: undefined });
        return;
      }

      // If start exists but no end, set end
      if (range.from && !range.to) {
        const from = normalizeDate(range.from);
        const to = normalizeDate(date);

        if (isAfter(from, to)) {
          onRangeSelect({ from: to, to: from });
        } else {
          onRangeSelect({ from, to });
        }
        return;
      }
    } else if (onSelect) {
      onSelect(date);
    }
  };

  const handleDateHover = (date: Date) => {
    if (mode === "range" && range?.from && !range?.to) {
      setHoveredDate(date);
    }
  };

  const handleDateLeave = () => {
    setHoveredDate(undefined);
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 dark:border-neutral-800 p-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={previousMonth}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 opacity-50 hover:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 opacity-50 hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="flex mb-2">
        {weekDays.map((day, index) => (
          <div
            key={index}
            className="flex-1 text-center text-xs font-normal text-neutral-500 dark:text-neutral-400"
          >
            {day.slice(0, 2)}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0 gap-y-1">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected =
            mode === "single" && selected && isSameDay(day, selected);
          const isRangeStartDate =
            mode === "range" &&
            (isRangeStart(day, range?.from) ||
              (hoverRange && isRangeStart(day, hoverRange.from)));
          const isRangeEndDate =
            mode === "range" &&
            (isRangeEnd(day, range?.to) ||
              (hoverRange && isRangeEnd(day, hoverRange.to)));
          const isInSelectedRange =
            mode === "range" &&
            range?.from &&
            range?.to &&
            isInRange(day, range.from, range.to);
          const isInHoverRange =
            mode === "range" &&
            hoverRange &&
            isInRange(day, hoverRange.from, hoverRange.to) &&
            !isInSelectedRange;
          const isDisabled = disabled?.(day) || false;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDateClick(day)}
              onMouseEnter={() => handleDateHover(day)}
              onMouseLeave={handleDateLeave}
              disabled={isDisabled}
              className={cn(
                "h-9 w-full aspect-square p-0 font-normal rounded-md transition-colors",
                !isCurrentMonth &&
                  "text-neutral-400 dark:text-neutral-600 opacity-50",
                isToday && "font-semibold",
                isDisabled &&
                  "text-neutral-400 dark:text-neutral-600 opacity-50 cursor-not-allowed",
                // Single mode selected
                isSelected && "bg-primary-600 text-white hover:bg-primary-700",
                // Range mode - selected range
                isInSelectedRange && "bg-blue-600 !rounded-none text-white",
                isRangeStartDate &&
                  !isRangeEndDate &&
                  "!rounded-l-md rounded-r-none bg-primary-600 text-white",
                isRangeEndDate &&
                  !isRangeStartDate &&
                  "!rounded-r-md rounded-l-none bg-primary-600 text-white",
                isRangeStartDate &&
                  isRangeEndDate &&
                  "rounded-md bg-primary-600 text-white",
                // Range mode - hover preview
                isInHoverRange && "bg-blue-100 dark:bg-blue-900",
                hoverRange &&
                  isRangeStart(day, hoverRange.from) &&
                  !isRangeEnd(day, hoverRange.to) &&
                  "rounded-l-md rounded-r-none bg-primary-600 text-white",
                hoverRange &&
                  isRangeEnd(day, hoverRange.to) &&
                  !isRangeStart(day, hoverRange.from) &&
                  "rounded-r-md rounded-l-none bg-primary-600 text-white",
                hoverRange &&
                  isRangeStart(day, hoverRange.from) &&
                  isRangeEnd(day, hoverRange.to) &&
                  "rounded-md bg-primary-600 text-white"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
