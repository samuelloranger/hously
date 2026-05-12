import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DownloadListRow } from "@/features/downloadsImport/hooks/useDownloadsImport";

function badgeFor(
  row: DownloadListRow,
  t: (k: string) => string,
): { label: string; className: string } {
  if (row.is_imported)
    return {
      label: t("downloadsImport.status.imported"),
      className:
        "border-neutral-200 bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400",
    };
  if (row.parsed.title)
    return {
      label: t("downloadsImport.status.ready"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    };
  return {
    label: t("downloadsImport.status.parseFailed"),
    className:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200",
  };
}

export function StatusBadge({ row }: { row: DownloadListRow }) {
  const { t } = useTranslation("common");
  const b = badgeFor(row, t);
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        b.className,
      )}
    >
      {b.label}
    </span>
  );
}
