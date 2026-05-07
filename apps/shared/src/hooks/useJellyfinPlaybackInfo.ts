import { useQuery } from "@tanstack/react-query";
import type { JellyfinPlaybackInfo } from "../types/jellyfin";
import { jellyfinPlaybackUrlPath } from "../constants/integrationsEndpoints";

export function jellyfinPlaybackQueryKey(itemId: string) {
  return ["integrations", "jellyfin", "playback", itemId] as const;
}

export function useJellyfinPlaybackInfo(
  itemId: string | undefined,
  fetcher: <T>(path: string) => Promise<T>,
) {
  return useQuery({
    queryKey: itemId
      ? jellyfinPlaybackQueryKey(itemId)
      : ["integrations", "jellyfin", "playback", "__"],
    queryFn: () =>
      fetcher<JellyfinPlaybackInfo>(jellyfinPlaybackUrlPath(itemId!)),
    enabled: Boolean(itemId),
    // The user's resume position changes between sessions; never serve stale.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}
