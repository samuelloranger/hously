import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconSize?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <Icon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-4 mx-auto" />
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}
