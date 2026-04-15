import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import {
  getActiveIndexerManager,
  tieredSearch,
} from "@hously/api/services/indexerManager";
import type { NormalizedRelease } from "@hously/api/services/indexerManager";
import type { QualityProfile } from "@prisma/client";
import type { InteractiveReleaseItem } from "@hously/shared/types";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import {
  isSeasonPack,
  isCompleteSeries,
} from "@hously/api/utils/medias/mappers";
import { badRequest, notFound, serverError } from "@hously/api/errors";

function toScoreInput(p: QualityProfile): QualityProfileScoreInput {
  return {
    minResolution: p.minResolution,
    cutoffResolution: p.cutoffResolution,
    preferredSources: p.preferredSources,
    preferredCodecs: p.preferredCodecs,
    preferredLanguages: p.preferredLanguages ?? [],
    prioritizedTrackers: p.prioritizedTrackers ?? [],
    preferTrackerOverQuality: p.preferTrackerOverQuality ?? false,
    maxSizeGb: p.maxSizeGb,
    requireHdr: p.requireHdr,
    preferHdr: p.preferHdr,
  };
}

function normalizedToInteractive(
  r: NormalizedRelease,
  source: "prowlarr" | "jackett",
  downloadToken: string | null,
): InteractiveReleaseItem {
  return {
    guid: r.guid,
    title: r.title,
    indexer: r.indexer,
    indexer_id: r.indexerId,
    languages: r.languages,
    protocol: r.protocol,
    size_bytes: r.sizeBytes,
    age: r.age,
    seeders: r.seeders,
    leechers: r.leechers,
    rejected: r.rejected,
    rejection_reason: r.rejections.length > 0 ? r.rejections.join(", ") : null,
    info_url: r.infoUrl,
    source,
    download_token: downloadToken,
    download_url: r.magnetUrl ?? r.downloadUrl ?? null,
    is_season_pack: isSeasonPack(r.title),
    is_complete_series: isCompleteSeries(r.title),
    freeleech: r.freeleech || undefined,
  };
}

export const mediasSearchRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/interactive-search",
    async ({ set, query }) => {
      const searchQuery = query.q.trim();
      const seasonNumber =
        query.season != null ? parseInt(String(query.season), 10) : null;
      const tmdbId =
        query.tmdb_id != null ? parseInt(String(query.tmdb_id), 10) : null;
      const isSeasonSearch =
        seasonNumber != null && Number.isFinite(seasonNumber);
      const isCompleteSearch =
        query.complete === "true" || query.complete === true;

      if (!isSeasonSearch && !isCompleteSearch && searchQuery.length < 2) {
        return badRequest(
          set,
          "Search query must be at least 2 characters long",
        );
      }

      try {
        const adapter = await getActiveIndexerManager();
        if (!adapter) {
          return badRequest(
            set,
            "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
          );
        }

        // Determine media type for category filtering
        const mediaType: "movie" | "tv" | undefined =
          isSeasonSearch || isCompleteSearch
            ? "tv"
            : query.media_type === "movie" || query.media_type === "tv"
              ? query.media_type
              : undefined;

        let rawReleases = await tieredSearch(adapter, {
          query: searchQuery,
          tmdbId,
          season: isSeasonSearch ? seasonNumber : null,
          complete: isCompleteSearch,
          mediaType,
        });

        // TMDb ID validation: when tmdbId is provided, filter out results
        // where the indexer reports a different tmdbId (keep results with no tmdbId)
        if (tmdbId != null) {
          rawReleases = rawReleases.filter(
            (r) => r.tmdbId == null || r.tmdbId === tmdbId,
          );
        }

        let mapped: InteractiveReleaseItem[] = rawReleases.map((r) => {
          const downloadToken = adapter.storeReleaseToken(r);
          return normalizedToInteractive(r, adapter.name, downloadToken);
        });

        const lmRaw = query.library_media_id;
        if (lmRaw != null && lmRaw !== "") {
          const libId =
            typeof lmRaw === "number" ? lmRaw : parseInt(String(lmRaw), 10);
          if (Number.isFinite(libId)) {
            const media = await prisma.libraryMedia.findUnique({
              where: { id: libId },
              include: { qualityProfile: true },
            });
            const qp = media?.qualityProfile;
            if (qp) {
              const profile = toScoreInput(qp);
              mapped = mapped.map((r) => {
                const parsed = parseReleaseTitle(r.title);
                const score = scoreRelease(
                  parsed,
                  profile,
                  r.size_bytes,
                  r.title,
                  r.indexer,
                  r.freeleech,
                );
                const qualityReject = Array.isArray(score);
                const parsed_quality = {
                  resolution: parsed.resolution,
                  source: parsed.source,
                  codec: parsed.codec,
                  hdr: parsed.hdr,
                };
                const rejected = r.rejected || qualityReject;
                let rejection_reason = r.rejection_reason;
                if (qualityReject) {
                  const qmsg = score.join(", ");
                  rejection_reason = rejection_reason
                    ? `${rejection_reason}; ${qmsg}`
                    : qmsg;
                }
                return {
                  ...r,
                  quality_score: qualityReject ? null : score,
                  parsed_quality,
                  rejected,
                  rejection_reason,
                };
              });
              mapped.sort((a, b) => {
                const ar = a.rejected ? 1 : 0;
                const br = b.rejected ? 1 : 0;
                if (ar !== br) return ar - br;
                const as = a.quality_score ?? -Number.MAX_SAFE_INTEGER;
                const bs = b.quality_score ?? -Number.MAX_SAFE_INTEGER;
                if (as !== bs) return bs - as;
                return a.title.localeCompare(b.title);
              });
            }
          }
        }

        return {
          success: true,
          service: adapter.name,
          releases: mapped,
        };
      } catch (error) {
        console.error("Error loading interactive search releases:", error);
        return serverError(set, "Failed to load interactive search releases");
      }
    },
    {
      query: t.Object({
        q: t.String(),
        library_media_id: t.Optional(t.Union([t.String(), t.Number()])),
        season: t.Optional(t.Union([t.String(), t.Number()])),
        tmdb_id: t.Optional(t.Union([t.String(), t.Number()])),
        complete: t.Optional(t.Union([t.String(), t.Boolean()])),
        media_type: t.Optional(t.Union([t.Literal("movie"), t.Literal("tv")])),
      }),
    },
  )
  .get("/indexers", async ({ set }) => {
    try {
      const adapter = await getActiveIndexerManager();
      if (!adapter) {
        return badRequest(
          set,
          "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
        );
      }
      const indexers = await adapter.getIndexers();
      return { indexers };
    } catch {
      return serverError(set, "Failed to fetch indexers");
    }
  })
  .post(
    "/interactive-search/download",
    async ({ set, body }) => {
      const token = body.token.trim();
      if (!token) {
        return badRequest(set, "Invalid release token");
      }

      try {
        const adapter = await getActiveIndexerManager();
        if (!adapter) {
          return badRequest(
            set,
            "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
          );
        }

        const result = await adapter.grabRelease(token);
        if (!result.success) {
          return notFound(
            set,
            result.error ??
              "Selected release is no longer available. Run the search again.",
          );
        }

        return {
          success: true,
          service: adapter.name,
          ...(result.downloadUrl ? { download_url: result.downloadUrl } : {}),
          ...(result.magnetUrl ? { magnet_url: result.magnetUrl } : {}),
        };
      } catch (error) {
        console.error("Error downloading release:", error);
        return serverError(set, "Failed to download release");
      }
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    },
  );
