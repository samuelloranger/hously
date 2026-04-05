import { Elysia, t } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { prisma } from "../../../db";
import {
  normalizeRadarrConfig,
  normalizeSonarrConfig,
} from "../../../utils/plugins/normalizers";
import { deleteCache } from "../../../services/cache";
import { badGateway, badRequest, serverError } from "../../../errors";
import {
  type InteractiveReleaseItem,
  mapInteractiveRelease,
  mapRadarrManagementDetails,
  mapSonarrManagementDetails,
  isSonarrFullSeasonRelease,
} from "../mappers";

export const mediasArrRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .post(
    "/:service/:sourceId/auto-search",
    async ({ user, set, params }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }

      try {
        if (service === "radarr") {
          const radarrPlugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!radarrPlugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(radarrPlugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const commandUrl = new URL("/api/v3/command", config.website_url);
          const commandRes = await fetch(commandUrl.toString(), {
            method: "POST",
            headers: {
              "X-Api-Key": config.api_key,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              name: "MoviesSearch",
              movieIds: [sourceId],
            }),
          });

          if (!commandRes.ok) {
            return badGateway(
              set,
              `Radarr auto-search failed with status ${commandRes.status}`,
            );
          }

          return { success: true, service: "radarr" as const };
        }

        const sonarrPlugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!sonarrPlugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(sonarrPlugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const commandUrl = new URL("/api/v3/command", config.website_url);
        const commandRes = await fetch(commandUrl.toString(), {
          method: "POST",
          headers: {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: "SeriesSearch",
            seriesId: sourceId,
          }),
        });

        if (!commandRes.ok) {
          return badGateway(
            set,
            `Sonarr auto-search failed with status ${commandRes.status}`,
          );
        }

        return { success: true, service: "sonarr" as const };
      } catch (error) {
        console.error("Error running auto-search:", error);
        return serverError(set, "Failed to run auto-search");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    },
  )
  .get(
    "/:service/:sourceId/interactive-search",
    async ({ user, set, params, query }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);
      const seasonNumber = query.season ? parseInt(query.season, 10) : null;

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }

      try {
        if (service === "radarr") {
          const plugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const url = new URL("/api/v3/release", config.website_url);
          url.searchParams.set("movieId", String(sourceId));
          const releaseRes = await fetch(url.toString(), {
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
          });

          if (!releaseRes.ok) {
            return badGateway(
              set,
              `Radarr interactive search failed with status ${releaseRes.status}`,
            );
          }

          const releases = (await releaseRes.json()) as unknown[];
          return {
            success: true,
            service: "radarr" as const,
            releases: releases
              .map(mapInteractiveRelease)
              .filter((r): r is InteractiveReleaseItem => Boolean(r)),
          };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const url = new URL("/api/v3/release", config.website_url);
        url.searchParams.set("seriesId", String(sourceId));
        if (
          seasonNumber !== null &&
          Number.isFinite(seasonNumber) &&
          seasonNumber >= 0
        ) {
          url.searchParams.set("seasonNumber", String(seasonNumber));
        }
        const releaseRes = await fetch(url.toString(), {
          headers: {
            "X-Api-Key": config.api_key,
            Accept: "application/json",
          },
        });

        if (!releaseRes.ok) {
          return badGateway(
            set,
            `Sonarr interactive search failed with status ${releaseRes.status}`,
          );
        }

        const releases = (await releaseRes.json()) as unknown[];
        // When searching by season, return all releases; otherwise only full season packs
        const filtered =
          seasonNumber !== null
            ? releases
            : releases.filter(isSonarrFullSeasonRelease);
        return {
          success: true,
          service: "sonarr" as const,
          releases: filtered
            .map(mapInteractiveRelease)
            .filter((r): r is InteractiveReleaseItem => Boolean(r)),
        };
      } catch (error) {
        console.error("Error loading interactive search releases:", error);
        return serverError(set, "Failed to load interactive search releases");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      query: t.Object({
        season: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:service/:sourceId/interactive-search/download",
    async ({ user, set, params, body }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);
      const guid = body.guid.trim();
      const indexerId = body.indexer_id;

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }
      if (!guid) {
        return badRequest(set, "Invalid release GUID");
      }
      if (!Number.isFinite(indexerId) || indexerId <= 0) {
        return badRequest(set, "Invalid indexer ID");
      }

      try {
        if (service === "radarr") {
          const plugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const releaseUrl = new URL("/api/v3/release", config.website_url);
          const commandRes = await fetch(releaseUrl.toString(), {
            method: "POST",
            headers: {
              "X-Api-Key": config.api_key,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              guid,
              indexerId,
            }),
          });

          if (!commandRes.ok) {
            return badGateway(
              set,
              `Radarr download release failed with status ${commandRes.status}`,
            );
          }

          return { success: true, service: "radarr" as const };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const releaseUrl = new URL("/api/v3/release", config.website_url);
        const commandRes = await fetch(releaseUrl.toString(), {
          method: "POST",
          headers: {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            guid,
            indexerId,
          }),
        });

        if (!commandRes.ok) {
          return badGateway(
            set,
            `Sonarr download release failed with status ${commandRes.status}`,
          );
        }

        return { success: true, service: "sonarr" as const };
      } catch (error) {
        console.error("Error downloading interactive release:", error);
        return serverError(set, "Failed to download release");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      body: t.Object({
        guid: t.String(),
        indexer_id: t.Numeric(),
      }),
    },
  )
  .post(
    "/:service/:sourceId/refresh",
    async ({ set, params }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }

      try {
        if (service === "radarr") {
          const plugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const commandUrl = new URL("/api/v3/command", config.website_url);
          const commandRes = await fetch(commandUrl.toString(), {
            method: "POST",
            headers: {
              "X-Api-Key": config.api_key,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              name: "RefreshMovie",
              movieIds: [sourceId],
            }),
          });

          if (!commandRes.ok) {
            return badGateway(
              set,
              `Radarr refresh failed with status ${commandRes.status}`,
            );
          }

          await deleteCache("medias:radarr:ids").catch(() => {});

          return { success: true, service: "radarr" as const };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const commandUrl = new URL("/api/v3/command", config.website_url);
        const commandRes = await fetch(commandUrl.toString(), {
          method: "POST",
          headers: {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: "RefreshSeries",
            seriesId: sourceId,
          }),
        });

        if (!commandRes.ok) {
          return badGateway(
            set,
            `Sonarr refresh failed with status ${commandRes.status}`,
          );
        }

        await deleteCache("medias:sonarr:ids").catch(() => {});

        return { success: true, service: "sonarr" as const };
      } catch (error) {
        console.error("Error refreshing media:", error);
        return serverError(set, "Failed to refresh media");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    },
  )
  .get(
    "/:service/:sourceId/management-info",
    async ({ set, params }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }

      try {
        if (service === "radarr") {
          const plugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }
          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const url = new URL(`/api/v3/movie/${sourceId}`, config.website_url);
          const res = await fetch(url.toString(), {
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
          });
          if (!res.ok) {
            return badGateway(
              set,
              `Radarr movie fetch failed with status ${res.status}`,
            );
          }
          const json = (await res.json()) as unknown;
          const mapped = mapRadarrManagementDetails(json);
          if (!mapped) {
            return badGateway(set, "Could not parse Radarr movie");
          }
          return mapped;
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }
        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const url = new URL(`/api/v3/series/${sourceId}`, config.website_url);
        const res = await fetch(url.toString(), {
          headers: {
            "X-Api-Key": config.api_key,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          return badGateway(
            set,
            `Sonarr series fetch failed with status ${res.status}`,
          );
        }
        const json = (await res.json()) as unknown;
        const mapped = mapSonarrManagementDetails(json);
        if (!mapped) {
          return badGateway(set, "Could not parse Sonarr series");
        }
        return mapped;
      } catch (error) {
        console.error("Error loading Arr management info:", error);
        return serverError(set, "Failed to load management info");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    },
  )
  .delete(
    "/:service/:sourceId",
    async ({ user, set, params, query }) => {
      const service =
        params.service === "radarr" || params.service === "sonarr"
          ? params.service
          : null;
      const sourceId = parseInt(params.sourceId, 10);
      const deleteFiles = query.deleteFiles === "true";

      if (!service) {
        return badRequest(set, "Invalid service");
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        return badRequest(set, "Invalid source ID");
      }

      try {
        if (service === "radarr") {
          const plugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const deleteUrl = new URL(
            `/api/v3/movie/${sourceId}`,
            config.website_url,
          );
          deleteUrl.searchParams.set("deleteFiles", String(deleteFiles));
          deleteUrl.searchParams.set("addImportExclusion", "false");

          const deleteRes = await fetch(deleteUrl.toString(), {
            method: "DELETE",
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
          });

          if (!deleteRes.ok) {
            return badGateway(
              set,
              `Radarr delete failed with status ${deleteRes.status}`,
            );
          }

          // Invalidate cached Radarr IDs
          await deleteCache("medias:radarr:ids").catch(() => {});

          return { success: true, service: "radarr" as const };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const deleteUrl = new URL(
          `/api/v3/series/${sourceId}`,
          config.website_url,
        );
        deleteUrl.searchParams.set("deleteFiles", String(deleteFiles));
        deleteUrl.searchParams.set("addImportExclusion", "false");

        const deleteRes = await fetch(deleteUrl.toString(), {
          method: "DELETE",
          headers: {
            "X-Api-Key": config.api_key,
            Accept: "application/json",
          },
        });

        if (!deleteRes.ok) {
          return badGateway(
            set,
            `Sonarr delete failed with status ${deleteRes.status}`,
          );
        }

        // Invalidate cached Sonarr IDs
        await deleteCache("medias:sonarr:ids").catch(() => {});

        return { success: true, service: "sonarr" as const };
      } catch (error) {
        console.error("Error deleting media:", error);
        return serverError(set, "Failed to delete media");
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    },
  );
