import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { useLibraryScan } from "@/features/medias/hooks/useLibraryScan";
import { useReindexLanguages } from "@/features/medias/hooks/useReindexLanguages";
import { useReindexLanguagesStatus } from "@/features/medias/hooks/useReindexLanguagesStatus";
import { useUpdateMediaPostProcessingSettings } from "@/features/medias/hooks/useUpdateMediaPostProcessingSettings";
import { useProwlarrIntegration } from "@/pages/settings/useProwlarrIntegration";
import { useJackettIntegration } from "@/pages/settings/useJackettIntegration";
import type {
  MediaFileOperation,
  MediaPostProcessingSettings,
  QualityProfilesListResponse,
} from "@hously/shared/types";

interface MediaPostProcessingSettingsBodyProps {
  settings: MediaPostProcessingSettings;
  profilesData: QualityProfilesListResponse | undefined;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40";

const LABEL_CLASS =
  "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5";

function CardSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-700/60 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </div>
  );
}

export function MediaPostProcessingSettingsBody({
  settings,
  profilesData,
}: MediaPostProcessingSettingsBodyProps) {
  const { t } = useTranslation("common");
  const updateMut = useUpdateMediaPostProcessingSettings();
  const scanMut = useLibraryScan();

  const [postProcessingEnabled, setPostProcessingEnabled] = useState(
    settings.post_processing_enabled,
  );
  const [moviesPath, setMoviesPath] = useState(
    settings.movies_library_path ?? "",
  );
  const [showsPath, setShowsPath] = useState(settings.shows_library_path ?? "");
  const [fileOperation, setFileOperation] = useState<MediaFileOperation>(
    settings.file_operation === "move" ? "move" : "hardlink",
  );
  const [movieTemplate, setMovieTemplate] = useState(settings.movie_template);
  const [episodeTemplate, setEpisodeTemplate] = useState(
    settings.episode_template,
  );
  const [minSeedRatio, setMinSeedRatio] = useState(settings.min_seed_ratio);
  const [defaultQualityProfileId, setDefaultQualityProfileId] = useState<
    number | null
  >(settings.default_quality_profile_id);
  const [activeIndexerManager, setActiveIndexerManager] = useState(
    settings.active_indexer_manager,
  );
  const [scanPath, setScanPath] = useState("");
  const [scanType, setScanType] = useState<"movie" | "show">("movie");
  const [lastScan, setLastScan] = useState<{
    matched: number;
    unmatched: string[];
  } | null>(null);

  const { data: prowlarrData } = useProwlarrIntegration();
  const { data: jackettData } = useJackettIntegration();
  const prowlarrEnabled = Boolean(prowlarrData?.integration?.enabled);
  const jackettEnabled = Boolean(jackettData?.integration?.enabled);
  const indexerOptions = [
    ...(prowlarrEnabled ? [{ value: "prowlarr", label: "Prowlarr" }] : []),
    ...(jackettEnabled ? [{ value: "jackett", label: "Jackett" }] : []),
  ];

  const onSave = async () => {
    try {
      await updateMut.mutateAsync({
        post_processing_enabled: postProcessingEnabled,
        movies_library_path: moviesPath.trim() || null,
        shows_library_path: showsPath.trim() || null,
        file_operation: fileOperation,
        movie_template: movieTemplate,
        episode_template: episodeTemplate,
        min_seed_ratio: minSeedRatio,
        default_quality_profile_id: defaultQualityProfileId,
        active_indexer_manager: activeIndexerManager,
      });
      toast.success(t("settings.mediaLibrary.saveSuccess"));
    } catch {
      toast.error(t("settings.mediaLibrary.saveError"));
    }
  };

  const onScan = async () => {
    const p = scanPath.trim();
    if (!p) {
      toast.error(t("settings.mediaLibrary.scanPath"));
      return;
    }
    setLastScan(null);
    try {
      const res = await scanMut.mutateAsync({ path: p, type: scanType });
      setLastScan({ matched: res.matched, unmatched: res.unmatched });
      toast.success(
        t("settings.mediaLibrary.scanResult", { count: res.matched }),
      );
    } catch {
      toast.error(t("settings.mediaLibrary.scanError"));
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Post-processing settings ─────────────────────────────────── */}
      <CardSection
        title={t("settings.mediaLibrary.title")}
        description={t("settings.mediaLibrary.description")}
      >
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={postProcessingEnabled}
            onChange={(e) => setPostProcessingEnabled(e.target.checked)}
            className="rounded border-neutral-300"
          />
          {t("settings.mediaLibrary.postProcessingToggle")}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <FormInput
            label={t("settings.mediaLibrary.moviesPath")}
            value={moviesPath}
            onChange={(e) => setMoviesPath(e.target.value)}
            placeholder="/data/movies"
            className="font-mono text-xs"
          />
          <FormInput
            label={t("settings.mediaLibrary.showsPath")}
            value={showsPath}
            onChange={(e) => setShowsPath(e.target.value)}
            placeholder="/data/shows"
            className="font-mono text-xs"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.fileOperation")}
          </label>
          <select
            value={fileOperation}
            onChange={(e) =>
              setFileOperation(e.target.value as MediaFileOperation)
            }
            className={SELECT_CLASS}
          >
            <option value="hardlink">
              {t("settings.mediaLibrary.hardlink")}
            </option>
            <option value="move">{t("settings.mediaLibrary.move")}</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.movieTemplate")}
          </label>
          <textarea
            value={movieTemplate}
            onChange={(e) => setMovieTemplate(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.episodeTemplate")}
          </label>
          <textarea
            value={episodeTemplate}
            onChange={(e) => setEpisodeTemplate(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        <FormInput
          label={t("settings.mediaLibrary.minSeedRatio")}
          type="number"
          min={0}
          step={0.1}
          value={String(minSeedRatio)}
          onChange={(e) => setMinSeedRatio(Number(e.target.value))}
        />

        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.activeIndexerManager")}
          </label>
          {indexerOptions.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("settings.mediaLibrary.noIndexerConfigured")}
            </p>
          ) : (
            <select
              value={activeIndexerManager ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setActiveIndexerManager(
                  val === "prowlarr" || val === "jackett" ? val : null,
                );
              }}
              className={SELECT_CLASS}
            >
              <option value="">
                {t("settings.mediaLibrary.noIndexerSelected")}
              </option>
              {indexerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.defaultQualityProfile")}
          </label>
          <select
            value={defaultQualityProfileId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDefaultQualityProfileId(v === "" ? null : parseInt(v, 10));
            }}
            className={SELECT_CLASS}
          >
            <option value="">
              {t("settings.mediaLibrary.defaultQualityProfileNone")}
            </option>
            {(profilesData?.profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {t("settings.mediaLibrary.defaultQualityProfileHint")}
          </p>
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={updateMut.isPending}
          >
            {updateMut.isPending
              ? t("settings.mediaLibrary.saving")
              : t("settings.mediaLibrary.save")}
          </Button>
        </div>
      </CardSection>

      {/* ── Library scan ─────────────────────────────────────────────── */}
      <CardSection
        title={t("settings.mediaLibrary.scanTitle")}
        description={t("settings.mediaLibrary.scanDescription")}
      >
        <FormInput
          label={t("settings.mediaLibrary.scanPath")}
          value={scanPath}
          onChange={(e) => setScanPath(e.target.value)}
          placeholder="/mnt/media/Movies"
          className="font-mono text-xs"
        />
        <div>
          <label className={LABEL_CLASS}>
            {t("settings.mediaLibrary.scanType")}
          </label>
          <select
            value={scanType}
            onChange={(e) =>
              setScanType(e.target.value === "show" ? "show" : "movie")
            }
            className={SELECT_CLASS}
          >
            <option value="movie">
              {t("settings.mediaLibrary.scanMovies")}
            </option>
            <option value="show">{t("settings.mediaLibrary.scanShows")}</option>
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onScan()}
          disabled={scanMut.isPending}
        >
          {scanMut.isPending
            ? t("settings.mediaLibrary.scanRunning")
            : t("settings.mediaLibrary.scanRun")}
        </Button>
        {lastScan && lastScan.unmatched.length > 0 && (
          <div className="rounded-lg border border-neutral-100 dark:border-neutral-700/60 bg-neutral-50 dark:bg-neutral-900/40 p-3 text-xs text-neutral-600 dark:text-neutral-400">
            <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1.5">
              {t("settings.mediaLibrary.scanUnmatched")} (
              {lastScan.unmatched.length})
            </p>
            <ul className="list-disc pl-4 max-h-40 overflow-y-auto font-mono space-y-0.5">
              {lastScan.unmatched.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        )}
      </CardSection>

      {/* ── Reindex languages ────────────────────────────────────────── */}
      <ReindexLanguagesSection />
    </div>
  );
}

function ReindexLanguagesSection() {
  const { t } = useTranslation("common");
  const reindexMut = useReindexLanguages();
  const { data: status } = useReindexLanguagesStatus();
  const isRunning = status?.state === "active" || status?.state === "waiting";

  const onStart = async () => {
    try {
      await reindexMut.mutateAsync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
      <div className="border-b border-neutral-100 dark:border-neutral-700/60 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {t("medias.library.reindexLanguagesButton")}
        </h2>
      </div>
      <div className="space-y-3 p-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onStart()}
          disabled={isRunning || reindexMut.isPending}
        >
          {isRunning && status?.progress
            ? t("medias.library.reindexLanguagesRunning", {
                current: status.progress.current,
                total: status.progress.total,
              })
            : t("medias.library.reindexLanguagesButton")}
        </Button>
        {status?.state === "completed" && status.result && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("medias.library.reindexLanguagesDone", {
              updated: status.result.updated,
              errors: status.result.errors,
            })}
          </p>
        )}
        {status?.state === "failed" && status.error && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {status.error}
          </p>
        )}
      </div>
    </div>
  );
}
