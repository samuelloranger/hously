import { TmdbMediaSearchPanel } from './TmdbMediaSearchPanel';
import { DiscoverPanel } from './DiscoverPanel';
import { AiSuggestionsPanel } from './AiSuggestionsPanel';

export function MediasExplore() {
  return (
    <div className="space-y-6 pb-10">
      <AiSuggestionsPanel onAdded={() => {}} />
      <TmdbMediaSearchPanel onAdded={() => {}} />
      <DiscoverPanel onAdded={() => {}} />
    </div>
  );
}
