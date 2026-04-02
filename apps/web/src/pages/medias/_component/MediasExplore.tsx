import { TmdbMediaSearchPanel } from '@/pages/medias/_component/TmdbMediaSearchPanel';
import { DiscoverPanel } from '@/pages/medias/_component/DiscoverPanel';
import { AiSuggestionsPanel } from '@/pages/medias/_component/AiSuggestionsPanel';

export function MediasExplore() {
  return (
    <div className="space-y-6 pb-10">
      <AiSuggestionsPanel onAdded={() => {}} />
      <TmdbMediaSearchPanel onAdded={() => {}} />
      <DiscoverPanel onAdded={() => {}} />
    </div>
  );
}
