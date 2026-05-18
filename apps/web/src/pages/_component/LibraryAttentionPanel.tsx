import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import type { LibraryAttentionItem } from "@hously/shared/types";
import { useDismissLibraryAttentionAlert } from "@/features/medias/hooks/useDismissLibraryAttentionAlert";
import { useLibraryAttention } from "@/features/medias/hooks/useLibraryAttention";
import { useRetryLibraryPostProcess } from "@/features/medias/hooks/useRetryLibraryPostProcess";
import { useRetrySkippedMedia } from "@/features/medias/hooks/useRetrySkippedMedia";
import { useRetrySkippedSeason } from "@/features/medias/hooks/useRetrySkippedSeason";

type Severity = "fail" | "stall";

function severityOf(kind: LibraryAttentionItem["kind"]): Severity {
  return kind === "download_failed" || kind === "post_process_error"
    ? "fail"
    : "stall";
}

const SEVERITY_DOT: Record<Severity, string> = {
  fail: "bg-rose-500",
  stall: "bg-amber-500",
};

const KIND_LABEL_KEY: Record<LibraryAttentionItem["kind"], string> = {
  download_failed: "dashboard.libraryAttention.kindDownloadFailed",
  post_process_error: "dashboard.libraryAttention.kindPostProcess",
  download_stuck: "dashboard.libraryAttention.kindDownloadStuck",
  grab_skipped: "dashboard.libraryAttention.kindGrabSkipped",
  auto_grab_stalled: "dashboard.libraryAttention.kindAutoGrabStalled",
};

function tvLabel(item: LibraryAttentionItem): string | null {
  if (item.media_type !== "show") return null;
  if (
    item.scope_type === "season_pack" &&
    item.season != null &&
    item.season > 0
  ) {
    return `S${String(item.season).padStart(2, "0")}`;
  }
  if (
    item.scope_type === "episode" &&
    item.season != null &&
    item.episode_number != null
  ) {
    return `S${String(item.season).padStart(2, "0")}E${String(item.episode_number).padStart(2, "0")}`;
  }
  return null;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
      {children}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-3/5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function AttentionRow({
  item,
  onRetryPost,
  onResetWanted,
  onRetrySeason,
  onDismiss,
  postLoadingId,
  resetLoadingKey,
  seasonResetKey,
  dismissLoadingId,
}: {
  item: LibraryAttentionItem;
  onRetryPost: (dhId: number) => void;
  onResetWanted: (mediaId: number, episodeId?: number) => void;
  onRetrySeason: (mediaId: number, season: number) => void;
  onDismiss: (alertId: number) => void;
  postLoadingId: number | null;
  resetLoadingKey: string | null;
  seasonResetKey: string | null;
  dismissLoadingId: number | null;
}) {
  const { t } = useTranslation("common");
  const severity = severityOf(item.kind);
  const tv = tvLabel(item);
  const isPostProcess = item.kind === "post_process_error";
  const linkTab = isPostProcess ? ("management" as const) : ("search" as const);

  const resetKey = `${item.media_id}:${item.episode_id ?? "m"}`;
  const seasonKey =
    item.scope_type === "season_pack" && item.season != null && item.season > 0
      ? `${item.media_id}:s${item.season}`
      : null;

  const canResetSeason =
    item.scope_type === "season_pack" &&
    item.kind === "grab_skipped" &&
    seasonKey != null;
  const canResetItem =
    item.scope_type !== "season_pack" &&
    (item.kind === "grab_skipped" || item.kind === "auto_grab_stalled");
  const canRetryIngest = isPostProcess && item.download_history_id != null;

  const primary: {
    label: string;
    busy: boolean;
    onClick: () => void;
  } | null = canRetryIngest
    ? {
        label: t("dashboard.libraryAttention.retryPostProcess"),
        busy: postLoadingId === item.download_history_id,
        onClick: () => onRetryPost(item.download_history_id!),
      }
    : canResetSeason
      ? {
          label: t("dashboard.libraryAttention.resetAutoAttempts"),
          busy: seasonResetKey === seasonKey,
          onClick: () => onRetrySeason(item.media_id, item.season as number),
        }
      : canResetItem
        ? {
            label: t("dashboard.libraryAttention.resetAutoAttempts"),
            busy: resetLoadingKey === resetKey,
            onClick: () =>
              onResetWanted(item.media_id, item.episode_id ?? undefined),
          }
        : null;

  return (
    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Kicker>{t(KIND_LABEL_KEY[item.kind])}</Kicker>
            {tv ? (
              <span className="text-[10px] font-semibold tracking-wide text-zinc-400 dark:text-zinc-500">
                {tv}
              </span>
            ) : null}
          </div>
          <Link
            to="/library/$libraryId"
            params={{ libraryId: String(item.media_id) }}
            search={{ tab: linkTab }}
            className="block mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {item.media_title}
          </Link>
          {item.detail ? (
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words">
              {item.detail}
            </p>
          ) : item.search_attempts != null && item.search_attempts > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {t("dashboard.libraryAttention.autoAttempts", {
                count: item.search_attempts,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {primary ? (
            <button
              type="button"
              disabled={primary.busy}
              onClick={primary.onClick}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {primary.busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : null}
              {primary.label}
            </button>
          ) : null}
          <button
            type="button"
            disabled={dismissLoadingId === item.id}
            onClick={() => onDismiss(item.id)}
            aria-label={t("dashboard.libraryAttention.dismiss")}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {dismissLoadingId === item.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <X size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LibraryAttentionPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading, isError, refetch, isFetching } =
    useLibraryAttention();
  const retryPost = useRetryLibraryPostProcess();
  const retrySkipped = useRetrySkippedMedia();
  const retrySeason = useRetrySkippedSeason();
  const dismissAlert = useDismissLibraryAttentionAlert();

  const items = data?.items ?? [];

  if (!isLoading && !isError && items.length === 0) return null;

  const postLoadingId = retryPost.isPending
    ? (retryPost.variables ?? null)
    : null;
  const resetLoadingKey = retrySkipped.isPending
    ? `${retrySkipped.variables?.mediaId}:${retrySkipped.variables?.episodeId ?? "m"}`
    : null;
  const seasonResetKey = retrySeason.isPending
    ? `${retrySeason.variables?.mediaId}:s${retrySeason.variables?.season}`
    : null;
  const dismissLoadingId = dismissAlert.isPending
    ? (dismissAlert.variables ?? null)
    : null;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <AlertTriangle
            size={14}
            className="text-amber-500 shrink-0"
            aria-hidden
          />
          <Kicker>{t("dashboard.libraryAttention.title")}</Kicker>
          {!isLoading && items.length > 0 ? (
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
              {items.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          aria-label={t("dashboard.libraryAttention.refresh")}
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isError ? (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle size={14} className="shrink-0" />
          {t("dashboard.libraryAttention.loadError")}
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-[11px] font-semibold underline"
          >
            {t("dashboard.libraryAttention.retry")}
          </button>
        </div>
      ) : isLoading ? (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              postLoadingId={postLoadingId}
              resetLoadingKey={resetLoadingKey}
              seasonResetKey={seasonResetKey}
              dismissLoadingId={dismissLoadingId}
              onDismiss={(id) => {
                dismissAlert.mutate(id, {
                  onSuccess: () =>
                    toast.success(
                      t("dashboard.libraryAttention.toastDismissOk"),
                    ),
                  onError: () =>
                    toast.error(
                      t("dashboard.libraryAttention.toastDismissFail"),
                    ),
                });
              }}
              onRetryPost={(dhId) => {
                retryPost.mutate(dhId, {
                  onSuccess: () =>
                    toast.success(
                      t("dashboard.libraryAttention.toastPostQueued"),
                    ),
                  onError: () =>
                    toast.error(
                      t("dashboard.libraryAttention.toastPostFailed"),
                    ),
                });
              }}
              onResetWanted={(mediaId, episodeId) => {
                retrySkipped.mutate(
                  { mediaId, episodeId },
                  {
                    onSuccess: () =>
                      toast.success(
                        t("dashboard.libraryAttention.toastResetOk"),
                      ),
                    onError: () =>
                      toast.error(
                        t("dashboard.libraryAttention.toastResetFail"),
                      ),
                  },
                );
              }}
              onRetrySeason={(mediaId, season) => {
                retrySeason.mutate(
                  { mediaId, season },
                  {
                    onSuccess: () =>
                      toast.success(
                        t("dashboard.libraryAttention.toastResetOk"),
                      ),
                    onError: () =>
                      toast.error(
                        t("dashboard.libraryAttention.toastResetFail"),
                      ),
                  },
                );
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
