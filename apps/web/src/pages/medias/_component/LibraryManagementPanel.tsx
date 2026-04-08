import { LibraryQualityProfileSection } from "./LibraryQualityProfileSection";
import { LibraryMediaSection } from "./LibraryMediaSection";
import { LibraryDownloadHistorySection } from "./LibraryDownloadHistorySection";
import { LibraryActionsSection } from "./LibraryActionsSection";

interface LibraryManagementPanelProps {
  libraryId: number;
  onDeleted?: () => void;
  onSearchEpisode?: (ep: {
    id: number;
    season: number;
    episode: number;
    title: string | null;
  }) => void;
  onSearchSeason?: (season: number) => void;
}

export function LibraryManagementPanel({
  libraryId,
  onDeleted,
  onSearchEpisode,
  onSearchSeason,
}: LibraryManagementPanelProps) {
  return (
    <div className="px-3 pb-5 pt-2 space-y-3">
      <LibraryQualityProfileSection libraryId={libraryId} />
      <LibraryMediaSection
        libraryId={libraryId}
        onSearchEpisode={onSearchEpisode}
        onSearchSeason={onSearchSeason}
      />
      <LibraryDownloadHistorySection libraryId={libraryId} />
      <LibraryActionsSection libraryId={libraryId} onDeleted={onDeleted} />
    </div>
  );
}
