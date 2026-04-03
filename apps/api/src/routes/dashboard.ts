import { Elysia, t } from "elysia";
import { prisma } from "../db";
import { auth } from "../auth";
import { formatIso } from "../utils";
import { getJsonCache, setJsonCache } from "../services/cache";
import {
  buildQbittorrentDisabledSnapshot,
  fetchQbittorrentSnapshot,
} from "../services/qbittorrent/torrents";
import type { QbittorrentDashboardSnapshot } from "../services/qbittorrent/client";
import { normalizeQbittorrentConfig } from "../services/qbittorrent/config";

export interface JellyfinLatestItem {
  id: string;
  title: string;
  subtitle: string | null;
  item_url: string | null;
  banner_url: string | null;
  poster_url: string | null;
  item_type: string | null;
  year: number | null;
  added_at: string | null;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  release_date: string | null;
  poster_url: string | null;
  tmdb_url: string;
  providers: DashboardUpcomingProvider[];
}

interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

interface ArrPluginStatus {
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
}

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

interface RadarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
}

interface SonarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

interface ScrutinyPluginConfig {
  website_url: string;
}

interface NetdataPluginConfig {
  website_url: string;
}

interface DashboardScrutinyDrive {
  id: string;
  model_name: string | null;
  serial_number: string | null;
  capacity_bytes: number | null;
  device_status: number | null;
  temperature_c: number | null;
  power_on_hours: number | null;
  firmware: string | null;
  form_factor: string | null;
  updated_at: string | null;
}

interface DashboardScrutinySummary {
  total_drives: number;
  healthy_drives: number;
  warning_drives: number;
  avg_temp_c: number | null;
  hottest_temp_c: number | null;
}

export interface DashboardScrutinySummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: DashboardScrutinySummary;
  drives: DashboardScrutinyDrive[];
  error?: string;
}

interface DashboardNetdataDiskUsage {
  mount_point: string;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

interface DashboardNetdataSummary {
  cpu_percent: number | null;
  ram_used_mib: number | null;
  ram_total_mib: number | null;
  ram_used_percent: number | null;
  load_1: number | null;
  load_5: number | null;
  load_15: number | null;
  network_in_kbps: number | null;
  network_out_kbps: number | null;
}

export interface DashboardNetdataSummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: DashboardNetdataSummary;
  disks: DashboardNetdataDiskUsage[];
  error?: string;
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const toYearOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toStringOrNull(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeJellyfinConfig = (
  config: unknown,
): JellyfinPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!apiKey || !websiteUrl) return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

const toPositiveIntOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const normalizeRadarrConfig = (config: unknown): RadarrPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  const rootFolderPath = toStringOrNull(cfg.root_folder_path);
  const qualityProfileId = toPositiveIntOrNull(cfg.quality_profile_id);
  if (!apiKey || !websiteUrl || !rootFolderPath || !qualityProfileId)
    return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
  };
};

const normalizeSonarrConfig = (config: unknown): SonarrPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  const rootFolderPath = toStringOrNull(cfg.root_folder_path);
  const qualityProfileId = toPositiveIntOrNull(cfg.quality_profile_id);
  const languageProfileId = toPositiveIntOrNull(cfg.language_profile_id);
  if (
    !apiKey ||
    !websiteUrl ||
    !rootFolderPath ||
    !qualityProfileId ||
    !languageProfileId
  )
    return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
    language_profile_id: languageProfileId,
  };
};

const normalizeScrutinyConfig = (
  config: unknown,
): ScrutinyPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!websiteUrl) return null;

  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

const normalizeNetdataConfig = (
  config: unknown,
): NetdataPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!websiteUrl) return null;

  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const TMDB_PROVIDER_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";
const TMDB_WEB_BASE_URL = "https://www.themoviedb.org";
const TMDB_UPCOMING_CACHE_TTL_SECONDS = 24 * 60 * 60;
const WEATHER_CACHE_TTL_SECONDS = 30 * 60;
const OPEN_METEO_GEOCODING_URL =
  "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoGeocodeResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface OpenMeteoGeocodeResponse {
  results?: OpenMeteoGeocodeResult[];
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
  };
}

export interface DashboardWeatherResponse {
  address: string;
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureF: number;
  feelsLikeF: number;
  weatherCode: number;
  isDay: boolean;
  conditionLabel: string;
}

const normalizeWeatherAddress = (address: string): string =>
  address.trim().replace(/\s+/g, " ").toLowerCase();

const getWeatherLabel = (weatherCode: number): string => {
  if (weatherCode === 0) return "Clear sky";
  if (weatherCode === 1) return "Mostly clear";
  if (weatherCode === 2) return "Partly cloudy";
  if (weatherCode === 3) return "Overcast";
  if (weatherCode === 45 || weatherCode === 48) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "Rain";
  if ([71, 73, 75, 77].includes(weatherCode)) return "Snow";
  if ([80, 81, 82].includes(weatherCode)) return "Rain showers";
  if ([85, 86].includes(weatherCode)) return "Snow showers";
  if (weatherCode === 95) return "Thunderstorm";
  if ([96, 99].includes(weatherCode)) return "Thunderstorm with hail";
  return "Current conditions";
};

const formatWeatherLocationName = (result: OpenMeteoGeocodeResult): string =>
  [result.name, result.admin1, result.country].filter(Boolean).join(", ");

const fetchAddressWeather = async (
  address: string,
): Promise<DashboardWeatherResponse> => {
  const geocodeUrl = new URL(OPEN_METEO_GEOCODING_URL);
  geocodeUrl.searchParams.set("name", address);
  geocodeUrl.searchParams.set("count", "1");
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("format", "json");

  const geocodeRes = await fetch(geocodeUrl.toString());
  if (!geocodeRes.ok) {
    throw new Error("Unable to search for this address right now.");
  }
  const geocodeData = (await geocodeRes.json()) as OpenMeteoGeocodeResponse;
  const location = geocodeData.results?.[0];
  if (!location) {
    throw new Error("No weather location found for that address.");
  }

  const forecastUrl = new URL(OPEN_METEO_FORECAST_URL);
  forecastUrl.searchParams.set("latitude", String(location.latitude));
  forecastUrl.searchParams.set("longitude", String(location.longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  forecastUrl.searchParams.set("temperature_unit", "fahrenheit");
  forecastUrl.searchParams.set("timezone", "auto");

  const forecastRes = await fetch(forecastUrl.toString());
  if (!forecastRes.ok) {
    throw new Error("Unable to load weather for this address right now.");
  }
  const forecastData = (await forecastRes.json()) as OpenMeteoForecastResponse;
  if (!forecastData.current) {
    throw new Error("Weather data is currently unavailable for this address.");
  }

  return {
    address,
    locationName: formatWeatherLocationName(location),
    latitude: location.latitude,
    longitude: location.longitude,
    temperatureF: forecastData.current.temperature_2m,
    feelsLikeF: forecastData.current.apparent_temperature,
    weatherCode: forecastData.current.weather_code,
    isDay: forecastData.current.is_day === 1,
    conditionLabel: getWeatherLabel(forecastData.current.weather_code),
  };
};

const getArrPluginStatus = async (): Promise<ArrPluginStatus> => {
  const [radarrPlugin, sonarrPlugin] = await Promise.all([
    prisma.plugin.findFirst({
      where: { type: "radarr" },
      select: { enabled: true },
    }),
    prisma.plugin.findFirst({
      where: { type: "sonarr" },
      select: { enabled: true },
    }),
  ]);

  return {
    radarr_enabled: Boolean(radarrPlugin?.enabled),
    sonarr_enabled: Boolean(sonarrPlugin?.enabled),
  };
};

const toIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const mapTmdbItem = (
  rawItem: unknown,
  mediaType: "movie" | "tv",
): DashboardUpcomingItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const numericId =
    typeof item.id === "number" && Number.isFinite(item.id)
      ? Math.trunc(item.id)
      : null;
  if (!numericId) return null;

  const title = toStringOrNull(item.title) || toStringOrNull(item.name);
  if (!title) return null;

  const releaseDate =
    toStringOrNull(item.release_date) ||
    toStringOrNull(item.first_air_date) ||
    toStringOrNull(item.air_date);
  const posterPath = toStringOrNull(item.poster_path);

  return {
    id: `${mediaType}-${numericId}`,
    title,
    media_type: mediaType,
    release_date: releaseDate,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : null,
    tmdb_url: `${TMDB_WEB_BASE_URL}/${mediaType}/${numericId}`,
    providers: [],
  };
};

const parseTmdbNumericId = (itemId: string): number | null => {
  const [, numericPart] = itemId.split("-", 2);
  const numericId = numericPart ? parseInt(numericPart, 10) : Number.NaN;
  return Number.isFinite(numericId) ? numericId : null;
};

const fetchTmdbDiscoverPage = async (
  mediaType: "movie" | "tv",
  page: number,
  tmdbApiKey: string,
  todayIso: string,
  oneYearOutIso: string,
): Promise<{ items: DashboardUpcomingItem[]; totalPages: number } | null> => {
  const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set("api_key", tmdbApiKey);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", String(page));

  if (mediaType === "movie") {
    url.searchParams.set("sort_by", "primary_release_date.asc");
    url.searchParams.set("region", "US");
    url.searchParams.set("release_date.gte", todayIso);
    url.searchParams.set("release_date.lte", oneYearOutIso);
    url.searchParams.set("with_release_type", "4");
    url.searchParams.set("with_original_language", "en");
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("include_video", "false");
  } else {
    url.searchParams.set("sort_by", "first_air_date.asc");
    url.searchParams.set("first_air_date.gte", todayIso);
    url.searchParams.set("first_air_date.lte", oneYearOutIso);
    url.searchParams.set("include_null_first_air_dates", "false");
    url.searchParams.set("with_origin_country", "US");
    url.searchParams.set("with_original_language", "en");
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results : [];
  const totalPagesRaw =
    typeof data.total_pages === "number" ? Math.trunc(data.total_pages) : 1;
  const totalPages = Math.max(
    1,
    Number.isFinite(totalPagesRaw) ? totalPagesRaw : 1,
  );

  const items = results
    .map((item) => mapTmdbItem(item, mediaType))
    .filter((item): item is DashboardUpcomingItem => !!item);

  return { items, totalPages };
};

const collectTmdbUpcoming = async (
  mediaType: "movie" | "tv",
  requiredCount: number,
  tmdbApiKey: string,
  todayIso: string,
  oneYearOutIso: string,
): Promise<{ items: DashboardUpcomingItem[]; hasMore: boolean } | null> => {
  const items: DashboardUpcomingItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (items.length < requiredCount && page <= totalPages) {
    const response = await fetchTmdbDiscoverPage(
      mediaType,
      page,
      tmdbApiKey,
      todayIso,
      oneYearOutIso,
    );
    if (!response) return null;
    items.push(...response.items);
    totalPages = response.totalPages;
    page += 1;
  }

  return { items, hasMore: page <= totalPages };
};

const getQbittorrentSnapshot =
  async (): Promise<QbittorrentDashboardSnapshot> => {
    const plugin = await prisma.plugin.findFirst({
      where: { type: "qbittorrent" },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      return buildQbittorrentDisabledSnapshot();
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      const disabled = buildQbittorrentDisabledSnapshot(
        "qBittorrent plugin is enabled but not configured",
      );
      return { ...disabled, enabled: true };
    }

    return fetchQbittorrentSnapshot(config, true);
  };

const buildScrutinyDisabledSummary = (
  error?: string,
): DashboardScrutinySummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
  summary: {
    total_drives: 0,
    healthy_drives: 0,
    warning_drives: 0,
    avg_temp_c: null,
    hottest_temp_c: null,
  },
  drives: [],
  ...(error ? { error } : {}),
});

const fetchScrutinySummary =
  async (): Promise<DashboardScrutinySummaryResponse> => {
    const plugin = await prisma.plugin.findFirst({
      where: { type: "scrutiny" },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      return buildScrutinyDisabledSummary();
    }

    const config = normalizeScrutinyConfig(plugin.config);
    if (!config) {
      return {
        ...buildScrutinyDisabledSummary(
          "Scrutiny plugin is enabled but not configured",
        ),
        enabled: true,
      };
    }

    try {
      const summaryUrl = new URL("/api/summary", config.website_url);
      const response = await fetch(summaryUrl.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return {
          ...buildScrutinyDisabledSummary(
            `Scrutiny request failed with status ${response.status}`,
          ),
          enabled: true,
        };
      }

      const payload = (await response.json()) as unknown;
      const root = toRecord(payload);
      const data = toRecord(root?.data);
      const summaryRecord = toRecord(data?.summary);

      if (!summaryRecord) {
        return {
          ...buildScrutinyDisabledSummary("Invalid Scrutiny summary payload"),
          enabled: true,
        };
      }

      const drives = Object.entries(summaryRecord)
        .map(([id, raw]) => {
          const entry = toRecord(raw);
          if (!entry) return null;
          const device = toRecord(entry.device);
          const smart = toRecord(entry.smart);

          const statusRaw = toNumberOrNull(device?.device_status);
          const status = statusRaw == null ? null : Math.trunc(statusRaw);
          const temperatureRaw = toNumberOrNull(smart?.temp);
          const powerOnHoursRaw = toNumberOrNull(smart?.power_on_hours);
          const capacityRaw = toNumberOrNull(device?.capacity);

          const drive: DashboardScrutinyDrive = {
            id,
            model_name: toStringOrNull(device?.model_name),
            serial_number: toStringOrNull(device?.serial_number),
            capacity_bytes:
              capacityRaw == null ? null : Math.trunc(capacityRaw),
            device_status: status,
            temperature_c:
              temperatureRaw == null
                ? null
                : Math.round(temperatureRaw * 10) / 10,
            power_on_hours:
              powerOnHoursRaw == null ? null : Math.trunc(powerOnHoursRaw),
            firmware: toStringOrNull(device?.firmware),
            form_factor: toStringOrNull(device?.form_factor),
            updated_at: toStringOrNull(device?.UpdatedAt),
          };

          return drive;
        })
        .filter((drive): drive is DashboardScrutinyDrive => Boolean(drive))
        .sort((a, b) => {
          if (a.temperature_c == null && b.temperature_c == null) return 0;
          if (a.temperature_c == null) return 1;
          if (b.temperature_c == null) return -1;
          return b.temperature_c - a.temperature_c;
        });

      const totalDrives = drives.length;
      const healthyDrives = drives.filter(
        (drive) => drive.device_status === 0,
      ).length;
      const warningDrives = drives.filter(
        (drive) => drive.device_status != null && drive.device_status !== 0,
      ).length;
      const temperatures = drives
        .map((drive) => drive.temperature_c)
        .filter((temp): temp is number => temp != null);
      const avgTemp =
        temperatures.length > 0
          ? Math.round(
              (temperatures.reduce((sum, temp) => sum + temp, 0) /
                temperatures.length) *
                10,
            ) / 10
          : null;
      const hottestTemp =
        temperatures.length > 0 ? Math.max(...temperatures) : null;
      const updatedAt =
        drives
          .map((drive) => drive.updated_at)
          .find((value): value is string => Boolean(value)) ??
        new Date().toISOString();

      return {
        enabled: true,
        connected: true,
        updated_at: updatedAt,
        summary: {
          total_drives: totalDrives,
          healthy_drives: healthyDrives,
          warning_drives: warningDrives,
          avg_temp_c: avgTemp,
          hottest_temp_c: hottestTemp,
        },
        drives,
      };
    } catch (error) {
      console.error("Error fetching Scrutiny summary:", error);
      return {
        ...buildScrutinyDisabledSummary("Failed to fetch Scrutiny summary"),
        enabled: true,
      };
    }
  };

const buildNetdataDisabledSummary = (
  error?: string,
): DashboardNetdataSummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
  summary: {
    cpu_percent: null,
    ram_used_mib: null,
    ram_total_mib: null,
    ram_used_percent: null,
    load_1: null,
    load_5: null,
    load_15: null,
    network_in_kbps: null,
    network_out_kbps: null,
  },
  disks: [],
  ...(error ? { error } : {}),
});

const valueByLabels = (
  labels: string[],
  row: unknown[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (let i = 1; i < labels.length; i += 1) {
    const label = labels[i];
    const value = toNumberOrNull(row[i]);
    if (!label || value == null) continue;
    result[label] = value;
  }
  return result;
};

const normalizeMetricKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findMetricValue = (
  values: Record<string, number>,
  aliases: string[],
): number | null => {
  const aliasSet = new Set(aliases.map(normalizeMetricKey));
  for (const [key, value] of Object.entries(values)) {
    if (aliasSet.has(normalizeMetricKey(key))) return value;
  }
  return null;
};

const resolveNetworkRates = (
  values: Record<string, number> | null,
): { inKbps: number | null; outKbps: number | null } => {
  if (!values) return { inKbps: null, outKbps: null };

  const inbound = findMetricValue(values, [
    "InOctets",
    "received",
    "in",
    "rx",
    "download",
    "ingress",
  ]);
  const outbound = findMetricValue(values, [
    "OutOctets",
    "sent",
    "out",
    "tx",
    "upload",
    "egress",
  ]);

  return {
    inKbps: inbound != null ? Math.round(Math.abs(inbound) * 10) / 10 : null,
    outKbps: outbound != null ? Math.round(Math.abs(outbound) * 10) / 10 : null,
  };
};

const isPreferredNetInterfaceChart = (chartId: string): boolean => {
  if (!chartId.startsWith("net.")) return false;
  const iface = chartId.slice(4).toLowerCase();
  if (!iface) return false;

  return !/^(lo|docker\d*|br-|veth|virbr|vnet|ifb|tun|tap|cni|flannel|kube|dummy)/.test(
    iface,
  );
};

const fetchNetdataChartLatest = async (
  netdataBaseUrl: string,
  chart: string,
): Promise<Record<string, number> | null> => {
  const dataUrl = new URL("/api/v1/data", netdataBaseUrl);
  dataUrl.searchParams.set("chart", chart);
  dataUrl.searchParams.set("after", "-60");
  dataUrl.searchParams.set("points", "1");
  dataUrl.searchParams.set("format", "json");

  const response = await fetch(dataUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const labels = Array.isArray(payload.labels)
    ? payload.labels.map((label) => (typeof label === "string" ? label : ""))
    : [];
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const row = rows[rows.length - 1];

  if (!Array.isArray(row) || labels.length < 2) return null;
  return valueByLabels(labels, row);
};

const fetchNetdataSummary =
  async (): Promise<DashboardNetdataSummaryResponse> => {
    const plugin = await prisma.plugin.findFirst({
      where: { type: "netdata" },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      return buildNetdataDisabledSummary();
    }

    const config = normalizeNetdataConfig(plugin.config);
    if (!config) {
      return {
        ...buildNetdataDisabledSummary(
          "Netdata plugin is enabled but not configured",
        ),
        enabled: true,
      };
    }

    try {
      const chartsUrl = new URL("/api/v1/charts", config.website_url);
      const chartsResponse = await fetch(chartsUrl.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!chartsResponse.ok) {
        return {
          ...buildNetdataDisabledSummary(
            `Netdata charts request failed with status ${chartsResponse.status}`,
          ),
          enabled: true,
        };
      }

      const chartsPayload = (await chartsResponse.json()) as Record<
        string,
        unknown
      >;
      const charts = toRecord(chartsPayload.charts) ?? {};
      const diskCharts = Object.keys(charts)
        .filter((key) => key.startsWith("disk_space."))
        .sort((a, b) => a.localeCompare(b));
      const netInterfaceCharts = Object.keys(charts)
        .filter((key) => key.startsWith("net."))
        .sort((a, b) => a.localeCompare(b));
      const preferredNetCharts = netInterfaceCharts.filter(
        isPreferredNetInterfaceChart,
      );
      const selectedNetCharts = (
        preferredNetCharts.length > 0
          ? preferredNetCharts
          : netInterfaceCharts.filter(
              (chartId) => !chartId.toLowerCase().startsWith("net.lo"),
            )
      ).slice(0, 12);

      const [cpu, ram, load, systemNet, ...restRows] = await Promise.all([
        fetchNetdataChartLatest(config.website_url, "system.cpu"),
        fetchNetdataChartLatest(config.website_url, "system.ram"),
        fetchNetdataChartLatest(config.website_url, "system.load"),
        fetchNetdataChartLatest(config.website_url, "system.net"),
        ...selectedNetCharts.map((chartId) =>
          fetchNetdataChartLatest(config.website_url, chartId),
        ),
        ...diskCharts.map((chartId) =>
          fetchNetdataChartLatest(config.website_url, chartId),
        ),
      ]);
      const netRows = restRows.slice(0, selectedNetCharts.length);
      const diskRows = restRows.slice(selectedNetCharts.length);

      const systemNetRates = resolveNetworkRates(systemNet);
      const interfaceNetTotals = netRows.reduce(
        (acc, values) => {
          const rates = resolveNetworkRates(values);
          return {
            inKbps: acc!.inKbps + (rates.inKbps ?? 0),
            outKbps: acc!.outKbps + (rates.outKbps ?? 0),
          };
        },
        { inKbps: 0, outKbps: 0 },
      );
      const hasInterfaceNetData = netRows.some((values) => {
        const rates = resolveNetworkRates(values);
        return rates.inKbps != null || rates.outKbps != null;
      });

      const ramUsed = ram?.used ?? null;
      const ramFree = ram?.free ?? null;
      const ramCached = ram?.cached ?? null;
      const ramBuffers = ram?.buffers ?? null;
      const ramTotal =
        ram?.total ??
        (ramUsed != null && ramFree != null
          ? ramUsed + ramFree + (ramCached ?? 0) + (ramBuffers ?? 0)
          : null);
      const ramUsedPercent =
        ramUsed != null && ramTotal != null && ramTotal > 0
          ? Math.round((ramUsed / ramTotal) * 1000) / 10
          : null;

      const disks: DashboardNetdataDiskUsage[] = diskRows
        .map((values, index) => {
          if (!values) return null;
          const used = values.used ?? 0;
          const avail = values.avail ?? 0;
          const reserved =
            values["reserved for root"] ?? values.reserved_for_root ?? 0;
          const total = used + avail + reserved;
          const chartName = diskCharts[index] ?? "disk_space.unknown";
          const mountPointRaw = chartName.slice("disk_space.".length);
          const mountPoint = decodeURIComponent(mountPointRaw);
          const usedPercent =
            total > 0 ? Math.round((used / total) * 1000) / 10 : 0;

          return {
            mount_point: mountPoint || "/",
            used_gib: Math.round(used * 10) / 10,
            avail_gib: Math.round(avail * 10) / 10,
            reserved_gib: Math.round(reserved * 10) / 10,
            used_percent: usedPercent,
          };
        })
        .filter((entry): entry is DashboardNetdataDiskUsage => Boolean(entry));

      return {
        enabled: true,
        connected: true,
        updated_at: new Date().toISOString(),
        summary: {
          cpu_percent:
            cpu?.user != null && cpu?.system != null
              ? Math.round((cpu.user + cpu.system) * 10) / 10
              : null,
          ram_used_mib: ramUsed != null ? Math.round(ramUsed * 10) / 10 : null,
          ram_total_mib:
            ramTotal != null ? Math.round(ramTotal * 10) / 10 : null,
          ram_used_percent: ramUsedPercent,
          load_1:
            load?.load1 != null ? Math.round(load.load1 * 100) / 100 : null,
          load_5:
            load?.load5 != null ? Math.round(load.load5 * 100) / 100 : null,
          load_15:
            load?.load15 != null ? Math.round(load.load15 * 100) / 100 : null,
          network_in_kbps:
            systemNetRates.inKbps ??
            (hasInterfaceNetData ? interfaceNetTotals!.inKbps : null),
          network_out_kbps:
            systemNetRates.outKbps ??
            (hasInterfaceNetData ? interfaceNetTotals!.outKbps : null),
        },
        disks,
      };
    } catch (error) {
      console.error("Error fetching Netdata summary:", error);
      return {
        ...buildNetdataDisabledSummary("Failed to fetch Netdata summary"),
        enabled: true,
      };
    }
  };

const fetchTmdbProviders = async (
  mediaType: "movie" | "tv",
  tmdbId: number,
  tmdbApiKey: string,
): Promise<DashboardUpcomingProvider[]> => {
  try {
    const providersUrl = new URL(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`,
    );
    providersUrl.searchParams.set("api_key", tmdbApiKey);
    const response = await fetch(providersUrl.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as Record<string, unknown>;
    const results = toRecord(data.results);
    const us = toRecord(results?.US);
    if (!us) return [];

    const categoryOrder = ["flatrate", "free", "ads", "rent", "buy"] as const;
    const selected: DashboardUpcomingProvider[] = [];
    const seen = new Set<number>();

    for (const category of categoryOrder) {
      const entries = Array.isArray(us[category]) ? us[category] : [];
      for (const rawProvider of entries) {
        const provider = toRecord(rawProvider);
        if (!provider) continue;

        const providerId =
          typeof provider.provider_id === "number"
            ? Math.trunc(provider.provider_id)
            : null;
        const providerName = toStringOrNull(provider.provider_name);
        const logoPath = toStringOrNull(provider.logo_path);
        if (!providerId || !providerName || !logoPath || seen.has(providerId))
          continue;

        selected.push({
          id: providerId,
          name: providerName,
          logo_url: `${TMDB_PROVIDER_LOGO_BASE_URL}${logoPath}`,
        });
        seen.add(providerId);

        if (selected.length >= 4) return selected;
      }
    }

    return selected;
  } catch {
    return [];
  }
};

const mapJellyfinApiItem = (
  rawItem: unknown,
  jellyfinWebsiteUrl: string,
): JellyfinLatestItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const itemType = toStringOrNull(item.Type);
  const itemName = toStringOrNull(item.Name);
  const seriesName = toStringOrNull(item.SeriesName);
  const albumName = toStringOrNull(item.Album);

  // For TV episodes, prioritize series name as main title and episode name as subtitle.
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

  return {
    id,
    title,
    subtitle,
    item_url: itemUrl,
    banner_url: bannerUrl,
    poster_url: posterUrl,
    item_type: itemType,
    year,
    added_at: addedAt,
  };
};


export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(auth)
  .get("/netdata/summary", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      return await fetchNetdataSummary();
    } catch (error) {
      console.error("Error fetching Netdata summary:", error);
      set.status = 500;
      return { error: "Failed to get Netdata summary" };
    }
  })
  .get("/netdata/stream", async ({ user, set, request }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let pollTimeout: ReturnType<typeof setTimeout> | null = null;
        let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
        let previousPayload = "";

        const closeStream = () => {
          if (closed) return;
          closed = true;
          if (pollTimeout) clearTimeout(pollTimeout);
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          try {
            controller.close();
          } catch {
            // Stream may already be closed by the runtime.
          }
        };

        const writeChunk = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closeStream();
          }
        };

        const scheduleHeartbeat = () => {
          if (closed) return;
          heartbeatTimeout = setTimeout(() => {
            writeChunk(": ping\n\n");
            scheduleHeartbeat();
          }, 15000);
        };

        const poll = async () => {
          if (closed) return;

          try {
            const snapshot = await fetchNetdataSummary();
            const payload = JSON.stringify(snapshot);
            if (payload !== previousPayload) {
              previousPayload = payload;
              writeChunk(`data: ${payload}\n\n`);
            }

            pollTimeout = setTimeout(() => {
              void poll();
            }, 2000);
          } catch (error) {
            const fallbackPayload = JSON.stringify({
              ...buildNetdataDisabledSummary(
                "Failed to refresh Netdata summary",
              ),
              enabled: true,
              connected: false,
            });
            writeChunk(`data: ${fallbackPayload}\n\n`);
            pollTimeout = setTimeout(() => {
              void poll();
            }, 5000);
            console.error("Netdata stream poll error:", error);
          }
        };

        signal.addEventListener("abort", closeStream);

        writeChunk("retry: 3000\n\n");
        scheduleHeartbeat();
        void poll();
      },
      cancel() {
        // No-op: timers are tied to request abort and internal stream closure.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
