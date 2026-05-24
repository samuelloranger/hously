import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { boardTaskCrudRoutes } from "./boardTaskCrudRoutes";
import { boardTaskRelationRoutes } from "./boardTaskRelationRoutes";
import { boardTaskSseRoutes } from "./boardTaskSseRoutes";

export const boardTasksRoutes = new Elysia({ prefix: "/api/board-tasks" })
  .use(auth)
  .use(boardTaskCrudRoutes)
  .use(boardTaskSseRoutes)
  .use(boardTaskRelationRoutes);
