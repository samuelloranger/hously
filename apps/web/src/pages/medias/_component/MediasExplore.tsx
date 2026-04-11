import { useState } from "react";
import { Compass, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TmdbMediaSearchPanel } from "@/pages/medias/_component/TmdbMediaSearchPanel";
import { DiscoverPanel } from "@/pages/medias/_component/DiscoverPanel";

type Tab = "discover" | "search";

const TABS: { id: Tab; icon: typeof Compass; labelKey: string }[] = [
  { id: "search", icon: Search, labelKey: "medias.tabs.search" },
  { id: "discover", icon: Compass, labelKey: "medias.tabs.discover" },
];

export function MediasExplore() {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <div className="pb-10">
      {/* ── Mobile tab bar (hidden md+) ─────────────────────── */}
      <div className="md:hidden mb-6 -mx-4 px-4">
        <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 backdrop-blur-sm">
          {TABS.map(({ id, icon: Icon, labelKey }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={[
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200",
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-300",
                ].join(" ")}
              >
                <Icon
                  size={13}
                  className={active ? "text-indigo-300" : "text-current"}
                  aria-hidden
                />
                <span className="truncate">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panels — TMDB search first (desktop + mobile priority) ─ */}
      <div className="space-y-6">
        <div className={activeTab !== "search" ? "hidden md:block" : ""}>
          <TmdbMediaSearchPanel onAdded={() => {}} />
        </div>

        <div className={activeTab !== "discover" ? "hidden md:block" : ""}>
          <DiscoverPanel onAdded={() => {}} />
        </div>
      </div>
    </div>
  );
}
