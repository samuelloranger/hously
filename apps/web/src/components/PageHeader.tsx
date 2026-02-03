import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
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
    <div className={cn("mb-8", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col w-full">
          <div className="flex flex-row items-center justify-between w-full gap-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              <span className={cn("mr-3", iconColor)}>{icon}</span>
              {title}
            </h1>
            <div className="flex items-center gap-2">
              {actions}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t("common.refetch")}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  />
                </button>
              )}
            </div>
          </div>
          {subtitle && (
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
