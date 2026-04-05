import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAddQbittorrentMagnet,
  useAddQbittorrentTorrentFile,
  useDashboardQbittorrentCategories,
  useDashboardQbittorrentTags,
} from "@/hooks/useDashboard";
import { mergeQbittorrentFiles, toOptionalQbittorrentString, toOptionalQbittorrentTags, toggleQbittorrentTagSelection } from "@hously/shared/utils";
import {
  ChevronDown,
  File,
  FolderOpen,
  Magnet,
  Plus,
  Tag,
  Upload,
  X,
} from "lucide-react";

type Mode = "magnet" | "file";

export function AddTorrentPanel() {
  const { t } = useTranslation("common");

  const addMagnetMutation = useAddQbittorrentMagnet();
  const addFileMutation = useAddQbittorrentTorrentFile();
  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("magnet");
  const [magnet, setMagnet] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories = categoriesQuery.data?.categories ?? [];
  const availableTags = tagsQuery.data?.tags ?? [];
  const canInteract =
    !addMagnetMutation.isPending && !addFileMutation.isPending;
  const hasCategoryOrTags = categories.length > 0 || availableTags.length > 0;

  const handleAddMagnet = () => {
    const value = magnet.trim();
    if (!value) return;
    addMagnetMutation.mutate(
      {
        magnet: value,
        category: toOptionalQbittorrentString(selectedCategory),
        tags: toOptionalQbittorrentTags(selectedTags),
      },
      {
        onSuccess: (res) => {
          if (res.success) setMagnet("");
        },
      },
    );
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => mergeQbittorrentFiles(prev, files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const torrentFiles = Array.from(files).filter(
      (f) =>
        f.name.endsWith(".torrent") || f.type === "application/x-bittorrent",
    );
    if (torrentFiles.length > 0) {
      const dt = new DataTransfer();
      torrentFiles.forEach((f) => dt.items.add(f));
      setSelectedFiles((prev) => mergeQbittorrentFiles(prev, dt.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitFiles = () => {
    if (selectedFiles.length === 0) return;
    addFileMutation.mutate(
      {
        torrents: selectedFiles,
        category: toOptionalQbittorrentString(selectedCategory),
        tags: toOptionalQbittorrentTags(selectedTags),
      },
      {
        onSuccess: (res) => {
          if (res.success) setSelectedFiles([]);
        },
      },
    );
  };

  const canSubmit =
    mode === "magnet" ? magnet.trim().length > 0 : selectedFiles.length > 0;

  const isPending =
    mode === "magnet" ? addMagnetMutation.isPending : addFileMutation.isPending;
  const error =
    mode === "magnet" ? addMagnetMutation.error : addFileMutation.error;

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {t("dashboard.qbittorrent.addTorrent")}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          {/* Mode tabs */}
          <div className="flex border-b border-neutral-100 dark:border-neutral-800">
            {(["magnet", "file"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                  mode === m
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                }`}
              >
                {m === "magnet" ? <Magnet size={13} /> : <Upload size={13} />}
                {m === "magnet"
                  ? t("dashboard.qbittorrent.addMagnet", "Magnet link")
                  : t("dashboard.qbittorrent.addTorrentFile", ".torrent file")}
                {mode === m && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {/* Magnet input */}
            {mode === "magnet" && (
              <input
                value={magnet}
                onChange={(e) => setMagnet(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMagnet()}
                placeholder={t(
                  "dashboard.qbittorrent.magnetPlaceholder",
                  "magnet:?xt=urn:btih:...",
                )}
                className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2.5 text-sm font-mono text-neutral-900 dark:text-neutral-100 placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-500 transition disabled:opacity-50"
                disabled={!canInteract}
              />
            )}

            {/* File drop zone */}
            {mode === "file" && (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 cursor-pointer transition-all ${
                    isDragging
                      ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-950/50"
                  }`}
                >
                  <Upload
                    size={18}
                    className={
                      isDragging ? "text-indigo-500" : "text-neutral-400"
                    }
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {t("torrents.clickToSelect", "Click to select")}
                    </span>{" "}
                    {t("torrents.orDrop", "or drag & drop")}
                  </p>
                  <p className="text-[11px] text-neutral-400">.torrent</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".torrent,application/x-bittorrent"
                    onChange={handleFilesSelected}
                    className="sr-only"
                    disabled={!canInteract}
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2"
                      >
                        <File size={12} className="shrink-0 text-indigo-400" />
                        <span className="flex-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
                          {file.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={!canInteract}
                          className="shrink-0 rounded-md p-0.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                          aria-label={t(
                            "torrents.removeFile",
                            "Remove {{name}}",
                            { name: file.name },
                          )}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Category & Tags */}
            {hasCategoryOrTags && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {categories.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                      <FolderOpen size={11} />
                      {t("dashboard.qbittorrent.category", "Category")}
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      disabled={!canInteract}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-50 transition"
                    >
                      <option value="">
                        {t("dashboard.qbittorrent.noCategory", "No category")}
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {availableTags.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                      <Tag size={11} />
                      {t("dashboard.qbittorrent.tags", "Tags")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => {
                        const active = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setSelectedTags((prev) =>
                                toggleQbittorrentTagSelection(prev, tag),
                              )
                            }
                            disabled={!canInteract}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                              active
                                ? "bg-indigo-500 text-white"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {active && <X size={9} />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {error.message}
              </p>
            )}

            {/* Single submit button */}
            <button
              onClick={mode === "magnet" ? handleAddMagnet : handleSubmitFiles}
              disabled={!canInteract || !canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {isPending ? (
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {isPending
                ? t("common.loading", "Loading...")
                : mode === "magnet"
                  ? t("dashboard.qbittorrent.add", "Add")
                  : selectedFiles.length > 1
                    ? t(
                        "torrents.submitTorrentFiles",
                        "Submit {{count}} files",
                        { count: selectedFiles.length },
                      )
                    : t("torrents.submitTorrentFile", "Submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
