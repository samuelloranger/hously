import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Basic skeleton loader component for loading states
 * Shows an animated shimmer effect
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700', className)} />;
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

