import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { choreCrudRoutes } from "./choreCrudRoutes";
import { choreCompletionRoutes } from "./choreCompletionRoutes";
import { choreStatsRoutes } from "./choreStatsRoutes";

export const choresRoutes = new Elysia({ prefix: "/api/chores" })
  .use(auth)
  .use(requireUser)
  .use(choreCrudRoutes)
  .use(choreCompletionRoutes)
  .use(choreStatsRoutes);
