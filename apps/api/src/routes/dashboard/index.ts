import { Elysia } from "elysia";
import { dashboardOverviewRoutes } from "./overviewRoutes";
import { dashboardUpcomingRoutes } from "./upcomingRoutes";
import { dashboardJellyfinRoutes } from "./jellyfinRoutes";
import { dashboardServiceRoutes } from "./servicesRoutes";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(dashboardOverviewRoutes)
  .use(dashboardUpcomingRoutes)
  .use(dashboardJellyfinRoutes)
  .use(dashboardServiceRoutes);
