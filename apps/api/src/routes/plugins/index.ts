import { Elysia } from "elysia";
import { weatherPluginRoutes } from "./weather";
import { tmdbPluginRoutes } from "./tmdb";
import { ollamaPluginRoutes } from "./ollama";
import { qbittorrentPluginRoutes } from "./qbittorrent";
import { homeAssistantPluginRoutes } from "./home-assistant";
import { jellyfinPluginRoutes } from "./jellyfin";
import { prowlarrPluginRoutes } from "./prowlarr";
import { radarrPluginRoutes } from "./radarr";
import { sonarrPluginRoutes } from "./sonarr";
import { scrutinyPluginRoutes } from "./scrutiny";
import { beszelPluginRoutes } from "./beszel";
import { adguardPluginRoutes } from "./adguard";
import { trackerPluginsRoutes } from "./trackers";

export const pluginsRoutes = new Elysia({ prefix: "/api/plugins" })
  .use(weatherPluginRoutes)
  .use(tmdbPluginRoutes)
  .use(ollamaPluginRoutes)
  .use(qbittorrentPluginRoutes)
  .use(homeAssistantPluginRoutes)
  .use(jellyfinPluginRoutes)
  .use(prowlarrPluginRoutes)
  .use(radarrPluginRoutes)
  .use(sonarrPluginRoutes)
  .use(scrutinyPluginRoutes)
  .use(beszelPluginRoutes)
  .use(adguardPluginRoutes)
  .use(trackerPluginsRoutes);
