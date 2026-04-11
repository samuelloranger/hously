import { cn } from "@/lib/utils";
import type { NotificationType } from "@hously/shared/types";
const typeConfig: Record<
  NotificationType,
  { icon: string | React.ReactNode; bg: string }
> = {
  reminder: { icon: "⏰", bg: "bg-amber-100 dark:bg-amber-900/30" },
  external: { icon: "📡", bg: "bg-blue-100 dark:bg-blue-900/30" },
  "app-update": { icon: "✨", bg: "bg-violet-100 dark:bg-violet-900/30" },
  service_monitor: { icon: "🖥️", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  chore: { icon: "✅", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  shopping: { icon: "🛒", bg: "bg-sky-100 dark:bg-sky-900/30" },
  event: { icon: "📅", bg: "bg-rose-100 dark:bg-rose-900/30" },
  system: { icon: "⚙️", bg: "bg-neutral-100 dark:bg-neutral-700/60" },
  habit: { icon: "🎯", bg: "bg-orange-100 dark:bg-orange-900/30" },
};

export function getTypeStyle(notification: {
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
}) {
  if (notification.type === "external" && notification.metadata?.service_name) {
    const serviceName = notification.metadata.service_name as string;
    if (serviceName === "cross-seed") {
      return {
        icon: "🌱",
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
      };
    }
    if (serviceName === "jellyfin") {
      return {
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png"
            className="w-[18px] h-[18px] object-contain"
            alt="Jellyfin"
          />
        ),
        bg: "bg-violet-100 dark:bg-violet-900/30",
      };
    }
    if (serviceName === "kopia") {
      return {
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/kopia.png"
            className="w-[18px] h-[18px] object-contain"
            alt="Kopia"
          />
        ),
        bg: "bg-green-100 dark:bg-green-900/30",
      };
    }
  }
  return typeConfig[notification.type] || typeConfig.system;
}

interface NotificationMenuRowProps {
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  isUnread?: boolean;
  relativeTime?: string;
  onClick?: () => void;
}

export function NotificationMenuRow({
  type,
  title,
  body,
  metadata,
  isUnread = true,
  relativeTime,
  onClick,
}: NotificationMenuRowProps) {
  const style = getTypeStyle({ type, metadata });

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 w-full text-left px-4 py-3 transition-colors",
        isUnread
          ? "bg-primary-50/50 dark:bg-primary-500/10 hover:bg-primary-100/50 dark:hover:bg-primary-500/20"
          : "hover:bg-neutral-50 dark:hover:bg-white/[0.05]",
      )}
    >
      {isUnread && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary-500" />
      )}

      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
          style.bg,
        )}
      >
        {style.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] leading-snug",
            isUnread
              ? "font-semibold text-neutral-900 dark:text-white"
              : "font-medium text-neutral-700 dark:text-neutral-300",
          )}
        >
          {title}
        </p>
        {body && (
          <p
            className={cn(
              "text-xs mt-0.5 line-clamp-2 leading-relaxed",
              isUnread
                ? "text-neutral-600 dark:text-neutral-300"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {body}
          </p>
        )}
        {relativeTime && (
          <p
            className={cn(
              "text-[11px] mt-1",
              isUnread
                ? "text-neutral-500 dark:text-neutral-400"
                : "text-neutral-400 dark:text-neutral-500",
            )}
          >
            {relativeTime}
          </p>
        )}
      </div>

      {isUnread && (
        <div className="shrink-0 mt-1.5">
          <div className="h-2 w-2 rounded-full bg-primary-500" />
        </div>
      )}
    </button>
  );
}
