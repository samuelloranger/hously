import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  useLibrary,
  useUpdateLibraryQualityProfile,
  useSearchLibraryMovie,
  useUpgradeLibraryMedia,
} from "@/features/medias/hooks/useLibrary";
import { useQualityProfilesList } from "@/pages/settings/useQualityProfiles";
import { Card, SectionLabel } from "./LibrarySharedUI";
import { LibraryUpgradeModal } from "./LibraryUpgradeModal";

interface LibraryQualityProfileSectionProps {
  libraryId: number;
  onUpgradeManualSearch?: () => void;
}

export function LibraryQualityProfileSection({
  libraryId,
  onUpgradeManualSearch,
}: LibraryQualityProfileSectionProps) {
  const { t } = useTranslation("common");
  const { data: libList } = useLibrary(undefined, { staleTime: 0, gcTime: 0 });
  const { data: profilesData } = useQualityProfilesList({
    staleTime: 0,
    gcTime: 0,
  });
  const updateProfile = useUpdateLibraryQualityProfile();
  const searchMovieMut = useSearchLibraryMovie();
  const upgradeMedia = useUpgradeLibraryMedia();

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeEpisodes, setUpgradeEpisodes] = useState<number | undefined>();

  const mediaRow = useMemo(
    () => libList?.items.find((i) => i.id === libraryId),
    [libList?.items, libraryId],
  );

  const profiles = profilesData?.profiles ?? [];

  const handleAutoSearch = async () => {
    try {
      await upgradeMedia.mutateAsync({ id: libraryId, mode: "auto" });
      toast.success(t("medias.library.upgradeModal.autoSearchStarted"));
    } catch {
      toast.error(t("medias.library.upgradeModal.autoSearchFailed"));
    } finally {
      setUpgradeModalOpen(false);
    }
  };

  const handleManualSearch = () => {
    setUpgradeModalOpen(false);
    onUpgradeManualSearch?.();
  };

  return (
    <Card>
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <SectionLabel>
              {t("library.management.qualityProfile")}
            </SectionLabel>
            <select
              value={mediaRow?.quality_profile_id ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const qid = v === "" ? null : parseInt(v, 10);
                void updateProfile
                  .mutateAsync({
                    id: libraryId,
                    body: { quality_profile_id: qid },
                  })
                  .then((result) => {
                    if (result.item.needs_upgrade) {
                      setUpgradeEpisodes(result.item.affected_episodes);
                      setUpgradeModalOpen(true);
                    } else {
                      toast.success(
                        t("library.management.qualityProfileUpdated"),
                      );
                    }
                  })
                  .catch(() => {
                    toast.error(
                      t("library.management.qualityProfileUpdateFailed"),
                    );
                  });
              }}
              disabled={updateProfile.isPending || !mediaRow}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">
                {t("library.management.qualityProfileNone")}
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {mediaRow?.type === "movie" && mediaRow.status === "wanted" && (
            <button
              type="button"
              onClick={() => {
                void searchMovieMut
                  .mutateAsync({ id: libraryId })
                  .then((r) => {
                    if (r.grabbed)
                      toast.success(t("library.management.grabbed"));
                    else
                      toast.error(
                        r.reason ?? t("library.management.grabFailed"),
                      );
                  })
                  .catch(() => toast.error(t("library.management.grabFailed")));
              }}
              disabled={searchMovieMut.isPending}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-500 disabled:opacity-50 transition-colors shrink-0"
            >
              <Search size={10} />
              {t("library.management.searchNow")}
            </button>
          )}
        </div>
      </div>

      <LibraryUpgradeModal
        open={upgradeModalOpen}
        mediaType={mediaRow?.type ?? "movie"}
        affectedEpisodes={upgradeEpisodes}
        onAutoSearch={() => void handleAutoSearch()}
        onManualSearch={handleManualSearch}
        onDismiss={() => setUpgradeModalOpen(false)}
        isLoading={upgradeMedia.isPending}
      />
    </Card>
  );
}
