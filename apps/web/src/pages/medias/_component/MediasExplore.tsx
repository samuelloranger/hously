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
        />
      </div>

      {/* ── Panels — TMDB search first (desktop + mobile priority) ─ */}
      <div className="space-y-6">
        <div className={activeTab !== "search" ? "hidden md:block" : ""}>
          <TmdbMediaSearchPanel />
        </div>

        <div className={activeTab !== "discover" ? "hidden md:block" : ""}>
          <DiscoverPanel />
        </div>
      </div>
    </div>
  );
}
