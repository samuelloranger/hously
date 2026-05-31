import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SettingsPageHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  title: ReactNode;
}

export function SettingsPageHeader({
  actions,
  description,
  icon: Icon,
  title,
}: SettingsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon className="h-5 w-5 shrink-0 text-primary-400" />
          )}
          <h2 className="break-words text-xl font-semibold tracking-tight text-neutral-100">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mt-1 max-w-2xl break-words text-sm text-neutral-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
