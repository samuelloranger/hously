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
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";
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
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-neutral-800/60 ring-1 ring-transparent hover:bg-neutral-700/60 hover:ring-primary-500/40 transition-colors group"
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-900/60">
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
          className={`w-5 h-5 text-neutral-400 ${faviconUrl(link.url) ? "hidden" : ""}`}
        />
      </div>
      <span className="text-xs font-medium text-neutral-300 text-center line-clamp-1 group-hover:text-neutral-100 transition-colors">
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
        className="flex-1 min-w-0 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-100 placeholder:text-neutral-400"
      />
      <input
        type="url"
        value={link.url}
        onChange={(e) =>
          onChange({ ...link, url: e.target.value.slice(0, 512) })
        }
        placeholder={t("dashboard.quickLinks.urlPlaceholder")}
        className="flex-[2] min-w-0 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-100 placeholder:text-neutral-400"
      />
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-900/20 transition-colors"
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
          <p className="text-sm text-neutral-400 text-center py-4">
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

      <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
        <button
          onClick={addLink}
          disabled={draft.length >= 20}
          className="flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
          {t("dashboard.quickLinks.addLink")}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {t("dashboard.quickLinks.cancel")}
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
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
      <WidgetShell>
        <WidgetHeader
          icon={Link2}
          title={t("dashboard.quickLinks.title")}
          right={
            isAdmin ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-primary-400 transition-colors"
              >
                <Pencil size={12} />
                {t("dashboard.quickLinks.edit")}
              </button>
            ) : undefined
          }
        />

        <div className="p-3">
          {links.length === 0 ? (
            <button
              onClick={() => setEditing(true)}
              className={cn(
                "w-full py-6 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed",
                "border-neutral-700 text-neutral-500",
                "hover:border-primary-600 hover:text-primary-400 transition-colors",
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
      </WidgetShell>

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
