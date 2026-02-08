import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cron } from "@elysiajs/cron";

import { cors } from "@elysiajs/cors";
import {
  checkAndSendReminders,
  checkAndSendAllDayEventNotifications,
  cleanupOldNotifications,
} from "./jobs";
import { auth } from "./auth";
import { dashboardRoutes } from "./routes/dashboard";
import { usersRoutes } from "./routes/users";
import { notificationsRoutes } from "./routes/notifications";
import { webhooksRoutes } from "./routes/webhooks";
import { externalNotificationsRoutes } from "./routes/externalNotifications";
import { choresRoutes } from "./routes/chores";
import { shoppingRoutes } from "./routes/shopping";
import { calendarRoutes } from "./routes/calendar";
import { customEventsRoutes } from "./routes/customEvents";
import { mealPlansRoutes } from "./routes/mealPlans";
import { recipesRoutes } from "./routes/recipes";
import { remindersRoutes } from "./routes/reminders";
import { adminRoutes } from "./routes/admin";
import { analyticsRoutes } from "./routes/analytics";
import { globalRateLimit } from "./middleware/rateLimit";

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN || "http://localhost:5173", // Frontend URL
      credentials: true,
    }),
  )
  .use(swagger())
  // Cron jobs
  .use(
    cron({
      name: "checkReminders",
      pattern: "*/15 * * * *", // Every 15 minutes
      run: checkAndSendReminders,
    })
  )
  .use(
    cron({
      name: "checkAllDayEvents",
      pattern: "0 20 * * *", // Daily at 8 PM
      run: checkAndSendAllDayEventNotifications,
    })
  )
  .use(
    cron({
      name: "cleanupNotifications",
      pattern: "0 0 * * *", // Daily at midnight
      run: cleanupOldNotifications,
    })
  )
  .use((app) => {
    console.log("Elysia app initialized");
    app.on("beforeHandle", (context) => {
      console.log(
        `Incoming request: ${context.request.method} ${context.path}`,
      );
    });
    return app;
  })
  .use(globalRateLimit) // Global rate limiting: 1000 requests per hour
  .use(auth)
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
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }))
  .get("/api/health", () => ({ status: "ok" }));

if (import.meta.main) {
  app.listen(3000);
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  );
}
