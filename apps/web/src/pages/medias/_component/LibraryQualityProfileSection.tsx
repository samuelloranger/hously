import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  useLibrary,
  useUpdateLibraryQualityProfile,
  useSearchLibraryMovie,
} from "@/hooks/useLibrary";
import { useQualityProfilesList } from "@/hooks/useQualityProfiles";
import { Card, SectionLabel } from "./LibrarySharedUI";

interface LibraryQualityProfileSectionProps {
  libraryId: number;
}

export function LibraryQualityProfileSection({
  libraryId,
}: LibraryQualityProfileSectionProps) {
  const { t } = useTranslation("common");
  const { data: libList } = useLibrary(undefined, { staleTime: 0, gcTime: 0 });
  const { data: profilesData } = useQualityProfilesList({
    staleTime: 0,
    gcTime: 0,
  });
  const updateProfile = useUpdateLibraryQualityProfile();
  const searchMovieMut = useSearchLibraryMovie();

  const mediaRow = useMemo(
    () => libList?.items.find((i) => i.id === libraryId),
    [libList?.items, libraryId],
  );

  const profiles = profilesData?.profiles ?? [];

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
                void updateProfile.mutateAsync({
                  id: libraryId,
                  body: { quality_profile_id: qid },
                });
              }}
              disabled={updateProfile.isPending || !mediaRow}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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

          {mediaRow?.type === "movie" &&
            mediaRow.status === "wanted" &&
            mediaRow.search_attempts < 5 && (
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
                    .catch(() =>
                      toast.error(t("library.management.grabFailed")),
                    );
                }}
                disabled={searchMovieMut.isPending}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
              >
                <Search size={10} />
                {t("library.management.searchNow")}
              </button>
            )}
        </div>
      </div>
    </Card>
  );
}
