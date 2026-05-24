import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { habitCrudRoutes } from "./habitCrudRoutes";
import { habitActionRoutes } from "./habitActionRoutes";

export const habitsRoutes = new Elysia({ prefix: "/api/habits" })
  .use(auth)
  .use(requireUser)
  .use(habitCrudRoutes)
  .use(habitActionRoutes);
