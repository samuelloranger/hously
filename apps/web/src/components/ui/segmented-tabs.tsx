import type { ElementType, ReactElement, ReactNode } from "react";
import { isValidElement, useEffect, useRef } from "react";
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
  /** Classes applied to the outer scroll container. */
  containerClassName?: string;
  /** Classes applied to the inner track (the pill background). */
  trackClassName?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  inactiveItemClassName?: string;
  iconClassName?: string;
  activeIconClassName?: string;
  badgeClassName?: string;
  activeBadgeClassName?: string;
  inactiveBadgeClassName?: string;
  /** Optional accessible label for the tablist. */
  ariaLabel?: string;
}

/**
 * SegmentedTabs
 * - Always fills 100% of its parent's width.
 * - Items share space evenly when they fit.
 * - When the combined natural width of items exceeds the container, the row
 *   scrolls horizontally (scrollbar hidden). Active item is scrolled into
 *   view when the selection changes.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  containerClassName,
  trackClassName,
  itemClassName,
  activeItemClassName,
  inactiveItemClassName,
  iconClassName,
  activeIconClassName,
  badgeClassName,
  activeBadgeClassName,
  inactiveBadgeClassName,
  ariaLabel,
}: SegmentedTabsProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const active = activeItemRef.current;
    if (!viewport || !active) return;
    // Only scroll when the row actually overflows.
    if (viewport.scrollWidth <= viewport.clientWidth) return;

    const viewportRect = viewport.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const offsetLeft =
      activeRect.left - viewportRect.left + viewport.scrollLeft;
    const target = offsetLeft - (viewport.clientWidth - active.offsetWidth) / 2;

    viewport.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [value]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        // Full-width scroll viewport; hide native scrollbars across browsers
        "w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        containerClassName,
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          // Track fills the viewport minimum; grows with content when crowded
          "flex w-full min-w-max gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800",
          trackClassName,
        )}
      >
        {items.map((item) => {
          const isActive = value === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              onClick={() => onChange(item.id)}
              ref={isActive ? activeItemRef : undefined}
              className={cn(
                // flex-1 distributes free space; min-w-max prevents shrinking
                // below content width (pushing overflow onto the viewport).
                "flex flex-1 min-w-max items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-6 py-1.5 text-sm font-medium transition-all duration-150",
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
                      "shrink-0 text-current",
                      iconClassName,
                      isActive && activeIconClassName,
                    )}
                    aria-hidden
                  />
                ))}
              <span>{item.label}</span>
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
    </div>
  );
}
