import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Basic skeleton loader component for loading states
 * Shows an animated shimmer effect
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700",
        className
      )}
    />
  );
}

/**
 * Skeleton for card-like components
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for list items
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-neutral-200 dark:border-neutral-700">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-6" />
    </div>
  );
}

/**
 * Skeleton for table rows
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for stat cards (used in dashboard)
 */
export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/**
 * Dashboard skeleton with stat cards and list
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Recent activities */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-2">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      </div>
    </div>
  );
}
