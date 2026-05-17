/**
 * Shared helpers used across library sub-routers.
 * Exported for use in libraryListRoutes, libraryMetaRoutes, libraryGrabRoutes, etc.
 */

export function computeTotalSizeBytes(
  files: { sizeBytes: bigint }[],
  episodes: { files: { sizeBytes: bigint }[] }[],
): string | null {
  let total = 0n;
  for (const f of files) total += f.sizeBytes;
  for (const ep of episodes) for (const f of ep.files) total += f.sizeBytes;
  return total === 0n ? null : total.toString();
}

export function mapLibraryMedia(item: {
  id: number;
  tmdbId: number;
  type: string;
  title: string;
  sortTitle: string | null;
  year: number | null;
  status: string;
  monitored: boolean;
  posterUrl: string | null;
  overview: string | null;
  digitalReleaseDate: Date | null;
  qualityProfileId: number | null;
  searchAttempts: number;
  qualityProfile: { id: number; name: string } | null;
  downloadHistories?: { grabbedAt: Date }[];
  addedAt: Date;
  updatedAt: Date;
  files?: { sizeBytes: bigint }[];
  episodes?: { files: { sizeBytes: bigint }[] }[];
}) {
  return {
    id: item.id,
    tmdb_id: item.tmdbId,
    type: item.type,
    title: item.title,
    sort_title: item.sortTitle,
    year: item.year,
    status: item.status,
    monitored: item.monitored,
    poster_url: item.posterUrl,
    overview: item.overview,
    digital_release_date: item.digitalReleaseDate?.toISOString() ?? null,
    quality_profile_id: item.qualityProfileId,
    search_attempts: item.searchAttempts,
    quality_profile: item.qualityProfile
      ? { id: item.qualityProfile.id, name: item.qualityProfile.name }
      : null,
    added_at: item.addedAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
    last_grabbed_at:
      item.downloadHistories?.[0]?.grabbedAt.toISOString() ?? null,
    total_size_bytes: computeTotalSizeBytes(
      item.files ?? [],
      item.episodes ?? [],
    ),
  };
}

export const libraryMediaInclude = {
  qualityProfile: { select: { id: true, name: true } },
  downloadHistories: {
    orderBy: { grabbedAt: "desc" as const },
    take: 1,
    select: { grabbedAt: true },
  },
  files: { select: { sizeBytes: true } },
  episodes: {
    include: {
      files: { select: { sizeBytes: true } },
    },
  },
} as const;
