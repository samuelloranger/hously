import type { WebhookHandler } from "./types";
import { ensureStrings } from "./utils";

export const handlePlexWebhook: WebhookHandler = (payload) => {
  let eventType =
    (payload.event as string) ||
    (payload.Event as string) ||
    (payload.notification_type as string) ||
    "";

  if (!eventType) {
    if (payload.Metadata || payload.metadata) {
      eventType =
        payload.Player || payload.player ? "media.play" : "library.new";
    } else if (payload.Device || payload.device) {
      eventType = "device.new";
    } else {
      eventType = "PlexEvent";
    }
  }

  const eventTypeMapping: Record<string, string> = {
    "playback.started": "media.play",
    "playback.paused": "media.pause",
    "playback.resumed": "media.resume",
    "playback.stopped": "media.stop",
  };
  eventType = eventTypeMapping[eventType] || eventType;

  const variables: Record<string, unknown> = {};

  const metadata = (payload.Metadata || payload.metadata) as
    | Record<string, unknown>
    | undefined;
  if (metadata) {
    variables.item_name = metadata.title || metadata.Title || "Unknown Item";
    variables.item_type = metadata.type || metadata.Type || "";
    variables.item_id = metadata.ratingKey || metadata.RatingKey || "";
    variables.year = metadata.year || metadata.Year || "";
    variables.library_name =
      metadata.librarySectionTitle || metadata.LibrarySectionTitle || "";
  }

  const user = (payload.User || payload.user) as
    | Record<string, unknown>
    | undefined;
  if (user) {
    variables.user_name =
      user.title || user.Title || user.username || "Unknown User";
    variables.user_id = user.id || user.Id || "";
  }

  const server = (payload.Server || payload.server) as
    | Record<string, unknown>
    | undefined;
  if (server) {
    variables.server_name =
      server.title || server.Title || server.name || "Plex Server";
  }

  const player = (payload.Player || payload.player) as
    | Record<string, unknown>
    | undefined;
  if (player) {
    variables.player_name = player.title || player.Title || "Unknown Player";
    variables.player_platform = player.platform || player.Platform || "";
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
