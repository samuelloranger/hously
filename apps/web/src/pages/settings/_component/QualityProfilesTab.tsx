import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import {
  useDeleteQualityProfile,
  useQualityProfilesList,
} from "@/hooks/useQualityProfiles";
import type { QualityProfile } from "@hously/shared/types";
import { cn } from "@/lib/utils";
import {
  QualityProfileEditorPanel,
  LANGUAGE_OPTIONS,
} from "./QualityProfileEditorPanel";

export function QualityProfilesTab() {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useQualityProfilesList();
  const deleteMut = useDeleteQualityProfile();
  const [editingId, setEditingId] = useState<number | null>(null);

  const onDelete = async (p: QualityProfile) => {
    if (!confirm(t("settings.qualityProfiles.deleteConfirm", { name: p.name })))
      return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success(t("settings.qualityProfiles.deleteSuccess"));
      if (editingId === p.id) {
        setEditingId(null);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : t("settings.qualityProfiles.deleteError");
      toast.error(msg);
    }
  };

  const profiles = data?.profiles ?? [];
  const editingProfile =
    editingId != null ? profiles.find((x) => x.id === editingId) : undefined;
  const editorKey =
    editingId == null
      ? "new"
      : editingProfile
        ? `${editingId}-${editingProfile.updated_at}`
        : `${editingId}-pending`;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
      <QualityProfileEditorPanel
        key={editorKey}
        editingId={editingId}
        initialProfile={editingProfile}
        onDismiss={() => setEditingId(null)}
      />

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("settings.qualityProfiles.listTitle")}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t("settings.qualityProfiles.listDescription")}
            </p>
          </div>
          {profiles.length > 0 && (
            <span className="rounded-full bg-neutral-100 dark:bg-neutral-700 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {profiles.length}
            </span>
          )}
        </div>

        <div className="p-4">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400 px-2">
              {t("settings.qualityProfiles.loadError")}
            </p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 px-2 py-4 text-center">
              {t("settings.qualityProfiles.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-lg border px-4 py-3 flex items-start justify-between gap-4 transition-colors",
                    editingId === p.id
                      ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-700/50 dark:bg-indigo-500/5"
                      : "border-neutral-100 dark:border-neutral-700/60 hover:border-neutral-200 dark:hover:border-neutral-600",
                  )}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {p.name}
                      </p>
                      <span className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300">
                        {p.min_resolution}p
                        {p.cutoff_resolution ? `→${p.cutoff_resolution}p` : ""}
                      </span>
                      {p.require_hdr && (
                        <span className="rounded-md bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          {t("settings.qualityProfiles.hdrRequired")}
                        </span>
                      )}
                      {!p.require_hdr && p.prefer_hdr && (
                        <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {t("settings.qualityProfiles.hdrPreferred")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.preferred_sources.map((s) => (
                        <span
                          key={s}
                          className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400"
                        >
                          {s}
                        </span>
                      ))}
                      {p.preferred_codecs.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
                        >
                          {c}
                        </span>
                      ))}
                      {p.preferred_languages.map((l) => (
                        <span
                          key={l}
                          className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
                        >
                          {LANGUAGE_OPTIONS.find((o) => o.value === l)?.label ??
                            l}
                        </span>
                      ))}
                      {p.max_size_gb != null && (
                        <span className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                          ≤ {p.max_size_gb} Go
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(editingId === p.id ? null : p.id)
                      }
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        editingId === p.id
                          ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                          : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300",
                      )}
                      title={t("settings.qualityProfiles.edit")}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(p)}
                      className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                      title={t("settings.qualityProfiles.delete")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
