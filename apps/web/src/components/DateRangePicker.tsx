import { format, startOfDay, isSameDay, isAfter } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, type CalendarRange } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { toDateTimeLocal, parseDate } from '@hously/shared';
import { useState } from 'react';

interface DateRangePickerProps {
  startValue?: string; // ISO datetime string
  endValue?: string; // ISO datetime string
  onChange: (start: string, end: string) => void;
  allDay?: boolean;
  minDate?: Date;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  startValue,
  endValue,
  onChange,
  allDay = false,
  minDate,
  placeholder,
  className = '',
}: DateRangePickerProps) {
  const [dateRange, setDateRange] = useState<CalendarRange>(() => {
    const start = startValue ? parseDate(startValue) : undefined;
    const end = endValue ? parseDate(endValue) : undefined;
    return {
      from: start || undefined,
      to: end || undefined,
    };
  });

  const [startTime, setStartTime] = useState({
    hours: startValue ? new Date(startValue).getHours() : new Date().getHours(),
    minutes: startValue ? new Date(startValue).getMinutes() : 0,
  });

  const [endTime, setEndTime] = useState({
    hours: endValue ? new Date(endValue).getHours() : new Date().getHours() + 1,
    minutes: endValue ? new Date(endValue).getMinutes() : 0,
  });

  const [isOpen, setIsOpen] = useState(false);

  const minDateTime = minDate || new Date();

  const updateDateTimeRange = (
    newStartDate?: Date,
    newEndDate?: Date,
    newStartTime?: { hours: number; minutes: number },
    newEndTime?: { hours: number; minutes: number }
  ) => {
    const startDate = newStartDate || dateRange.from;
    const endDate = newEndDate || dateRange.to;
    const startT = newStartTime || startTime;
    const endT = newEndTime || endTime;

    if (!startDate) {
      return;
    }

    // Create start datetime
    const startDateTime = new Date(startDate);
    if (!allDay) {
      startDateTime.setHours(startT.hours, startT.minutes, 0, 0);
    } else {
      startDateTime.setHours(0, 0, 0, 0);
    }

    // Create end datetime
    let endDateTime: Date;
    if (endDate) {
      endDateTime = new Date(endDate);
      if (!allDay) {
        endDateTime.setHours(endT.hours, endT.minutes, 0, 0);
      } else {
        endDateTime.setHours(23, 59, 59, 999);
      }
    } else {
      // If no end date, use start date + 1 hour (or end of day for all-day)
      endDateTime = new Date(startDateTime);
      if (!allDay) {
        endDateTime.setHours(startT.hours + 1, startT.minutes, 0, 0);
      } else {
        endDateTime.setHours(23, 59, 59, 999);
      }
    }

    // Validate: end must be after start
    if (endDateTime <= startDateTime) {
      // Adjust end to be after start
      if (!allDay) {
        endDateTime = new Date(startDateTime);
        endDateTime.setHours(startT.hours + 1, startT.minutes, 0, 0);
      } else {
        endDateTime = new Date(startDateTime);
        endDateTime.setHours(23, 59, 59, 999);
      }
    }

    // Check if start is before minDate
    if (minDateTime && startDateTime < minDateTime) {
      const minDateWithTime = new Date(minDateTime);
      if (!allDay) {
        minDateWithTime.setHours(startT.hours, startT.minutes, 0, 0);
      } else {
        minDateWithTime.setHours(0, 0, 0, 0);
      }
      onChange(toDateTimeLocal(minDateWithTime), toDateTimeLocal(endDateTime));
      return;
    }

    onChange(toDateTimeLocal(startDateTime), toDateTimeLocal(endDateTime));
  };

  const handleRangeSelect = (range: CalendarRange) => {
    // Normalize range: ensure from <= to
    let normalizedRange = { ...range };
    if (normalizedRange.from && normalizedRange.to) {
      if (isAfter(normalizedRange.from, normalizedRange.to)) {
        // Swap if from is after to
        normalizedRange = {
          from: normalizedRange.to,
          to: normalizedRange.from,
        };
      }
    }
    setDateRange(normalizedRange);
    updateDateTimeRange(normalizedRange.from, normalizedRange.to);
  };

  const handleStartHoursChange = (hours: number) => {
    const newStartTime = { ...startTime, hours };
    setStartTime(newStartTime);
    updateDateTimeRange(undefined, undefined, newStartTime);
  };

  const handleStartMinutesChange = (minutes: number) => {
    const newStartTime = { ...startTime, minutes };
    setStartTime(newStartTime);
    updateDateTimeRange(undefined, undefined, newStartTime);
  };

  const handleEndHoursChange = (hours: number) => {
    const newEndTime = { ...endTime, hours };
    setEndTime(newEndTime);
    updateDateTimeRange(undefined, undefined, undefined, newEndTime);
  };

  const handleEndMinutesChange = (minutes: number) => {
    const newEndTime = { ...endTime, minutes };
    setEndTime(newEndTime);
    updateDateTimeRange(undefined, undefined, undefined, newEndTime);
  };

  const displayValue = () => {
    if (!dateRange.from) {
      return placeholder || 'Select date range';
    }

    const startDate = dateRange.from;
    const endDate = dateRange.to || dateRange.from;

    const startStr = format(startDate, 'dd/MM/yyyy');
    const endStr = format(endDate, 'dd/MM/yyyy');

    if (allDay) {
      if (isSameDay(startDate, endDate)) {
        return startStr;
      }
      return `${startStr} - ${endStr}`;
    }

    const startTimeStr = `${String(startTime.hours).padStart(2, '0')}:${String(startTime.minutes).padStart(2, '0')}`;
    const endTimeStr = `${String(endTime.hours).padStart(2, '0')}:${String(endTime.minutes).padStart(2, '0')}`;

    if (isSameDay(startDate, endDate)) {
      return `${startStr} ${startTimeStr} - ${endTimeStr}`;
    }
    return `${startStr} ${startTimeStr} - ${endStr} ${endTimeStr}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !dateRange.from && 'text-neutral-500 dark:text-neutral-400',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-white dark:bg-neutral-700 w-auto p-0" align="start" side="top">
        <div className="p-3">
          <Calendar
            range={dateRange}
            onRangeSelect={handleRangeSelect}
            mode="range"
            disabled={date => {
              if (!minDateTime) return false;
              return startOfDay(date) < startOfDay(minDateTime);
            }}
          />
          {!allDay && dateRange.from && (
            <div className="w-full border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    Start Time
                  </label>
                  <div className="flex items-center justify-center">
                    <TimePicker
                      hours={startTime.hours}
                      minutes={startTime.minutes}
                      onHoursChange={handleStartHoursChange}
                      onMinutesChange={handleStartMinutesChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    End Time
                  </label>
                  <div className="flex items-center justify-center">
                    <TimePicker
                      hours={endTime.hours}
                      minutes={endTime.minutes}
                      onHoursChange={handleEndHoursChange}
                      onMinutesChange={handleEndMinutesChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => setIsOpen(false)}>
            Ok
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
