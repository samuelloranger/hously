import { Elysia } from "elysia";
import { weatherIntegrationRoutes } from "./weather";
import { tmdbIntegrationRoutes } from "./tmdb";
import { qbittorrentIntegrationRoutes } from "./qbittorrent";
import { homeAssistantIntegrationRoutes } from "./home-assistant";
import { jellyfinIntegrationRoutes } from "./jellyfin";
import { prowlarrIntegrationRoutes } from "./prowlarr";
import { jackettIntegrationRoutes } from "./jackett";

import { scrutinyIntegrationRoutes } from "./scrutiny";
import { beszelIntegrationRoutes } from "./beszel";
import { adguardIntegrationRoutes } from "./adguard";
import { uptimekumaIntegrationRoutes } from "./uptimekuma";
import { trackerIntegrationsRoutes } from "./trackers";

export const integrationsRoutes = new Elysia({ prefix: "/api/integrations" })
  .use(weatherIntegrationRoutes)
  .use(tmdbIntegrationRoutes)
  .use(qbittorrentIntegrationRoutes)
  .use(homeAssistantIntegrationRoutes)
  .use(jellyfinIntegrationRoutes)
  .use(prowlarrIntegrationRoutes)
  .use(jackettIntegrationRoutes)

  .use(scrutinyIntegrationRoutes)
  .use(beszelIntegrationRoutes)
  .use(adguardIntegrationRoutes)
  .use(uptimekumaIntegrationRoutes)
  .use(trackerIntegrationsRoutes);
