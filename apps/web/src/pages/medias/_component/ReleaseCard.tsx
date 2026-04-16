import { Download } from "lucide-react";
import type { InteractiveReleaseItem } from "@hously/shared/types";
import { formatBytes } from "@/lib/utils/format";

/** Insert <wbr> after dots so long release titles can wrap on mobile. */
function BreakableTitle({ text }: { text: string }) {
  const parts = text.split(".");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && "."}
          {i > 0 && <wbr />}
          {part}
        </span>
      ))}
    </>
  );
}

export function ReleaseCard({
  release,
  onDownload,
  isDownloading,
  isBusy,
  alreadyGrabbed = false,
  t,
}: {
  release: InteractiveReleaseItem;
  onDownload: () => void;
  isDownloading: boolean;
  isBusy: boolean;
  alreadyGrabbed?: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const grabDisabled =
    isBusy || (!release.download_url && !release.download_token);
  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        release.rejected
          ? "border-amber-200/60 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20"
          : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-900/60 dark:hover:bg-neutral-900"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-neutral-900 dark:text-white">
            {release.info_url ? (
              <a
                href={release.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
              >
                <BreakableTitle text={release.title} />
              </a>
            ) : (
              <BreakableTitle text={release.title} />
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {release.is_complete_series && (
              <span className="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                Intégrale
              </span>
            )}
            {release.is_season_pack && !release.is_complete_series && (
              <span className="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                Season pack
              </span>
            )}
            {release.indexer && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {release.indexer}
              </span>
            )}
            {release.size_bytes != null && (
              <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {formatBytes(release.size_bytes)}
              </span>
            )}
            {release.parsed_quality && (
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                {[
                  release.parsed_quality.resolution
                    ? `${release.parsed_quality.resolution}p`
                    : null,
                  release.parsed_quality.source,
                  release.parsed_quality.codec,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            {release.parsed_quality?.hdr && (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {release.parsed_quality.hdr}
              </span>
            )}
            {release.freeleech && (
              <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                FL
              </span>
            )}
            {release.quality_score != null && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {t("medias.interactive.profileScore", {
                  score: release.quality_score,
                })}
              </span>
            )}
            {release.age != null && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {t("medias.interactive.age", { age: release.age })}
              </span>
            )}
            {(release.seeders != null || release.leechers != null) && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {t("medias.interactive.seedersLeechers", {
                  seeders: release.seeders ?? "-",
                  leechers: release.leechers ?? "-",
                })}
              </span>
            )}
            {release.languages.length > 0 && (
              <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                {release.languages.join(", ")}
              </span>
            )}
          </div>

          {release.rejected && (
            <>
              {release.rejection_reason && (
                <p className="mt-2 rounded-md bg-amber-100/60 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  {release.rejection_reason}
                </p>
              )}
              {release.quality_rejection_reasons &&
                release.quality_rejection_reasons.length > 0 && (
                  <p className="mt-1 rounded-md bg-amber-100/60 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    {release.quality_rejection_reasons.length === 1
                      ? t(
                          `medias.interactive.rejection.${release.quality_rejection_reasons[0]}`,
                          {
                            defaultValue: t(
                              "medias.interactive.rejection.generic",
                            ),
                          },
                        )
                      : t("medias.interactive.rejection.generic")}
                  </p>
                )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={grabDisabled}
          style={{ touchAction: "manipulation" }}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Download size={11} strokeWidth={2.5} />
          {isDownloading
            ? t("medias.interactive.downloading")
            : alreadyGrabbed
              ? t("medias.interactive.redownload")
              : t("medias.interactive.download")}
        </button>
      </div>
    </div>
  );
}
