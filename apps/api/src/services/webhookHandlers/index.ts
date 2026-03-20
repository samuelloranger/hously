import type { WebhookHandler, WebhookResult } from './types';

// Generic helper to ensure all values are strings
function ensureStrings(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value == null ? '' : String(value);
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return String(value);
    }
  }

  return '';
}

function joinValues(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map(entry => String(entry))
      .filter(Boolean)
      .join(', ');
  }

  return typeof value === 'string' ? value : '';
}

function formatTicks(value: unknown): string {
  const ticks = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(ticks) || ticks <= 0) return '';

  const totalSeconds = Math.floor(ticks / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeJellyfinEventType(eventType: string): string {
  const mappings: Record<string, string> = {
    ItemRemoved: 'ItemDeleted',
    UserAdded: 'UserCreated',
  };

  return mappings[eventType] || eventType;
}

// Radarr webhook handler
const handleRadarrWebhook: WebhookHandler = payload => {
  const eventType = (payload.eventType as string) || '';
  const variables: Record<string, unknown> = {};

  // Movie information
  const movie = (payload.movie as Record<string, unknown>) || {};
  if (movie) {
    variables.movie_name = movie.title || 'Unknown Movie';
    variables.year = movie.year || '';
    variables.imdb_id = movie.imdbId || '';
    variables.tmdb_id = movie.tmdbId || '';
  }

  // File information
  const movieFile = (payload.movieFile as Record<string, unknown>) || {};
  if (movieFile) {
    variables.file_name = movieFile.relativePath || movieFile.path || '';
    variables.quality = movieFile.quality || '';
    variables.quality_version = movieFile.qualityVersion || '';
  }

  // Remote movie (for some events)
  const remoteMovie = (payload.remoteMovie as Record<string, unknown>) || {};
  if (remoteMovie.title) {
    variables.movie_name = remoteMovie.title;
    variables.year = remoteMovie.year || variables.year;
  }

  // Health/Application events
  if (eventType === 'HealthIssue' || eventType === 'HealthRestored') {
    variables.message = payload.message || '';
    variables.level = payload.level || '';
    variables.type = payload.type || '';
  }

  if (eventType === 'ApplicationUpdate') {
    variables.version = `${payload.previousVersion || ''} → ${payload.newVersion || ''}`;
    variables.previous_version = payload.previousVersion || '';
    variables.new_version = payload.newVersion || '';
  }

  if (eventType === 'ManualInteractionRequired') {
    variables.message = payload.message || '';
  }

  variables.download_client = payload.downloadClient || '';
  variables.download_id = payload.downloadId || '';

  // Release information
  const release = (payload.release as Record<string, unknown>) || {};
  if (release) {
    variables.release_title = release.title || '';
    variables.release_quality = release.quality || '';
    variables.indexer = release.indexer || '';
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Sonarr webhook handler
const handleSonarrWebhook: WebhookHandler = payload => {
  const eventType = (payload.eventType as string) || '';
  const variables: Record<string, unknown> = {};

  // Series information
  const series = (payload.series as Record<string, unknown>) || {};
  if (series) {
    variables.series_title = series.title || 'Unknown Series';
    variables.year = series.year || '';
    variables.tvdb_id = series.tvdbId || '';
    variables.imdb_id = series.imdbId || '';
  }

  // Episode information
  const episodes = (payload.episodes as Array<Record<string, unknown>>) || [];
  if (episodes.length > 0) {
    const ep = episodes[0];
    variables.season_number = ep.seasonNumber || '';
    variables.episode_number = ep.episodeNumber || '';
    variables.episode_title = ep.title || '';
  }

  // Episode file
  const episodeFile = (payload.episodeFile as Record<string, unknown>) || {};
  if (episodeFile) {
    variables.file_name = episodeFile.relativePath || episodeFile.path || '';
    variables.quality = episodeFile.quality || '';
    variables.quality_version = episodeFile.qualityVersion || '';
  }

  // Health/Application events
  if (eventType === 'HealthIssue' || eventType === 'HealthRestored') {
    variables.message = payload.message || '';
    variables.level = payload.level || '';
    variables.type = payload.type || '';
  }

  if (eventType === 'ApplicationUpdate') {
    variables.version = `${payload.previousVersion || ''} → ${payload.newVersion || ''}`;
    variables.previous_version = payload.previousVersion || '';
    variables.new_version = payload.newVersion || '';
  }

  if (eventType === 'ManualInteractionRequired') {
    variables.message = payload.message || '';
  }

  variables.download_client = payload.downloadClient || '';
  variables.download_id = payload.downloadId || '';

  // Release information
  const release = (payload.release as Record<string, unknown>) || {};
  if (release) {
    variables.release_title = release.title || '';
    variables.release_quality = release.quality || '';
    variables.indexer = release.indexer || '';
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Prowlarr webhook handler
const handleProwlarrWebhook: WebhookHandler = payload => {
  const eventType = (payload.eventType as string) || '';
  const variables: Record<string, unknown> = {};

  // Health events
  if (eventType === 'HealthIssue' || eventType === 'HealthRestored') {
    variables.message = payload.message || '';
    variables.level = payload.level || '';
    variables.type = payload.type || '';
  }

  if (eventType === 'ApplicationUpdate') {
    variables.version = `${payload.previousVersion || ''} → ${payload.newVersion || ''}`;
    variables.previous_version = payload.previousVersion || '';
    variables.new_version = payload.newVersion || '';
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Jellyfin webhook handler
const handleJellyfinWebhook: WebhookHandler = payload => {
  const item = asRecord(payload.Item || payload.item);
  const user = asRecord(payload.User || payload.user);
  const server = asRecord(payload.Server || payload.server);
  const playbackInfo = asRecord(payload.PlaybackInfo || payload.playbackInfo);
  const providerIds = asRecord(item?.ProviderIds || item?.providerIds || payload.ProviderIds || payload.providerIds);

  let eventType = normalizeJellyfinEventType(
    (payload.NotificationType as string) ||
      (payload.notificationType as string) ||
      (payload.Event as string) ||
      (payload.event as string) ||
      (payload.Type as string) ||
      (payload.type as string) ||
      ''
  );

  if (!eventType) {
    if (item) {
      eventType = playbackInfo || payload.PlaybackPosition ? 'PlaybackStop' : 'ItemAdded';
    } else if (user) {
      eventType = 'UserCreated';
    } else {
      eventType = 'Notification';
    }
  }

  const rawName = firstString(payload.Name, payload.name, payload.Title, payload.title, item?.Name, item?.name);
  const seriesName = firstString(payload.SeriesName, payload.seriesName, item?.SeriesName, item?.seriesName);
  const seasonNum = firstString(payload.SeasonNumber00, payload.SeasonNumber, payload.seasonNumber);
  const episodeNum = firstString(payload.EpisodeNumber00, payload.EpisodeNumber, payload.episodeNumber);
  const itemType = firstString(payload.ItemType, payload.itemType, item?.Type, item?.type);

  // Build a smart title: "SeriesName - S01E05" for episodes, raw name for everything else
  let title = rawName || 'Unknown Item';
  if (itemType === 'Episode' && seriesName) {
    if (seasonNum && episodeNum) {
      title = `${seriesName} - S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}`;
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
    Overview: firstString(payload.Overview, payload.overview, item?.Overview, item?.overview),
    ReleaseDate: firstString(payload.ReleaseDate, payload.releaseDate, item?.PremiereDate, item?.premiereDate),
    DateAdded: firstString(payload.DateAdded, payload.dateAdded, item?.DateCreated, item?.dateCreated),
    Genres: joinValues(payload.Genres || payload.genres || item?.Genres || item?.genres),
    Runtime:
      firstString(payload.Runtime, payload.runtime, payload.RunTime, payload.runTime) ||
      formatTicks(item?.RunTimeTicks || item?.runTimeTicks || payload.RunTimeTicks || payload.runTimeTicks),
    PlaybackPosition:
      firstString(payload.PlaybackPosition, payload.playbackPosition) ||
      formatTicks(playbackInfo?.PositionTicks || playbackInfo?.positionTicks),
    NotificationUsername:
      firstString(payload.NotificationUsername, payload.notificationUsername, user?.Name, user?.name) || 'Unknown User',
    NotificationUserId: firstString(payload.NotificationUserId, payload.notificationUserId, user?.Id, user?.id),
    ItemId: firstString(payload.ItemId, payload.itemId, item?.Id, item?.id),
    ItemType: itemType,
    ServerId: firstString(payload.ServerId, payload.serverId, server?.Id, server?.id),
    ServerName: firstString(payload.ServerName, payload.serverName, server?.Name, server?.name) || 'Jellyfin Server',
    ServerUrl: firstString(payload.ServerUrl, payload.serverUrl),
    Provider_tmdb: firstString(payload.Provider_tmdb, payload.provider_tmdb, providerIds?.Tmdb, providerIds?.tmdb),
    Provider_tvdb: firstString(payload.Provider_tvdb, payload.provider_tvdb, providerIds?.Tvdb, providerIds?.tvdb),
    Provider_imdb: firstString(payload.Provider_imdb, payload.provider_imdb, providerIds?.Imdb, providerIds?.imdb),
    Year: firstString(payload.Year, payload.year, item?.ProductionYear, item?.productionYear, item?.Year),
  };

  // Legacy aliases kept for existing custom templates.
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

// Plex webhook handler
const handlePlexWebhook: WebhookHandler = payload => {
  let eventType = (payload.event as string) || (payload.Event as string) || (payload.notification_type as string) || '';

  if (!eventType) {
    if (payload.Metadata || payload.metadata) {
      eventType = payload.Player || payload.player ? 'media.play' : 'library.new';
    } else if (payload.Device || payload.device) {
      eventType = 'device.new';
    } else {
      eventType = 'PlexEvent';
    }
  }

  // Normalize event types
  const eventTypeMapping: Record<string, string> = {
    'playback.started': 'media.play',
    'playback.paused': 'media.pause',
    'playback.resumed': 'media.resume',
    'playback.stopped': 'media.stop',
  };
  eventType = eventTypeMapping[eventType] || eventType;

  const variables: Record<string, unknown> = {};

  // Metadata information
  const metadata = (payload.Metadata || payload.metadata) as Record<string, unknown> | undefined;
  if (metadata) {
    variables.item_name = metadata.title || metadata.Title || 'Unknown Item';
    variables.item_type = metadata.type || metadata.Type || '';
    variables.item_id = metadata.ratingKey || metadata.RatingKey || '';
    variables.year = metadata.year || metadata.Year || '';
    variables.library_name = metadata.librarySectionTitle || metadata.LibrarySectionTitle || '';
  }

  // User information
  const user = (payload.User || payload.user) as Record<string, unknown> | undefined;
  if (user) {
    variables.user_name = user.title || user.Title || user.username || 'Unknown User';
    variables.user_id = user.id || user.Id || '';
  }

  // Server information
  const server = (payload.Server || payload.server) as Record<string, unknown> | undefined;
  if (server) {
    variables.server_name = server.title || server.Title || server.name || 'Plex Server';
  }

  // Player information
  const player = (payload.Player || payload.player) as Record<string, unknown> | undefined;
  if (player) {
    variables.player_name = player.title || player.Title || 'Unknown Player';
    variables.player_platform = player.platform || player.Platform || '';
  }

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Kopia webhook handler
// Kopia sends: Subject as HTTP header, body as JSON { body: "plain text report" }
// The body text is structured with lines like "Path: ...", "Status: ...", "Size: ..."
const handleKopiaWebhook: WebhookHandler = payload => {
  const bodyText = (payload.body as string) || '';

  // Parse structured fields from the body text
  const extract = (key: string) => {
    const match = bodyText.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : '';
  };

  const path = extract('Path');
  const status = extract('Status');
  const duration = extract('Duration');
  const size = extract('Size');
  const files = extract('Files');
  const directories = extract('Directories');
  const subject = (payload.subject as string) || '';

  // Determine event type from status field
  const statusLower = status.toLowerCase();
  const eventType =
    statusLower.includes('fail') || statusLower.includes('error')
      ? 'BackupError'
      : statusLower.includes('warn')
        ? 'BackupWarning'
        : 'BackupSuccess';

  const variables: Record<string, unknown> = {
    subject,
    path,
    status,
    duration,
    size,
    files,
    directories,
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Uptime Kuma webhook handler
const handleUptimekumaWebhook: WebhookHandler = payload => {
  const eventType = (payload.event as string) || 'StatusChange';
  const variables: Record<string, unknown> = {};

  // Monitor information
  const monitor = (payload.monitor || payload.Monitor) as Record<string, unknown> | undefined;
  if (monitor) {
    variables.monitor_name = monitor.name || monitor.Name || 'Unknown Monitor';
    variables.monitor_url = monitor.url || monitor.URL || '';
    variables.monitor_type = monitor.type || monitor.Type || '';
  }

  // Heartbeat information
  const heartbeat = (payload.heartbeat || payload.Heartbeat) as Record<string, unknown> | undefined;
  if (heartbeat) {
    variables.status = heartbeat.status === 1 ? 'UP' : 'DOWN';
    variables.ping = heartbeat.ping || '';
    variables.message = heartbeat.msg || heartbeat.message || '';
    variables.duration = heartbeat.duration || '';
  }

  // Direct fields
  variables.msg = (payload.msg as string) || (payload.message as string) || '';

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Hously webhook handler for app updates
const handleHouslyWebhook: WebhookHandler = payload => {
  const eventType = (payload.event_type as string) || (payload.event as string) || 'AppUpdate';
  const variables: Record<string, unknown> = {
    version: payload.version || 'unknown',
    message: payload.message || 'Hously has been updated.',
    environment: payload.environment || 'production',
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// cross-seed webhook handler
const handleCrossSeedWebhook: WebhookHandler = payload => {
  const extra = asRecord(payload.extra);
  const eventType = firstString(extra?.event, payload.event, payload.eventType).toUpperCase() || 'RESULTS';
  const searchee = asRecord(extra?.searchee);

  const variables: Record<string, unknown> = {
    event: eventType,
    title: firstString(payload.title),
    body: firstString(payload.body),
    name: firstString(extra?.name, payload.title, searchee?.title, searchee?.name) || 'Unknown release',
    source: firstString(extra?.source, searchee?.source) || 'unknown',
    info_hashes: joinValues(extra?.infoHashes),
    trackers: joinValues(extra?.trackers),
    tracker: firstString(Array.isArray(extra?.trackers) ? extra?.trackers[0] : '', searchee?.tracker),
    result: firstString(extra?.result),
    paused: firstString(extra?.paused),
    decisions: joinValues(extra?.decisions),
    category: firstString(searchee?.category),
    client: firstString(searchee?.client),
    save_path: firstString(searchee?.path, searchee?.savePath),
    searchee_source: firstString(searchee?.source),
    client_host: firstString(searchee?.clientHost),
    searchee_trackers: joinValues(searchee?.trackers),
    tags: joinValues(searchee?.tags),
    info_hash: firstString(searchee?.infoHash),
    length: firstString(searchee?.length),
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};

// Generic webhook handler for arbitrary title/body notifications
const handleGenericWebhook: WebhookHandler = payload => {
  const title = firstString(payload.title, payload.Title, payload.subject, payload.Subject);
  const body = firstString(payload.body, payload.Body, payload.message, payload.Message);

  if (!title && !body) return null;

  return {
    event_type: 'GENERIC',
    template_variables: ensureStrings({
      ...payload,
      title: title || 'Generic notification',
      body: body || 'No details provided.',
    }),
    original_payload: payload,
  };
};

// Handler registry
export const webhookHandlers: Record<string, WebhookHandler> = {
  radarr: handleRadarrWebhook,
  sonarr: handleSonarrWebhook,
  prowlarr: handleProwlarrWebhook,
  jellyfin: handleJellyfinWebhook,
  plex: handlePlexWebhook,
  kopia: handleKopiaWebhook,
  uptimekuma: handleUptimekumaWebhook,
  hously: handleHouslyWebhook,
  generic: handleGenericWebhook,
  'cross-seed': handleCrossSeedWebhook,
  crossseed: handleCrossSeedWebhook,
};
