import { useState } from "react";
import { Compass, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TmdbMediaSearchPanel } from "@/pages/medias/_component/TmdbMediaSearchPanel";
import { DiscoverPanel } from "@/pages/medias/_component/DiscoverPanel";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

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
        <SegmentedTabs
          items={TABS.map(({ id, icon, labelKey }) => ({
            id,
            icon,
            label: t(labelKey),
          }))}
          value={activeTab}
          onChange={setActiveTab}
          containerClassName="flex w-full rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1 dark:border-white/[0.07] dark:bg-white/[0.03] backdrop-blur-sm"
          itemClassName="flex-1 px-3 py-2.5 text-xs font-semibold duration-200"
          inactiveItemClassName="text-neutral-600 hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
          activeItemClassName="dark:bg-white/10 dark:text-white"
          activeIconClassName="text-indigo-600 dark:text-indigo-300"
        />
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
