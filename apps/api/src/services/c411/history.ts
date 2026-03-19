import { prisma } from '../../db';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../../utils/plugins/normalizers';

type MediaService = 'radarr' | 'sonarr';

type ArrConfig = {
  apiKey: string;
  baseUrl: string;
};

async function loadArrConfig(service: MediaService): Promise<ArrConfig> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: service, enabled: true },
    select: { config: true },
  });

  if (!plugin?.config) {
    throw new Error(`${service === 'radarr' ? 'Radarr' : 'Sonarr'} plugin not configured`);
  }

  const normalized =
    service === 'radarr'
      ? normalizeRadarrConfig(plugin.config)
      : normalizeSonarrConfig(plugin.config);

  if (!normalized) {
    throw new Error(`${service === 'radarr' ? 'Radarr' : 'Sonarr'} plugin not configured`);
  }

  return {
    apiKey: normalized.api_key,
    baseUrl: normalized.website_url.replace(/\/$/, ''),
  };
}

async function fetchArrJson<T>(config: ArrConfig, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': config.apiKey, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Arr API error (${res.status}) for ${url.pathname}`);
  }

  return res.json() as Promise<T>;
}

async function postArrJson<T>(config: ArrConfig, path: string, body: any): Promise<T> {
  const url = new URL(path, config.baseUrl);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Api-Key': config.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Arr API post error (${res.status}) for ${url.pathname}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchArrHistory(
  service: MediaService,
  sourceId: number,
  seasonNumber: number | null,
) {
  const config = await loadArrConfig(service);
  
  if (service === 'radarr') {
    return fetchArrJson<any[]>(config, '/api/v3/history/movie', { movieId: String(sourceId) });
  } else {
    const params: Record<string, string> = { seriesId: String(sourceId) };
    if (seasonNumber != null) {
      params.seasonNumber = String(seasonNumber);
    }
    const result = await fetchArrJson<any>(config, '/api/v3/history/series', params);
    // Sonarr history API is paginated, handle accordingly
    return result.records || result;
  }
}

export async function triggerArrReprocess(
  service: MediaService,
  sourceId: number,
  _historyEventId?: number,
) {
  const config = await loadArrConfig(service);

  if (service === 'radarr') {
    // Basic rescan/refresh for movie
    return postArrJson(config, '/api/v3/command', {
      name: 'RescanMovie',
      movieId: sourceId,
    });
  } else {
    // Basic rescan/refresh for series
    return postArrJson(config, '/api/v3/command', {
      name: 'RescanSeries',
      seriesId: sourceId,
    });
  }
}
