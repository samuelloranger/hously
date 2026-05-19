import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Plus, Trash2, Pencil } from "lucide-react";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";

function faviconUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return `${DASHBOARD_ENDPOINTS.FAVICON}?domain=${encodeURIComponent(hostname)}`;
  } catch {
    return null;
  }
}
import { Dialog } from "@/components/dialog";
import {
  useQuickLinks,
  useUpdateQuickLinks,
} from "@/pages/_component/useQuickLinks";
import { useCurrentUser } from "@/lib/auth/useAuth";
import { cn } from "@/lib/utils";
import type { QuickLink } from "@hously/shared/types";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function LinkTile({ link }: { link: QuickLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors group"
    >
      <div className="w-8 h-8 flex items-center justify-center">
        {faviconUrl(link.url) ? (
          <img
            src={faviconUrl(link.url)!}
            alt=""
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <Link2
          className={`w-5 h-5 text-zinc-400 ${faviconUrl(link.url) ? "hidden" : ""}`}
        />
      </div>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 text-center line-clamp-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
        {link.label}
      </span>
    </a>
  );
}

interface EditRowProps {
  link: QuickLink;
  onChange: (updated: QuickLink) => void;
  onRemove: () => void;
}

function EditRow({ link, onChange, onRemove }: EditRowProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={link.label}
        onChange={(e) =>
          onChange({ ...link, label: e.target.value.slice(0, 32) })
        }
        placeholder={t("dashboard.quickLinks.labelPlaceholder")}
        className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
      />
      <input
        type="url"
        value={link.url}
        onChange={(e) =>
          onChange({ ...link, url: e.target.value.slice(0, 512) })
        }
        placeholder={t("dashboard.quickLinks.urlPlaceholder")}
        className="flex-[2] min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
      />
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EditModal({
  links,
  onClose,
}: {
  links: QuickLink[];
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [draft, setDraft] = useState<QuickLink[]>(links);
  const { mutate, isPending } = useUpdateQuickLinks();

  const addLink = () => {
    if (draft.length >= 20) return;
    setDraft((d) => [...d, { id: generateId(), label: "", url: "" }]);
  };

  const updateLink = (idx: number, updated: QuickLink) => {
    setDraft((d) => d.map((l, i) => (i === idx ? updated : l)));
  };

  const removeLink = (idx: number) => {
    setDraft((d) => d.filter((_, i) => i !== idx));
  };

  const save = () => {
    const valid = draft.filter((l) => l.label.trim() && l.url.trim());
    mutate(valid, { onSuccess: onClose });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {draft.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
            {t("dashboard.quickLinks.empty")}
          </p>
        )}
        {draft.map((link, idx) => (
          <EditRow
            key={link.id}
            link={link}
            onChange={(updated) => updateLink(idx, updated)}
            onRemove={() => removeLink(idx)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={addLink}
          disabled={draft.length >= 20}
          className="flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
          {t("dashboard.quickLinks.addLink")}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            {t("dashboard.quickLinks.cancel")}
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {isPending
              ? t("dashboard.quickLinks.saving")
              : t("dashboard.quickLinks.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuickLinksPanel() {
  const { t } = useTranslation("common");
  const { data, isPending } = useQuickLinks();
  const { data: user } = useCurrentUser();
  const [editing, setEditing] = useState(false);

  const links = data?.quick_links ?? [];
  const isAdmin = user?.is_admin ?? false;

  if (isPending) return null;
  if (links.length === 0 && !isAdmin) return null;

  return (
    <>
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
            <Link2
              className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
              strokeWidth={2}
            />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {t("dashboard.quickLinks.title")}
            </h3>
          </div>
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              <Pencil size={12} />
              {t("dashboard.quickLinks.edit")}
            </button>
          )}
        </div>

        <div className="p-3">
          {links.length === 0 ? (
            <button
              onClick={() => setEditing(true)}
              className={cn(
                "w-full py-6 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed",
                "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500",
                "hover:border-violet-400 hover:text-violet-500 dark:hover:border-violet-600 dark:hover:text-violet-400 transition-colors",
              )}
            >
              <Plus size={20} />
              <span className="text-xs font-medium">
                {t("dashboard.quickLinks.addFirst")}
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {links.map((link) => (
                <LinkTile key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog
        isOpen={editing}
        onClose={() => setEditing(false)}
        title={t("dashboard.quickLinks.dialogTitle")}
      >
        <EditModal links={links} onClose={() => setEditing(false)} />
      </Dialog>
    </>
  );
}
