import { format, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { TimePicker } from './ui/time-picker';
import { toDateTimeLocal } from '@hously/shared';
import { useEffect, useState } from 'react';

interface DateTimePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  minDate?: Date;
  placeholder?: string;
  className?: string;
  allDay?: boolean;
}

export function DateTimePicker({
  id,
  value,
  onChange,
  minDate,
  placeholder,
  className = '',
  allDay,
}: DateTimePickerProps) {
  const [date, setDate] = useState<Date | undefined>(value ? new Date(value) : undefined);
  const [time, setTime] = useState({
    hours: value ? new Date(value).getHours() : new Date().getHours(),
    minutes: value ? new Date(value).getMinutes() : 0,
  });
  const [isOpen, setIsOpen] = useState(false);

  const minDateTime = minDate || new Date();

  useEffect(() => {
    if (value) {
      const dateValue = new Date(value);
      setDate(dateValue);
      setTime({
        hours: dateValue.getHours(),
        minutes: dateValue.getMinutes(),
      });
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      onChange('');
      return;
    }

    setDate(selectedDate);
    updateDateTime(selectedDate, time.hours, time.minutes);
  };

  const updateDateTime = (newDate: Date, hours: number, minutes: number) => {
    const combinedDate = new Date(newDate);
    combinedDate.setHours(hours);
    combinedDate.setMinutes(minutes);
    combinedDate.setSeconds(0);
    combinedDate.setMilliseconds(0);

    // Check if combined datetime is before minDate
    if (minDateTime && combinedDate < minDateTime) {
      // If it's before minDate, set to minDate
      const minDateWithTime = new Date(minDateTime);
      minDateWithTime.setHours(hours);
      minDateWithTime.setMinutes(minutes);
      onChange(toDateTimeLocal(minDateWithTime));
      setDate(minDateWithTime);
      setTime({
        hours: minDateWithTime.getHours(),
        minutes: minDateWithTime.getMinutes(),
      });
      return;
    }

    onChange(toDateTimeLocal(combinedDate));
    setDate(combinedDate);
  };

  const handleHoursChange = (hours: number) => {
    if (!date) {
      // If no date selected, use today or minDate (whichever is later)
      const defaultDate = minDateTime > new Date() ? minDateTime : new Date();
      setDate(defaultDate);
      updateDateTime(defaultDate, hours, time.minutes);
    } else {
      updateDateTime(date, hours, time.minutes);
    }
  };

  const handleMinutesChange = (minutes: number) => {
    if (!date) {
      // If no date selected, use today or minDate (whichever is later)
      const defaultDate = minDateTime > new Date() ? minDateTime : new Date();
      setDate(defaultDate);
      updateDateTime(defaultDate, time.hours, minutes);
    } else {
      updateDateTime(date, time.hours, minutes);
    }
  };

  const displayValue = date
    ? `${format(date, 'dd/MM/yyyy')}${
        allDay ? '' : ` ${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
      }`
    : placeholder || 'Select date and time';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-neutral-500 dark:text-neutral-400',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-white dark:bg-neutral-700 w-auto p-0" align="start" side="top">
        <div className="p-3">
          <Calendar
            selected={date}
            onSelect={handleDateSelect}
            disabled={date => {
              if (!minDateTime) return false;
              // Compare dates only (normalize to midnight) to allow selecting today
              return startOfDay(date) < startOfDay(minDateTime);
            }}
          />
          {!allDay && (
            <div className="w-full flex items-center justify-center border-t border-neutral-200 dark:border-neutral-700 pt-4">
              <TimePicker
                hours={time.hours}
                minutes={time.minutes}
                onHoursChange={handleHoursChange}
                onMinutesChange={handleMinutesChange}
              />
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
