import { RECIPES_ENDPOINTS } from "../endpoints/recipes";
import { CHORES_ENDPOINTS } from "../endpoints/chores";

function stripApiSuffix(baseUrl: string): string {
  return baseUrl.replace(/\/api\/?$/, "");
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function getRecipeImageUrl(
  imagePath: string | null | undefined,
  baseUrl: string = "",
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return joinUrl(stripApiSuffix(baseUrl), RECIPES_ENDPOINTS.IMAGE(imagePath));
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
