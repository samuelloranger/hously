import { CHORES_ENDPOINTS } from "@hously/shared/endpoints";

function stripApiSuffix(baseUrl: string): string {
  return baseUrl.replace(/\/api\/?$/, "");
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function getChoreImageUrl(
  imagePath: string | null | undefined,
  baseUrl: string = "",
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return joinUrl(stripApiSuffix(baseUrl), CHORES_ENDPOINTS.IMAGE(imagePath));
}

export function getChoreThumbnailUrl(
  imagePath: string | null | undefined,
  baseUrl: string = "",
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return joinUrl(
    stripApiSuffix(baseUrl),
    CHORES_ENDPOINTS.THUMBNAIL(imagePath),
  );
}
