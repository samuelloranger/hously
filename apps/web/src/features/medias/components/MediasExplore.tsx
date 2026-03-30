import { TmdbMediaSearchPanel } from './TmdbMediaSearchPanel';
import { DiscoverPanel } from './DiscoverPanel';

export function MediasExplore() {
  return (
    <div className="space-y-6 pb-10">
      <TmdbMediaSearchPanel onAdded={() => {}} />
      <DiscoverPanel onAdded={() => {}} />
    </div>
  );
}
