import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";

import { cors } from "@elysiajs/cors";
import { checkAndNotifyVersionChange } from "./services/versionService";
import { auth } from "./auth";
import { adminRoutes } from "./routes/admin";
import { analyticsRoutes } from "./routes/analytics";
import { boardTagsRoutes } from "./routes/board-tags";
import { boardTasksRoutes } from "./routes/board-tasks";
import { calendarRoutes } from "./routes/calendar";
import { choresRoutes } from "./routes/chores";
import { customEventsRoutes } from "./routes/custom-events";
import { dashboardRoutes } from "./routes/dashboard";
import { externalNotificationsRoutes } from "./routes/external-notifications";
import { habitsRoutes } from "./routes/habits";
import { homeAssistantRoutes } from "./routes/dashboard/home-assistant";
import { mealPlansRoutes } from "./routes/meal-plans";
import { mediasRoutes } from "./routes/medias";
import { notificationsRoutes } from "./routes/notifications";
import { pluginsRoutes } from "./routes/plugins";
import { recipesRoutes } from "./routes/recipes";
import { remindersRoutes } from "./routes/reminders";
import { shoppingRoutes } from "./routes/shopping";
import { systemRoutes } from "./routes/system";
import { usersRoutes } from "./routes/users";
import { webhooksRoutes } from "./routes/webhooks";
import { globalRateLimit } from "./middleware/rateLimit";
import { initWorkers, setupScheduledJobs } from "./services/queueService";

const serveStatic = Bun.env.SERVE_STATIC === "true";

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN || "http://localhost:5173", // Frontend URL
      credentials: true,
    }),
  )
  .use(swagger())
  .use((app) => {
    console.log("Elysia app initialized");
    if (Bun.env.LOG_LEVEL === "debug") {
      app.on("beforeHandle", (context) => {
        console.log(
          `Incoming request: ${context.request.method} ${context.path}`,
        );
      });
    }
    return app;
  })
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: error.message };
    }
    console.error(`[${code}] Unhandled error:`, error);
    set.status = 500;
    return { error: "Internal server error" };
  })
  .use(auth)
  .use(globalRateLimit) // Global rate limiting for unauthenticated requests
  .use(dashboardRoutes)
  .use(usersRoutes)
  .use(notificationsRoutes)
  .use(webhooksRoutes)
  .use(externalNotificationsRoutes)
  .use(choresRoutes)
  .use(shoppingRoutes)
  .use(calendarRoutes)
  .use(customEventsRoutes)
  .use(mealPlansRoutes)
  .use(recipesRoutes)
  .use(remindersRoutes)
  .use(adminRoutes)
  .use(analyticsRoutes)
  .use(pluginsRoutes)
  .use(homeAssistantRoutes)
  .use(mediasRoutes)
  .use(habitsRoutes)
  .use(boardTasksRoutes)
  .use(boardTagsRoutes)
  .use(systemRoutes)
  .get("/health", () => ({ status: "ok" }))
  .get("/api/health", () => ({ status: "ok" }))
  .use((app) => {
    if (serveStatic) {
      // On Bun, @elysiajs/static imports .html as modules; Vite's index.html is plain HTML, so those routes
      // return empty bodies. Ignore *.html here and serve the SPA shell via Bun.file below.
      app
        .use(
          staticPlugin({
            assets: "./public",
            prefix: "/",
            ignorePatterns: [/\.html$/],
          }),
        )
        .get("*", () => Bun.file("./public/index.html"));
    }
    return app;
  });

if (import.meta.main) {
  // 1. Initialize BullMQ Workers
  initWorkers();

  // 2. Setup Scheduled Tasks (Crons)
  setupScheduledJobs().catch((err) => {
    console.error("Failed to setup scheduled jobs:", err);
  });

  // 3. Start Server
  app.listen(process.env.API_PORT || 3000);
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  );

  // 4. Post-startup tasks
  checkAndNotifyVersionChange().catch((err) => {
    console.error("Failed to check version change after startup:", err);
  });
}
