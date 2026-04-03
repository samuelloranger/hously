import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
  hours: number;
  minutes: number;
  onHoursChange: (hours: number) => void;
  onMinutesChange: (minutes: number) => void;
  className?: string;
}

export function TimePicker({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  className,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  // Minutes avec intervalles de 15 minutes pour plus de praticité
  const minutesList = Array.from({ length: 60 }, (_, i) => i).filter(
    (m) => m % 15 === 0,
  );

  const displayValue = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  // Scroll vers la valeur sélectionnée quand le popover s'ouvre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hoursRef.current) {
          const selectedHourButton = hoursRef.current.querySelector(
            `[data-hour="${hours}"]`,
          ) as HTMLElement;
          if (selectedHourButton) {
            selectedHourButton.scrollIntoView({ block: "center" });
          }
        }
        if (minutesRef.current) {
          const selectedMinuteButton = minutesRef.current.querySelector(
            `[data-minute="${minutes}"]`,
          ) as HTMLElement;
          if (selectedMinuteButton) {
            selectedMinuteButton.scrollIntoView({ block: "center" });
          }
        }
      }, 100);
    }
  }, [isOpen, hours, minutes]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[140px] justify-start text-left font-normal",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex p-2">
          {/* Hours */}
          <div className="flex flex-col items-center border-r border-neutral-200 dark:border-neutral-700 pr-2">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 px-2">
              Hours
            </div>
            <div
              ref={hoursRef}
              className="max-h-[200px] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {hoursList.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  data-hour={hour}
                  onClick={() => {
                    onHoursChange(hour);
                  }}
                  className={cn(
                    "w-12 h-8 rounded-md text-sm transition-colors flex items-center justify-center",
                    hours === hour
                      ? "bg-primary-600 text-white"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-50",
                  )}
                >
                  {String(hour).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          {/* Minutes */}
          <div className="flex flex-col items-center pl-2">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 px-2">
              Minutes
            </div>
            <div
              ref={minutesRef}
              className="max-h-[200px] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {minutesList.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  data-minute={minute}
                  onClick={() => {
                    onMinutesChange(minute);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-12 h-8 rounded-md text-sm transition-colors flex items-center justify-center",
                    minutes === minute
                      ? "bg-primary-600 text-white"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-50",
                  )}
                >
                  {String(minute).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
