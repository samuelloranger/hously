import type { WebhookHandler } from "./types";
import {
  asRecord,
  ensureStrings,
  firstString,
  formatTicks,
  joinValues,
  normalizeJellyfinEventType,
} from "./utils";

export const handleJellyfinWebhook: WebhookHandler = (payload) => {
  const item = asRecord(payload.Item || payload.item);
  const user = asRecord(payload.User || payload.user);
  const server = asRecord(payload.Server || payload.server);
  const playbackInfo = asRecord(payload.PlaybackInfo || payload.playbackInfo);
  const providerIds = asRecord(
    item?.ProviderIds ||
      item?.providerIds ||
      payload.ProviderIds ||
      payload.providerIds,
  );

  let eventType = normalizeJellyfinEventType(
    (payload.NotificationType as string) ||
      (payload.notificationType as string) ||
      (payload.Event as string) ||
      (payload.event as string) ||
      (payload.Type as string) ||
      (payload.type as string) ||
      "",
  );

  if (!eventType) {
    if (item) {
      eventType =
        playbackInfo || payload.PlaybackPosition ? "PlaybackStop" : "ItemAdded";
    } else if (user) {
      eventType = "UserCreated";
    } else {
      eventType = "Notification";
    }
  }

  const rawName = firstString(
    payload.Name,
    payload.name,
    payload.Title,
    payload.title,
    item?.Name,
    item?.name,
  );
  const seriesName = firstString(
    payload.SeriesName,
    payload.seriesName,
    item?.SeriesName,
    item?.seriesName,
  );
  const seasonNum = firstString(
    payload.SeasonNumber00,
    payload.SeasonNumber,
    payload.seasonNumber,
  );
  const episodeNum = firstString(
    payload.EpisodeNumber00,
    payload.EpisodeNumber,
    payload.episodeNumber,
  );
  const itemType = firstString(
    payload.ItemType,
    payload.itemType,
    item?.Type,
    item?.type,
  );

  let title = rawName || "Unknown Item";
  if (itemType === "Episode" && seriesName) {
    if (seasonNum && episodeNum) {
      title = `${seriesName} - S${seasonNum.padStart(2, "0")}E${episodeNum.padStart(2, "0")}`;
    } else {
      title = `${seriesName} - ${rawName}`;
    }
  }

  const variables: Record<string, unknown> = {
    NotificationType: eventType,
    Title: title,
    SeriesName: seriesName,
    SeasonNumber: seasonNum,
    EpisodeNumber: episodeNum,
    Overview: firstString(
      payload.Overview,
      payload.overview,
      item?.Overview,
      item?.overview,
    ),
    ReleaseDate: firstString(
      payload.ReleaseDate,
      payload.releaseDate,
      item?.PremiereDate,
      item?.premiereDate,
    ),
    DateAdded: firstString(
      payload.DateAdded,
      payload.dateAdded,
      item?.DateCreated,
      item?.dateCreated,
    ),
    Genres: joinValues(
      payload.Genres || payload.genres || item?.Genres || item?.genres,
    ),
    Runtime:
      firstString(
        payload.Runtime,
        payload.runtime,
        payload.RunTime,
        payload.runTime,
      ) ||
      formatTicks(
        item?.RunTimeTicks ||
          item?.runTimeTicks ||
          payload.RunTimeTicks ||
          payload.runTimeTicks,
      ),
    PlaybackPosition:
      firstString(payload.PlaybackPosition, payload.playbackPosition) ||
      formatTicks(playbackInfo?.PositionTicks || playbackInfo?.positionTicks),
    NotificationUsername:
      firstString(
        payload.NotificationUsername,
        payload.notificationUsername,
        user?.Name,
        user?.name,
      ) || "Unknown User",
    NotificationUserId: firstString(
      payload.NotificationUserId,
      payload.notificationUserId,
      user?.Id,
      user?.id,
    ),
    ItemId: firstString(payload.ItemId, payload.itemId, item?.Id, item?.id),
    ItemType: itemType,
    ServerId: firstString(
      payload.ServerId,
      payload.serverId,
      server?.Id,
      server?.id,
    ),
    ServerName:
      firstString(
        payload.ServerName,
        payload.serverName,
        server?.Name,
        server?.name,
      ) || "Jellyfin Server",
    ServerUrl: firstString(payload.ServerUrl, payload.serverUrl),
    Provider_tmdb: firstString(
      payload.Provider_tmdb,
      payload.provider_tmdb,
      providerIds?.Tmdb,
      providerIds?.tmdb,
    ),
    Provider_tvdb: firstString(
      payload.Provider_tvdb,
      payload.provider_tvdb,
      providerIds?.Tvdb,
      providerIds?.tvdb,
    ),
    Provider_imdb: firstString(
      payload.Provider_imdb,
      payload.provider_imdb,
      providerIds?.Imdb,
      providerIds?.imdb,
    ),
    Year: firstString(
      payload.Year,
      payload.year,
      item?.ProductionYear,
      item?.productionYear,
      item?.Year,
    ),
  };

  variables.item_name = variables.Title;
  variables.item_type = variables.ItemType;
  variables.item_id = variables.ItemId;
  variables.user_name = variables.NotificationUsername;
  variables.user_id = variables.NotificationUserId;
  variables.server_name = variables.ServerName;
  variables.tmdb_id = variables.Provider_tmdb;
  variables.tvdb_id = variables.Provider_tvdb;
  variables.imdb_id = variables.Provider_imdb;
  variables.year = variables.Year;
  variables.runtime = variables.Runtime;
  variables.playback_position = variables.PlaybackPosition;
  variables.notification_type = variables.NotificationType;
  variables.overview = variables.Overview;
  variables.release_date = variables.ReleaseDate;
  variables.date_added = variables.DateAdded;
  variables.genres = variables.Genres;

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
