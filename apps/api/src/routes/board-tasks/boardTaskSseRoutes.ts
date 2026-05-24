import { Elysia } from "elysia";
import { prisma } from "@hously/api/db";
import { requireUser } from "@hously/api/middleware/auth";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import { mapTask, taskInclude, type TaskRow } from "./boardTaskMappers";

export const boardTaskSseRoutes = new Elysia()
  .use(requireUser)
  .get("/stream", ({ request }) =>
    createJsonSseResponse({
      request,
      poll: async () => {
        const tasks = await prisma.boardTask.findMany({
          where: { archived: false },
          orderBy: [{ status: "asc" }, { position: "asc" }],
          include: taskInclude,
        });
        return {
          tasks: tasks.map((row) => mapTask(row as unknown as TaskRow)),
        };
      },
      intervalMs: 4000,
      retryMs: 8000,
      logLabel: "Board tasks stream",
    }),
  );
