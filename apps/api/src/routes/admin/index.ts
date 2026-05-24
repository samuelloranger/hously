import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireAdmin } from "@hously/api/middleware/auth";
import { adminJobRoutes } from "./adminJobRoutes";
import { adminLibraryHealthRoutes } from "./adminLibraryHealthRoutes";
import { adminUserRoutes } from "./adminUserRoutes";
import { adminMiscRoutes } from "./adminMiscRoutes";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(auth)
  .use(requireAdmin)
  .use(adminJobRoutes)
  .use(adminLibraryHealthRoutes)
  .use(adminUserRoutes)
  .use(adminMiscRoutes);
