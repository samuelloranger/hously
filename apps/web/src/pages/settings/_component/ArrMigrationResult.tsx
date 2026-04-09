import { useTranslation } from "react-i18next";
import type { MigrateJobResult } from "@hously/shared/types";

interface ArrMigrationResultProps {
  result: MigrateJobResult;
  onRunAgain: () => void;
}

export function ArrMigrationResult({
  result,
  onRunAgain,
}: ArrMigrationResultProps) {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {t("settings.arrImport.importComplete")}
      </p>
      {result.radarr && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-[10px] text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t("settings.arrImport.serviceRadarr")}:{" "}
          </span>
          {t("settings.arrImport.radarrResultLine", {
            imported: result.radarr.imported,
            existed: result.radarr.already_existed,
            scanned: result.radarr.files_scanned,
          })}
          {result.radarr.errors.length > 0 && (
            <span className="text-red-500">
              {" "}
              ·{" "}
              {t("settings.arrImport.errorsCount", {
                count: result.radarr.errors.length,
              })}
            </span>
          )}
        </div>
      )}
      {result.sonarr && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-[10px] text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t("settings.arrImport.serviceSonarr")}:{" "}
          </span>
          {t("settings.arrImport.sonarrResultLine", {
            shows: result.sonarr.imported_shows,
            episodes: result.sonarr.imported_episodes,
            scanned: result.sonarr.files_scanned,
          })}
          {result.sonarr.errors.length > 0 && (
            <span className="text-red-500">
              {" "}
              ·{" "}
              {t("settings.arrImport.errorsCount", {
                count: result.sonarr.errors.length,
              })}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onRunAgain}
        className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        {t("settings.arrImport.runAgain")}
      </button>
    </div>
  );
}
