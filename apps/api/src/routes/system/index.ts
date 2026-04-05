import { Elysia } from "elysia";
import { getAppVersion } from "../../services/versionService";

export const systemRoutes = new Elysia({ prefix: "/api/system" }).get(
  "/version",
  () => ({
    version: getAppVersion(),
  }),
);
