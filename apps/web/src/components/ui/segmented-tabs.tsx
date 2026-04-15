import type { ElementType, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: ElementType<{ size?: number; className?: string }> | ReactElement;
  badge?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  containerClassName?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  inactiveItemClassName?: string;
  iconClassName?: string;
  activeIconClassName?: string;
  badgeClassName?: string;
  activeBadgeClassName?: string;
  inactiveBadgeClassName?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  containerClassName,
  itemClassName,
  activeItemClassName,
  inactiveItemClassName,
  iconClassName,
  activeIconClassName,
  badgeClassName,
  activeBadgeClassName,
  inactiveBadgeClassName,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800",
        containerClassName,
      )}
    >
      {items.map((item) => {
        const isActive = value === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300",
              isActive && activeItemClassName,
              !isActive && inactiveItemClassName,
              itemClassName,
            )}
          >
            {Icon &&
              (isValidElement(Icon) ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 text-current",
                    iconClassName,
                    isActive && activeIconClassName,
                  )}
                  aria-hidden
                >
                  {Icon}
                </span>
              ) : (
                <Icon
                  size={13}
                  className={cn(
                    "text-current",
                    iconClassName,
                    isActive && activeIconClassName,
                  )}
                  aria-hidden
                />
              ))}
            <span className="truncate">{item.label}</span>
            {item.badge != null && (
              <span
                className={cn(
                  "shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums leading-none",
                  isActive
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400",
                  badgeClassName,
                  isActive && activeBadgeClassName,
                  !isActive && inactiveBadgeClassName,
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
