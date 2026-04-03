import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  actions?: ReactNode;
}

function iconBg(iconColor: string) {
  if (iconColor === "text-green-600")
    return "bg-emerald-100 dark:bg-emerald-900/30";
  if (iconColor === "text-blue-600") return "bg-blue-100 dark:bg-blue-900/30";
  if (iconColor === "text-orange-600")
    return "bg-orange-100 dark:bg-orange-900/30";
  return "bg-neutral-100 dark:bg-neutral-800";
}

export function PageHeader({
  icon,
  iconColor = "text-neutral-600",
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  className = "",
  actions,
}: PageHeaderProps) {
  const { t } = useTranslation("common");
  return (
    <div className={cn("mb-6", className)}>
      {/* Mobile layout: compact stacked */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("common.refetch")}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </button>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Desktop layout: icon + title | actions */}
      <div className="hidden sm:flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl text-lg",
              iconBg(iconColor),
            )}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("common.refetch")}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
