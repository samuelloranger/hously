import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { getJsonCache, setJsonCache } from "@hously/api/services/cache";
import {
  fetchAddressWeather,
  fetchAddressWeatherForecast,
  normalizeWeatherAddress,
  WEATHER_CACHE_TTL_SECONDS,
} from "@hously/api/utils/dashboard/weather";
import type { DashboardWeatherResponse } from "@hously/api/types/dashboardWeather";
import type { WeatherForecastData } from "@hously/shared/types";
import { badGateway, notFound, serverError } from "@hously/api/errors";

interface WeatherPluginConfig {
  address?: string;
  temperature_unit?: "fahrenheit" | "celsius";
}

export const dashboardWeatherRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/weather", async ({ user, set }) => {
    try {
      const weatherPlugin = await prisma.plugin.findFirst({
        where: { type: "weather" },
      });
      const config =
        (weatherPlugin?.config as WeatherPluginConfig | null) || null;
      const address = (config?.address || "").trim();
      const temperatureUnit =
        config?.temperature_unit === "celsius" ? "celsius" : "fahrenheit";

      if (!address) {
        return notFound(set, "Weather plugin is not configured.");
      }

      const normalizedAddress = normalizeWeatherAddress(address);
      const cacheKey = `dashboard:weather:v3:${normalizedAddress}:${temperatureUnit}`;
      const cached = await getJsonCache<DashboardWeatherResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const weather = await fetchAddressWeather(address, temperatureUnit);
      await setJsonCache(cacheKey, weather, WEATHER_CACHE_TTL_SECONDS);
      return weather;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get weather";
      return badGateway(set, message);
    }
  })
  .get("/weather/forecast", async ({ set }) => {
    try {
      const weatherPlugin = await prisma.plugin.findFirst({
        where: { type: "weather" },
      });
      const config =
        (weatherPlugin?.config as WeatherPluginConfig | null) || null;
      const address = (config?.address || "").trim();
      const temperatureUnit =
        config?.temperature_unit === "celsius" ? "celsius" : "fahrenheit";

      if (!address) {
        return notFound(set, "Weather plugin is not configured.");
      }

      const normalizedAddress = normalizeWeatherAddress(address);
      const cacheKey = `dashboard:weather:forecast:v1:${normalizedAddress}`;
      const cached = await getJsonCache<WeatherForecastData>(cacheKey);
      if (cached) return cached;

      const forecast = await fetchAddressWeatherForecast(address, temperatureUnit);
      await setJsonCache(cacheKey, forecast, WEATHER_CACHE_TTL_SECONDS);
      return forecast;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get forecast";
      return badGateway(set, message);
    }
  });
