import type { MigrateJobProgress } from "@hously/shared/types";

interface ArrMigrationProgressProps {
  progress: MigrateJobProgress;
  source: "both" | "radarr" | "sonarr";
}

export function ArrMigrationProgress({
  progress,
  source,
}: ArrMigrationProgressProps) {
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span className="capitalize font-medium">
            {progress.phase === "done"
              ? "Wrapping up…"
              : `Importing ${progress.phase}…`}
          </span>
          <span>
            {progress.current} / {progress.total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress.current_title && (
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
            {progress.current_title}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {(source === "both" || source === "radarr") && (
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2.5 py-2">
            <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Radarr
            </p>
            <p className="text-neutral-500">
              {progress.radarr.imported} new · {progress.radarr.already_existed}{" "}
              exist · {progress.radarr.files_scanned} scanned
            </p>
            {progress.radarr.errors > 0 && (
              <p className="text-red-500">{progress.radarr.errors} errors</p>
            )}
          </div>
        )}
        {(source === "both" || source === "sonarr") && (
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2.5 py-2">
            <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Sonarr
            </p>
            <p className="text-neutral-500">
              {progress.sonarr.imported_shows} shows ·{" "}
              {progress.sonarr.imported_files} files ·{" "}
              {progress.sonarr.files_scanned} scanned
            </p>
            {progress.sonarr.errors > 0 && (
              <p className="text-red-500">{progress.sonarr.errors} errors</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
