import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, ChevronDown, X, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { LoadingState } from "@/components/LoadingState";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  profileToForm,
  useCreateQualityProfile,
  useDeleteQualityProfile,
  useQualityProfilesList,
  useUpdateQualityProfile,
  type QualityProfileFormPayload,
} from "@/hooks/useQualityProfiles";
import type { QualityProfile } from "@hously/shared/types";
import { cn } from "@/lib/utils";

// ─── Option definitions ───────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: "REMUX",  label: "REMUX" },
  { value: "BluRay", label: "Blu-ray" },
  { value: "WEB-DL", label: "WEB-DL" },
  { value: "WEBRip", label: "WEBRip" },
  { value: "HDTV",   label: "HDTV" },
];

const CODEC_OPTIONS = [
  { value: "HEVC", label: "HEVC / x265" },
  { value: "AVC",  label: "AVC / x264" },
  { value: "AV1",  label: "AV1" },
  { value: "VP9",  label: "VP9" },
];

const LANGUAGE_OPTIONS = [
  { value: "en",         label: "English" },
  { value: "fr",         label: "Français (générique)" },
  { value: "VFF",        label: "VFF — Français (France)" },
  { value: "VFQ",        label: "VFQ — Français (Québec)" },
  { value: "VF2",        label: "VF2 — Dual French" },
  { value: "VFI",        label: "VFI — Français (International)" },
  { value: "TRUEFRENCH", label: "TRUEFRENCH" },
  { value: "de",         label: "Deutsch" },
  { value: "es",         label: "Español" },
  { value: "it",         label: "Italiano" },
  { value: "ja",         label: "日本語" },
  { value: "pt",         label: "Português" },
];

// ─── MultiSelect (Popover + checkboxes) ──────────────────────────────────────

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>();

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const remove = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const handleOpenChange = (next: boolean) => {
    if (next && triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth);
    }
    setOpen(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors",
              "border-neutral-200 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
              "dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600",
              open && "ring-2 ring-indigo-500/30 border-indigo-300 dark:border-indigo-600",
            )}
          >
            {selected.length === 0 ? (
              <span className="flex-1 text-neutral-400 dark:text-neutral-500">
                {placeholder}
              </span>
            ) : (
              <span className="flex flex-1 flex-wrap gap-1">
                {selected.map((v) => {
                  const opt = options.find((o) => o.value === v);
                  return (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                    >
                      {opt?.label ?? v}
                      <button
                        type="button"
                        onClick={(e) => remove(e, v)}
                        className="rounded hover:text-indigo-900 dark:hover:text-indigo-100"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </span>
                  );
                })}
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "ml-auto shrink-0 text-neutral-400 transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="p-1"
          style={{ width: popoverWidth }}
        >
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isSelected
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-400"
                      : "border-neutral-300 dark:border-neutral-600",
                  )}
                >
                  {isSelected && <Check size={10} strokeWidth={3} />}
                </span>
                {opt.label}
              </button>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 transition-colors"
              >
                <X size={10} />
                Tout désélectionner
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {children}
    </label>
  );
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const emptyPayload: QualityProfileFormPayload = {
  name: "",
  min_resolution: 1080,
  preferred_sources: [],
  preferred_codecs: [],
  preferred_languages: [],
  max_size_gb: null,
  require_hdr: false,
  prefer_hdr: false,
  cutoff_resolution: null,
};

const selectClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors";

// ─── Main component ───────────────────────────────────────────────────────────

export function QualityProfilesTab() {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useQualityProfilesList();
  const createMut = useCreateQualityProfile();
  const updateMut = useUpdateQualityProfile();
  const deleteMut = useDeleteQualityProfile();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QualityProfileFormPayload>(emptyPayload);

  const set = <K extends keyof QualityProfileFormPayload>(
    key: K,
    value: QualityProfileFormPayload[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (editingId == null) {
      setForm(emptyPayload);
      return;
    }
    const p = data?.profiles.find((x) => x.id === editingId);
    if (p) setForm(profileToForm(p));
  }, [editingId, data?.profiles]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("settings.qualityProfiles.nameRequired"));
      return;
    }
    try {
      if (editingId != null) {
        await updateMut.mutateAsync({ id: editingId, body: form });
        toast.success(t("settings.qualityProfiles.updateSuccess"));
      } else {
        await createMut.mutateAsync(form);
        toast.success(t("settings.qualityProfiles.createSuccess"));
      }
      setEditingId(null);
      setForm(emptyPayload);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : t("settings.qualityProfiles.saveError");
      toast.error(msg);
    }
  };

  const onDelete = async (p: QualityProfile) => {
    if (!confirm(t("settings.qualityProfiles.deleteConfirm", { name: p.name })))
      return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success(t("settings.qualityProfiles.deleteSuccess"));
      if (editingId === p.id) {
        setEditingId(null);
        setForm(emptyPayload);
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
  const busy = createMut.isPending || updateMut.isPending;
  const isEditing = editingId != null;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/60",
          isEditing && "bg-indigo-50/60 dark:bg-indigo-500/5",
        )}>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {isEditing
              ? t("settings.qualityProfiles.editTitle")
              : t("settings.qualityProfiles.createTitle")}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("settings.qualityProfiles.formDescription")}
          </p>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-5">
          {/* Name */}
          <FormInput
            label={t("settings.qualityProfiles.name")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="ex. Cinéma 1080p FR"
          />

          {/* Resolutions row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t("settings.qualityProfiles.minResolution")}</FieldLabel>
              <select
                value={form.min_resolution}
                onChange={(e) => set("min_resolution", Number(e.target.value))}
                className={selectClass}
              >
                <option value={480}>480p</option>
                <option value={720}>720p</option>
                <option value={1080}>1080p</option>
                <option value={2160}>2160p / 4K</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t("settings.qualityProfiles.cutoffResolution")}</FieldLabel>
              <select
                value={form.cutoff_resolution ?? ""}
                onChange={(e) =>
                  set("cutoff_resolution", e.target.value ? Number(e.target.value) : null)
                }
                className={selectClass}
              >
                <option value="">{t("settings.qualityProfiles.noCutoff")}</option>
                <option value={480}>480p</option>
                <option value={720}>720p</option>
                <option value={1080}>1080p</option>
                <option value={2160}>2160p / 4K</option>
              </select>
            </div>
          </div>

          {/* Sources + Codecs */}
          <div className="grid grid-cols-2 gap-4">
            <MultiSelect
              label={t("settings.qualityProfiles.preferredSources")}
              placeholder="Sélectionner des sources…"
              options={SOURCE_OPTIONS}
              selected={form.preferred_sources}
              onChange={(v) => set("preferred_sources", v)}
            />
            <MultiSelect
              label={t("settings.qualityProfiles.preferredCodecs")}
              placeholder="Sélectionner des codecs…"
              options={CODEC_OPTIONS}
              selected={form.preferred_codecs}
              onChange={(v) => set("preferred_codecs", v)}
            />
          </div>

          {/* Languages */}
          <MultiSelect
            label={t("settings.qualityProfiles.preferredLanguages")}
            placeholder="Sélectionner des langues…"
            options={LANGUAGE_OPTIONS}
            selected={form.preferred_languages}
            onChange={(v) => set("preferred_languages", v)}
          />

          {/* HDR + Max size */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>HDR</FieldLabel>
              <div className="space-y-2 pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                    form.prefer_hdr
                      ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-400"
                      : "border-neutral-300 dark:border-neutral-600 group-hover:border-neutral-400",
                  )}>
                    {form.prefer_hdr && <Check size={10} strokeWidth={3} />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.prefer_hdr}
                    onChange={(e) => set("prefer_hdr", e.target.checked)}
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {t("settings.qualityProfiles.preferHdr")}
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                    form.require_hdr
                      ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-400"
                      : "border-neutral-300 dark:border-neutral-600 group-hover:border-neutral-400",
                  )}>
                    {form.require_hdr && <Check size={10} strokeWidth={3} />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.require_hdr}
                    onChange={(e) => set("require_hdr", e.target.checked)}
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {t("settings.qualityProfiles.requireHdr")}
                  </span>
                </label>
              </div>
            </div>
            <FormInput
              label={t("settings.qualityProfiles.maxSizeGb")}
              type="number"
              step="0.1"
              min="0"
              value={form.max_size_gb ?? ""}
              onChange={(e) =>
                set("max_size_gb", e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder={t("settings.qualityProfiles.maxSizeGbPlaceholder")}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-700/60">
            <Button type="submit" disabled={busy} size="sm">
              {isEditing
                ? t("settings.qualityProfiles.save")
                : t("settings.qualityProfiles.create")}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setEditingId(null); setForm(emptyPayload); }}
              >
                {t("settings.qualityProfiles.cancelEdit")}
              </Button>
            )}
          </div>
        </form>
      </div>

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
                    {/* Name + resolution */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {p.name}
                      </p>
                      <span className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300">
                        {p.min_resolution}p{p.cutoff_resolution ? `→${p.cutoff_resolution}p` : ""}
                      </span>
                      {p.require_hdr && (
                        <span className="rounded-md bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          HDR ✦
                        </span>
                      )}
                      {!p.require_hdr && p.prefer_hdr && (
                        <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          HDR préféré
                        </span>
                      )}
                    </div>
                    {/* Tags row */}
                    <div className="flex flex-wrap gap-1">
                      {p.preferred_sources.map((s) => (
                        <span key={s} className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                          {s}
                        </span>
                      ))}
                      {p.preferred_codecs.map((c) => (
                        <span key={c} className="rounded-md bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                          {c}
                        </span>
                      ))}
                      {p.preferred_languages.map((l) => (
                        <span key={l} className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          {LANGUAGE_OPTIONS.find((o) => o.value === l)?.label ?? l}
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
                      onClick={() => setEditingId(editingId === p.id ? null : p.id)}
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
