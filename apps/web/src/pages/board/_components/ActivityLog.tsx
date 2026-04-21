import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBoardTaskActivity } from "@/pages/board/_hooks/useBoardTasks";
import { cn } from "@/lib/utils";
import type { BoardTaskActivity } from "@hously/shared/types";
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityMessage(activity: BoardTaskActivity): string {
  switch (activity.type) {
    case "created":
      return "Created this task";
    case "comment":
      return activity.body ?? "";
    case "status_change":
      return `Changed status from ${activity.metadata?.from ?? "?"} to ${activity.metadata?.to ?? "?"}`;
    case "priority_change":
      return `Changed priority from ${activity.metadata?.from ?? "?"} to ${activity.metadata?.to ?? "?"}`;
    case "assignee_change":
      return activity.metadata?.to
        ? `Assigned to ${activity.metadata.to}`
        : "Unassigned";
    case "archived":
      return "Archived this task";
    case "unarchived":
      return "Restored this task";
    default:
      return "";
  }
}

export function ActivityLog({ taskId }: { taskId: number }) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useBoardTaskActivity(taskId);
  const activities = data?.activities ?? [];

  if (isLoading)
    return <p className="text-xs text-neutral-400">{t("common.loading")}</p>;
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <MessageSquare className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {t("board.noActivity")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((a) => {
        const initials = a.user_name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div key={a.id} className="flex gap-3">
            {a.user_avatar ? (
              <img
                src={a.user_avatar}
                alt={a.user_name}
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-medium text-neutral-800 dark:text-neutral-100">
                  {a.user_name}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {relativeTime(a.created_at)}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[12px] text-neutral-600 dark:text-neutral-300",
                  a.type === "comment" && "whitespace-pre-wrap",
                )}
              >
                {activityMessage(a)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
