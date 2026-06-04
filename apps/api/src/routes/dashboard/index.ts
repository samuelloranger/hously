import { Elysia } from "elysia";
import { dashboardStatsRoutes } from "./stats";
import { dashboardActivitiesRoutes } from "./activities";
import { dashboardWeatherRoutes } from "./weather";
import { dashboardUpcomingRoutes } from "./upcoming";
import { dashboardJellyfinRoutes } from "./jellyfin";
import { dashboardTrackersRoutes } from "./trackers";
import { dashboardScrutinyRoutes } from "./scrutiny";
import { dashboardSystemRoutes } from "./system";
import { dashboardAdguardRoutes } from "./adguard";
import { dashboardDockerRoutes } from "./docker";
import { dashboardDownloadsRoutes } from "./downloads";
import { minecraftDashboardRoutes } from "./minecraft";
import { dashboardQuickLinksRoutes } from "./quick-links";
import { dashboardFaviconRoutes } from "./favicon";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(dashboardStatsRoutes)
  .use(dashboardActivitiesRoutes)
  .use(dashboardWeatherRoutes)
  .use(dashboardUpcomingRoutes)
  .use(dashboardJellyfinRoutes)
  .use(dashboardTrackersRoutes)
  .use(dashboardScrutinyRoutes)
  .use(dashboardSystemRoutes)
  .use(dashboardAdguardRoutes)
  .use(dashboardDockerRoutes)
  .use(dashboardDownloadsRoutes)
  .use(minecraftDashboardRoutes)
  .use(dashboardQuickLinksRoutes)
  .use(dashboardFaviconRoutes);
