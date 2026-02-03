interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  iconSize?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  iconSize = "text-6xl",
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <span
        className={`${iconSize} text-neutral-300 dark:text-neutral-600 mb-4 block`}
      >
        {icon}
      </span>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}
