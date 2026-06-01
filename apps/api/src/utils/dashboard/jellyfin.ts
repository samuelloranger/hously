import type { JellyfinLatestItem } from "@hously/api/types/jellyfin";
import {
  toRecord,
  toStringArray,
  toStringOrNull,
  toYearOrNull,
} from "@hously/shared/utils";
export const mapJellyfinApiItem = (
  rawItem: unknown,
  jellyfinWebsiteUrl: string,
): JellyfinLatestItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const itemType = toStringOrNull(item.Type);
  const itemName = toStringOrNull(item.Name);
  const seriesName = toStringOrNull(item.SeriesName);
  const albumName = toStringOrNull(item.Album);

  const isEpisode = itemType?.toLowerCase() === "episode";
  const title = isEpisode
    ? seriesName || itemName || albumName
    : itemName || seriesName || albumName;
  const subtitle = isEpisode ? itemName || null : null;
  if (!title) return null;

  const sourceItemId = toStringOrNull(item.Id);
  const id = sourceItemId || `${title}-${itemType || "item"}`;
  const year =
    toYearOrNull(item.ProductionYear) || toYearOrNull(item.Year) || null;
  const addedAt = toStringOrNull(item.DateCreated);
  const parentBackdropItemId = toStringOrNull(item.ParentBackdropItemId);
  const backdropTag = toStringArray(item.BackdropImageTags)[0] || null;
  const parentBackdropTag =
    toStringArray(item.ParentBackdropImageTags)[0] || null;
  const imageTags = toRecord(item.ImageTags);
  const primaryTag = toStringOrNull(imageTags?.Primary);
  const itemUrl = sourceItemId
    ? `${jellyfinWebsiteUrl}/web/index.html#!/details?id=${encodeURIComponent(sourceItemId)}`
    : null;
  const bannerUrl = sourceItemId
    ? (() => {
        const params = new URLSearchParams({
          itemId: sourceItemId,
          preferred: "backdrop",
        });
        if (parentBackdropItemId)
          params.set("parentBackdropItemId", parentBackdropItemId);
        if (backdropTag) params.set("backdropTag", backdropTag);
        if (parentBackdropTag)
          params.set("parentBackdropTag", parentBackdropTag);
        if (primaryTag) params.set("primaryTag", primaryTag);
        return `/api/dashboard/jellyfin/image?${params.toString()}`;
      })()
    : null;
  const posterUrl = sourceItemId
    ? (() => {
        const params = new URLSearchParams({
          itemId: sourceItemId,
          preferred: "primary",
        });
        if (primaryTag) params.set("primaryTag", primaryTag);
        return `/api/dashboard/jellyfin/image?${params.toString()}`;
      })()
    : null;

  const overview = toStringOrNull(item.Overview);

  return {
    id,
    title,
    subtitle,
    overview,
    item_url: itemUrl,
    banner_url: bannerUrl,
    poster_url: posterUrl,
    item_type: itemType,
    year,
    added_at: addedAt,
  };
};

/**
 * Cap the dimensions/quality of a Jellyfin image URL before proxying it.
 * Posters (Primary) render small in dashboard widgets; backdrops a bit wider.
 * Without this, Jellyfin serves full-resolution originals (hundreds of KB).
 */
export function appendJellyfinImageSizing(
  url: URL,
  imageType: "Primary" | "Backdrop",
): void {
  if (imageType === "Primary") {
    url.searchParams.set("fillWidth", "320");
    url.searchParams.set("quality", "90");
  } else {
    url.searchParams.set("fillWidth", "640");
    url.searchParams.set("quality", "80");
  }
}
