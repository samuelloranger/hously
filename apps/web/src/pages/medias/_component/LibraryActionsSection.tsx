import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useRemoveFromLibrary } from "@/hooks/useLibrary";
import { Card } from "./LibrarySharedUI";

interface LibraryActionsSectionProps {
  libraryId: number;
  onDeleted?: () => void;
}

export function LibraryActionsSection({
  libraryId,
  onDeleted,
}: LibraryActionsSectionProps) {
  const { t } = useTranslation("common");
  const removeMutation = useRemoveFromLibrary();
  const [deleteConfirm, setDeleteConfirm] = useState<"idle" | "confirm">(
    "idle",
  );
  const [deleteFiles, setDeleteFiles] = useState(true);

  if (deleteConfirm === "confirm") {
    return (
      <Card className="border-red-200 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/10">
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
            {t("library.management.deleteConfirmTitle")}
          </p>
          <label className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="rounded border-red-300"
            />
            {t("library.management.deleteFilesLabel")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={removeMutation.isPending}
              onClick={async () => {
                try {
                  await removeMutation.mutateAsync({
                    id: libraryId,
                    deleteFiles,
                  });
                  onDeleted?.();
                } catch {
                  // mutation error handled by hook
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={10} />
              {removeMutation.isPending
                ? t("library.management.deleting")
                : t("library.management.deleteConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm("idle")}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 px-1">
      <button
        type="button"
        onClick={() => setDeleteConfirm("confirm")}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <Trash2 size={11} />
        {t("library.management.delete")}
      </button>
    </div>
  );
}
