import type { DashboardWeatherResponse } from "@hously/api/types/dashboardWeather";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export const WEATHER_CACHE_TTL_SECONDS = 30 * 60;

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
}

interface OpenMeteoCurrent {
  temperature_2m?: number;
  apparent_temperature?: number;
  weather_code?: number;
  is_day?: number;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

export const normalizeWeatherAddress = (address: string): string =>
  address.trim().replace(/\s+/g, " ").toLowerCase();

const getWeatherLabel = (weatherCode: number): string => {
  if (weatherCode === 0) return "Clear sky";
  if ([1, 2].includes(weatherCode)) return "Partly cloudy";
  if (weatherCode === 3) return "Overcast";
  if ([45, 48].includes(weatherCode)) return "Foggy";
  if ([51, 53, 55].includes(weatherCode)) return "Drizzle";
  if ([56, 57].includes(weatherCode)) return "Freezing drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return "Rain";
  if ([66, 67].includes(weatherCode)) return "Freezing rain";
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "Snow";
  if ([95, 96, 99].includes(weatherCode)) return "Thunderstorm";
  return "Current conditions";
};

const formatLocationName = (result?: NominatimResult): string => {
  const area =
    result?.address?.city ||
    result?.address?.town ||
    result?.address?.village ||
    result?.address?.county;
  const region = result?.address?.state;
  const country = result?.address?.country;
  const friendly = [area, region, country].filter(Boolean).join(", ");
  return friendly || result?.display_name || "Current location";
};

const parseWeatherNumber = (value: string | number | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Weather data is currently unavailable for this address.");
  }
  return parsed;
};

const parseIsDay = (value: number | undefined): boolean => {
  if (value === 0) return false;
  if (value === 1) return true;
  return true;
};

export const fetchAddressWeather = async (
  address: string,
  temperatureUnit: "fahrenheit" | "celsius" = "fahrenheit",
): Promise<DashboardWeatherResponse> => {
  const geocodeUrl = new URL(NOMINATIM_URL);
  geocodeUrl.searchParams.set("q", address);
  geocodeUrl.searchParams.set("format", "jsonv2");
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("addressdetails", "1");

  const geocodeRes = await fetch(geocodeUrl.toString(), {
    headers: {
      "User-Agent": "hously-api/1.0",
    },
  });

  if (!geocodeRes.ok) {
    throw new Error("Unable to load weather for this address right now.");
  }
  const geocodeData = (await geocodeRes.json()) as NominatimResult[];
  const firstResult = geocodeData[0];
  if (!firstResult) {
    throw new Error("Could not find this address.");
  }

  const latitude = parseWeatherNumber(firstResult.lat);
  const longitude = parseWeatherNumber(firstResult.lon);

  const weatherUrl = new URL(OPEN_METEO_URL);
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  weatherUrl.searchParams.set("temperature_unit", "fahrenheit");

  const weatherRes = await fetch(weatherUrl.toString());
  if (!weatherRes.ok) {
    throw new Error("Unable to load weather for this address right now.");
  }
  const weatherData = (await weatherRes.json()) as OpenMeteoResponse;
  const current = weatherData.current;
  if (!current) {
    throw new Error("Weather data is currently unavailable for this address.");
  }

  const locationName = formatLocationName(firstResult);
  const temperature_f = parseWeatherNumber(current.temperature_2m);
  const feels_like_f = parseWeatherNumber(current.apparent_temperature);
  const weather_code = parseWeatherNumber(current.weather_code);
  const condition_label = getWeatherLabel(weather_code);

  return {
    address,
    location_name: locationName || "Current location",
    latitude,
    longitude,
    temperature_f,
    feels_like_f,
    weather_code,
    is_day: parseIsDay(current.is_day),
    condition_label,
    temperature_unit: temperatureUnit,
  };
};
