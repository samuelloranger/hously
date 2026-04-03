import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TorrentFilterPopoverProps {
  label: string;
  selectedCount: number;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string, checked: boolean) => void;
}

export function TorrentFilterPopover({
  label,
  selectedCount,
  options,
  selectedValues,
  onToggle,
}: TorrentFilterPopoverProps) {
  if (options.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          <span className="text-neutral-500">{label}</span>
          {selectedCount > 0 && (
            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-1.5 rounded text-[10px]">
              {selectedCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={(event) => onToggle(option, event.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-600 focus:ring-sky-500 text-sky-500 bg-transparent h-3.5 w-3.5"
              />
              <span className="text-[12px] text-neutral-700 dark:text-neutral-300 truncate leading-none">
                {option}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
