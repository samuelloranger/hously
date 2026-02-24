import type { WebhookHandler, WebhookResult } from './types';

// Generic helper to ensure all values are strings
function ensureStrings(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value == null ? '' : String(value);
  }
  return result;
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
  let eventType =
    (payload.NotificationType as string) ||
    (payload.notificationType as string) ||
    (payload.Event as string) ||
    (payload.event as string) ||
    (payload.Type as string) ||
    (payload.type as string) ||
    '';

  if (!eventType) {
    if (payload.Item || payload.item) {
      eventType = payload.PlaybackInfo || payload.playbackInfo ? 'PlaybackProgress' : 'ItemEvent';
    } else if (payload.User || payload.user) {
      eventType = 'UserEvent';
    } else {
      eventType = 'JellyfinEvent';
    }
  }

  const variables: Record<string, unknown> = {};

  // Item information
  const item = (payload.Item || payload.item) as Record<string, unknown> | undefined;
  if (item) {
    variables.item_name = item.Name || item.name || 'Unknown Item';
    variables.item_type = item.Type || item.type || '';
    variables.item_id = item.Id || item.id || '';
    variables.year = item.ProductionYear || item.productionYear || item.Year || '';

    const providerIds = (item.ProviderIds || item.providerIds || {}) as Record<string, unknown>;
    variables.imdb_id = providerIds.Imdb || providerIds.imdb || '';
    variables.tmdb_id = providerIds.Tmdb || providerIds.tmdb || '';
  }

  // User information
  const user = (payload.User || payload.user) as Record<string, unknown> | undefined;
  if (user) {
    variables.user_name = user.Name || user.name || 'Unknown User';
    variables.user_id = user.Id || user.id || '';
  }

  // Server information
  const server = (payload.Server || payload.server) as Record<string, unknown> | undefined;
  if (server) {
    variables.server_name = server.Name || server.name || 'Jellyfin Server';
  }

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
  const eventType = statusLower.includes('fail') || statusLower.includes('error')
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
};
