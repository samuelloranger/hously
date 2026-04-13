import { useBoardTimeLogs } from "@/features/board/hooks/useBoardTasks";
import { formatMinutes } from "../utils/time";

export function TimeLogHistory({ taskId }: { taskId: number }) {
  const { data } = useBoardTimeLogs(taskId);
  const logs = data?.time_logs ?? [];

  if (logs.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {logs.map((log) => {
        const initials = log.user_name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div key={log.id} className="flex items-start gap-2">
            {log.user_avatar ? (
              <img
                src={log.user_avatar}
                alt={log.user_name}
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                {initials}
              </span>
            )}
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
                  {formatMinutes(log.minutes)}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {log.user_name}
                </span>
              </div>
              {log.note && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {log.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
