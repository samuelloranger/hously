import { useTranslation } from "react-i18next";
import { TriangleAlert, X } from "lucide-react";
import type { IndexerWarning } from "@hously/shared/types";

interface InteractiveSearchStatusStripProps {
  indexerWarnings: IndexerWarning[];
  dismissed: boolean;
  onDismiss: () => void;
  hiddenCount: number;
  hasViewOverrides: boolean;
  onResetView: () => void;
  visibleCount: number;
  totalReleases: number;
  isSearchMode: boolean;
  searchApiQuery: string;
  isOriginalTitleQuery: boolean;
  onToggleSearchTitleVariant: () => void;
}

export function InteractiveSearchStatusStrip({
  indexerWarnings,
  dismissed,
  onDismiss,
}: InteractiveSearchStatusStripProps) {
  const { t } = useTranslation("common");

  return (
    <>
      {indexerWarnings.length > 0 && !dismissed && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/20"
        >
          <TriangleAlert
            size={15}
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-amber-900 dark:text-amber-200">
              {indexerWarnings.length === 1
                ? t("medias.interactive.indexerWarning.single", {
                    name: indexerWarnings[0].name,
                  })
                : t("medias.interactive.indexerWarning.multiple", {
                    count: indexerWarnings.length,
                    names: indexerWarnings.map((w) => w.name).join(", "),
                  })}
            </span>
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              {t("medias.interactive.indexerWarning.hint")}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-amber-500 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
            aria-label={t("medias.interactive.indexerWarning.dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
