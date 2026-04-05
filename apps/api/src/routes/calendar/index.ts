import { Elysia } from "elysia";
import { calendarEventsRoutes } from "./events";
import { icalFeedRoutes } from "./ical";

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  .use(icalFeedRoutes)
  .use(calendarEventsRoutes);
