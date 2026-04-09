import type { MigrateJobResult } from "@hously/shared/types";

interface ArrMigrationResultProps {
  result: MigrateJobResult;
  onRunAgain: () => void;
}

export function ArrMigrationResult({
  result,
  onRunAgain,
}: ArrMigrationResultProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        Import complete
      </p>
      {result.radarr && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-[10px] text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Radarr:{" "}
          </span>
          {result.radarr.imported} imported · {result.radarr.already_existed}{" "}
          existed · {result.radarr.files_scanned} MediaInfo scans
          {result.radarr.errors.length > 0 && (
            <span className="text-red-500">
              {" "}
              · {result.radarr.errors.length} errors
            </span>
          )}
        </div>
      )}
      {result.sonarr && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-[10px] text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Sonarr:{" "}
          </span>
          {result.sonarr.imported_shows} shows ·{" "}
          {result.sonarr.imported_episodes} episodes ·{" "}
          {result.sonarr.files_scanned} MediaInfo scans
          {result.sonarr.errors.length > 0 && (
            <span className="text-red-500">
              {" "}
              · {result.sonarr.errors.length} errors
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onRunAgain}
        className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        Run again
      </button>
    </div>
  );
}
