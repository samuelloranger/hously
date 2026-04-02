import { useState } from 'react';
import { Compass, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TmdbMediaSearchPanel } from '@/pages/medias/_component/TmdbMediaSearchPanel';
import { DiscoverPanel } from '@/pages/medias/_component/DiscoverPanel';
import { AiSuggestionsPanel } from '@/pages/medias/_component/AiSuggestionsPanel';

type Tab = 'discover' | 'search' | 'ai';

const TABS: { id: Tab; icon: typeof Compass; labelKey: string }[] = [
  { id: 'discover', icon: Compass, labelKey: 'medias.tabs.discover' },
  { id: 'search',   icon: Search,  labelKey: 'medias.tabs.search'   },
  { id: 'ai',       icon: Sparkles, labelKey: 'medias.tabs.ai'      },
];

export function MediasExplore() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<Tab>('discover');

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
                  'relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200',
                  active
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300',
                ].join(' ')}
              >
                <Icon
                  size={13}
                  className={active ? 'text-indigo-300' : 'text-current'}
                  aria-hidden
                />
                <span className="truncate">{t(labelKey)}</span>
                {active && id === 'ai' && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panels ─────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* AI — shown on desktop always; on mobile only when active */}
        <div className={activeTab !== 'ai' ? 'hidden md:block' : ''}>
          <AiSuggestionsPanel onAdded={() => {}} />
        </div>

        {/* Search */}
        <div className={activeTab !== 'search' ? 'hidden md:block' : ''}>
          <TmdbMediaSearchPanel onAdded={() => {}} />
        </div>

        {/* Discover */}
        <div className={activeTab !== 'discover' ? 'hidden md:block' : ''}>
          <DiscoverPanel onAdded={() => {}} />
        </div>
      </div>
    </div>
  );
}
