import { Elysia, t } from "elysia";
import { auth } from "../../auth";
import { requireUser } from "../../middleware/auth";
import { prisma } from "../../db";
import { normalizeProwlarrConfig } from "../../utils/plugins/normalizers";
import {
  badGateway,
  badRequest,
  notFound,
  serverError,
} from "../../utils/errors";
import {
  type InteractiveReleaseItem,
  mapProwlarrInteractiveRelease,
  takeProwlarrReleasePayload,
} from "./mappers";

export const mediasProwlarrRoutes = new Elysia({ prefix: "/api/medias" })
  .use(auth)
  .use(requireUser)
  .get(
    "/prowlarr/interactive-search",
    async ({ user, set, query }) => {
      const searchQuery = query.q.trim();
      if (searchQuery.length < 2) {
        return badRequest(
          set,
          "Search query must be at least 2 characters long",
        );
      }

      try {
        const plugin = await prisma.plugin.findFirst({
          where: { type: "prowlarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Prowlarr plugin is not enabled");
        }

        const config = normalizeProwlarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Prowlarr plugin is not configured");
        }

        const url = new URL("/api/v1/search", config.website_url);
        url.searchParams.set("query", searchQuery);
        url.searchParams.set("type", "search");
        url.searchParams.set("limit", "100");

        const response = await fetch(url.toString(), {
          headers: {
            "X-Api-Key": config.api_key,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return badGateway(
            set,
            `Prowlarr interactive search failed with status ${response.status}`,
          );
        }

        const releases = (await response.json()) as unknown[];
        return {
          success: true,
          service: "prowlarr" as const,
          releases: releases
            .map(mapProwlarrInteractiveRelease)
            .filter((release): release is InteractiveReleaseItem =>
              Boolean(release),
            ),
        };
      } catch (error) {
        console.error(
          "Error loading Prowlarr interactive search releases:",
          error,
        );
        return serverError(
          set,
          "Failed to load Prowlarr interactive search releases",
        );
      }
    },
    {
      query: t.Object({
        q: t.String(),
      }),
    },
  )
  .post(
    "/prowlarr/interactive-search/download",
    async ({ user, set, body }) => {
      const token = body.token.trim();
      if (!token) {
        return badRequest(set, "Invalid release token");
      }

      try {
        const plugin = await prisma.plugin.findFirst({
          where: { type: "prowlarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Prowlarr plugin is not enabled");
        }

        const config = normalizeProwlarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Prowlarr plugin is not configured");
        }

        const releasePayload = takeProwlarrReleasePayload(token);
        if (!releasePayload) {
          return notFound(
            set,
            "Selected release is no longer available. Run the search again.",
          );
        }

        const searchUrl = new URL("/api/v1/search", config.website_url);
        const response = await fetch(searchUrl.toString(), {
          method: "POST",
          headers: {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(releasePayload),
        });

        if (!response.ok) {
          return badGateway(
            set,
            `Prowlarr download release failed with status ${response.status}`,
          );
        }

        return {
          success: true,
          service: "prowlarr" as const,
        };
      } catch (error) {
        console.error("Error downloading Prowlarr release:", error);
        return serverError(set, "Failed to download release");
      }
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    },
  );
