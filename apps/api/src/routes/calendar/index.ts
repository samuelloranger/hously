import { Elysia } from "elysia";
import { calendarEventsRoutes } from "./events";
import { icalFeedRoutes } from "./ical";

// iCal feed is mounted first — it includes a public /feed/:token route (no auth)
export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  .use(icalFeedRoutes)
  .use(calendarEventsRoutes);
