import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useStartMigration, useMigrateStatus } from "@/hooks/useLibrary";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { ArrMigrationProgress } from "./ArrMigrationProgress";
import { ArrMigrationResult } from "./ArrMigrationResult";

type Source = "both" | "radarr" | "sonarr";

function CredentialInput({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

export function ArrLibraryImportPanel() {
  const queryClient = useQueryClient();
  const startMigration = useStartMigration();
  const status = useMigrateStatus();
  const [source, setSource] = useState<Source>("both");
  const [radarrUrl, setRadarrUrl] = useState("");
  const [radarrApiKey, setRadarrApiKey] = useState("");
  const [sonarrUrl, setSonarrUrl] = useState("");
  const [sonarrApiKey, setSonarrApiKey] = useState("");
  const prevStateRef = useRef(status.state);

  const isRunning = status.state === "active" || status.state === "waiting";
  const isDone = status.state === "completed";
  const isFailed = status.state === "failed";

  const needsRadarr = source === "radarr" || source === "both";
  const needsSonarr = source === "sonarr" || source === "both";

  const canStart =
    (!needsRadarr || (radarrUrl.trim() && radarrApiKey.trim())) &&
    (!needsSonarr || (sonarrUrl.trim() && sonarrApiKey.trim()));

  const handleStart = async () => {
    try {
      await startMigration.mutateAsync({
        source,
        radarr_url: needsRadarr ? radarrUrl.trim() : undefined,
        radarr_api_key: needsRadarr ? radarrApiKey.trim() : undefined,
        sonarr_url: needsSonarr ? sonarrUrl.trim() : undefined,
        sonarr_api_key: needsSonarr ? sonarrApiKey.trim() : undefined,
      });
      toast.success("Import started in background");
    } catch {
      toast.error("Failed to start import");
    }
  };

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = status.state;
    if (prev !== "completed" && status.state === "completed") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    }
  }, [status.state, queryClient]);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Download size={14} className="text-indigo-500" />
              Import library from Radarr / Sonarr
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              One-time migration: scans files with MediaInfo and copies titles
              into the native library.
            </p>
          </div>
          {isRunning && (
            <Loader2
              size={16}
              className="text-indigo-500 animate-spin shrink-0"
            />
          )}
          {isDone && !isRunning && (
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          )}
          {isFailed && (
            <AlertCircle size={16} className="text-red-500 shrink-0" />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!isRunning && !isDone && (
          <div className="space-y-3">
            {/* Source picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Source
              </p>
              <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                {(["both", "radarr", "sonarr"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                      source === s
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    )}
                  >
                    {s === "both" ? "Both" : s === "radarr" ? "Radarr" : "Sonarr"}
                  </button>
                ))}
              </div>
            </div>

            {/* Radarr credentials */}
            {needsRadarr && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Radarr
                </p>
                <CredentialInput
                  label="URL"
                  placeholder="http://radarr:7878"
                  value={radarrUrl}
                  onChange={setRadarrUrl}
                />
                <CredentialInput
                  label="API Key"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={radarrApiKey}
                  onChange={setRadarrApiKey}
                  type="password"
                />
              </div>
            )}

            {/* Sonarr credentials */}
            {needsSonarr && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Sonarr
                </p>
                <CredentialInput
                  label="URL"
                  placeholder="http://sonarr:8989"
                  value={sonarrUrl}
                  onChange={setSonarrUrl}
                />
                <CredentialInput
                  label="API Key"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={sonarrApiKey}
                  onChange={setSonarrApiKey}
                  type="password"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={startMigration.isPending || !canStart}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 transition-colors"
            >
              {startMigration.isPending ? "Starting…" : "Start import"}
            </button>
          </div>
        )}

        {isRunning && status.progress && (
          <ArrMigrationProgress progress={status.progress} source={source} />
        )}

        {isDone && status.result && (
          <ArrMigrationResult
            result={status.result}
            onRunAgain={() => void handleStart()}
          />
        )}

        {isFailed && (
          <div className="space-y-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {status.error ?? "Import failed with an unknown error"}
            </div>
            <button
              type="button"
              onClick={() => void handleStart()}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {status.state === "unknown" && !startMigration.isPending && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center">
            No previous import job found.
          </p>
        )}
      </div>
    </div>
  );
}
