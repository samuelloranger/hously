import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { normalizeProwlarrConfig } from "@hously/api/utils/plugins/normalizers";
import {
  badGateway,
  badRequest,
  notFound,
  serverError,
} from "@hously/api/errors";
import {
  type InteractiveReleaseItem,
  mapProwlarrInteractiveRelease,
  takeProwlarrReleasePayload,
} from "@hously/api/utils/medias/mappers";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import type { QualityProfile } from "@prisma/client";

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

export const mediasProwlarrRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/prowlarr/interactive-search",
    async ({ user, set, query }) => {
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

        const fetchReleases = async (url: URL) => {
          const response = await fetch(url.toString(), {
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(25_000),
          }).catch(() => null);
          if (!response?.ok) return null;
          return (await response.json()) as unknown[];
        };

        const buildTvSearchUrl = (opts: {
          tmdbId?: number | null;
          titleQuery?: string;
          season?: number;
        }) => {
          const url = new URL("/api/v1/search", config.website_url);
          url.searchParams.set("type", "tvsearch");
          url.searchParams.set("limit", "100");
          if (opts.season != null)
            url.searchParams.set("season", String(opts.season));
          if (opts.tmdbId != null) {
            url.searchParams.set("tmdbid", String(opts.tmdbId));
          } else if (opts.titleQuery) {
            url.searchParams.set("query", opts.titleQuery);
          }
          return url;
        };

        const buildFreeSearchUrl = (q: string) => {
          const url = new URL("/api/v1/search", config.website_url);
          url.searchParams.set("type", "search");
          url.searchParams.set("query", q);
          url.searchParams.set("limit", "100");
          return url;
        };

        let rawList: unknown[];

        if (isCompleteSearch) {
          /**
           * Complete series strategy — three parallel queries, merged + deduped by guid:
           *   1. tvsearch by TMDB ID (no season) — catches structured indexers
           *   2. tvsearch by title (no season) — fallback for unstructured
           *   3. free-text "title integrale" — French scene packs
           *   4. free-text "title complete series" — English scene packs
           */
          const [tvById, tvByTitle, integrale, completeSeries] =
            await Promise.all([
              tmdbId != null
                ? fetchReleases(buildTvSearchUrl({ tmdbId }))
                : Promise.resolve([]),
              fetchReleases(buildTvSearchUrl({ titleQuery: searchQuery })),
              fetchReleases(buildFreeSearchUrl(`${searchQuery} integrale`)),
              fetchReleases(
                buildFreeSearchUrl(`${searchQuery} complete series`),
              ),
            ]);
          const seen = new Set<string>();
          rawList = [];
          for (const batch of [tvById, tvByTitle, integrale, completeSeries]) {
            for (const item of batch ?? []) {
              const row = item as Record<string, unknown>;
              const guid = String(row.guid ?? "");
              if (guid && !seen.has(guid)) {
                seen.add(guid);
                rawList.push(item);
              }
            }
          }
        } else if (isSeasonSearch) {
          /**
           * Season search strategy (mirrors Sonarr's tiered approach):
           *   Tier 1 — tvsearch with tmdbid+season: structured indexers (preferred, no noise)
           *   Tier 2 (parallel, always run) — title-based fallbacks for simple indexers:
           *     a. tvsearch by title + season
           *     b. free-text "title Season N"    (English)
           *     c. free-text "title Saison N"    (French)
           *     d. free-text "title S{0N}"       (scene format)
           *   All batches are merged and deduped by guid.
           */
          const sN = String(seasonNumber!).padStart(2, "0");
          const [tvById, tvByTitle, seasonEn, seasonFr, seasonScene] =
            await Promise.all([
              tmdbId != null && Number.isFinite(tmdbId)
                ? fetchReleases(
                    buildTvSearchUrl({ tmdbId, season: seasonNumber! }),
                  )
                : Promise.resolve([]),
              fetchReleases(
                buildTvSearchUrl({
                  titleQuery: searchQuery,
                  season: seasonNumber!,
                }),
              ),
              fetchReleases(
                buildFreeSearchUrl(`${searchQuery} Season ${seasonNumber}`),
              ),
              fetchReleases(
                buildFreeSearchUrl(`${searchQuery} Saison ${seasonNumber}`),
              ),
              fetchReleases(buildFreeSearchUrl(`${searchQuery} S${sN}`)),
            ]);
          const seen = new Set<string>();
          rawList = [];
          for (const batch of [
            tvById,
            tvByTitle,
            seasonEn,
            seasonFr,
            seasonScene,
          ]) {
            for (const item of batch ?? []) {
              const row = item as Record<string, unknown>;
              const guid = String(row.guid ?? "");
              if (guid && !seen.has(guid)) {
                seen.add(guid);
                rawList.push(item);
              }
            }
          }
        } else {
          const response = await fetch(
            buildFreeSearchUrl(searchQuery).toString(),
            {
              headers: {
                "X-Api-Key": config.api_key,
                Accept: "application/json",
              },
            },
          );
          if (!response.ok) {
            return badGateway(
              set,
              `Prowlarr interactive search failed with status ${response.status}`,
            );
          }
          rawList = (await response.json()) as unknown[];
        }

        let mapped = rawList
          .map((row) => mapProwlarrInteractiveRelease(row, config.website_url))
          .filter((release): release is InteractiveReleaseItem =>
            Boolean(release),
          );

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
                );
                const qualityReject = score === null;
                const parsed_quality = {
                  resolution: parsed.resolution,
                  source: parsed.source,
                  codec: parsed.codec,
                  hdr: parsed.hdr,
                };
                const rejected = r.rejected || qualityReject;
                const qmsg = "Does not match quality profile";
                let rejection_reason = r.rejection_reason;
                if (qualityReject) {
                  rejection_reason = rejection_reason
                    ? `${rejection_reason}; ${qmsg}`
                    : qmsg;
                }
                return {
                  ...r,
                  quality_score: score,
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
          service: "prowlarr" as const,
          releases: mapped,
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
        library_media_id: t.Optional(t.Union([t.String(), t.Number()])),
        /** Season number — triggers tvsearch mode instead of free-text search */
        season: t.Optional(t.Union([t.String(), t.Number()])),
        /** TMDB ID for tier-1 structured tvsearch (preferred over title) */
        tmdb_id: t.Optional(t.Union([t.String(), t.Number()])),
        /** Triggers complete-series search (intégrale / complete series) */
        complete: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
    },
  )
  .get("/prowlarr/indexers", async ({ set }) => {
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
      const response = await fetch(
        new URL("/api/v1/indexer", config.website_url).toString(),
        {
          headers: { "X-Api-Key": config.api_key, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => null);
      if (!response?.ok) {
        return badGateway(set, "Failed to fetch indexers from Prowlarr");
      }
      const raw = (await response.json()) as Array<Record<string, unknown>>;
      const indexers = raw.map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? ""),
        protocol: String(item.protocol ?? "torrent"),
        enable: Boolean(item.enable),
        privacy: String(item.privacy ?? "public"),
      }));
      // private trackers first, then public, alpha within each group
      indexers.sort((a, b) => {
        if (a.privacy === b.privacy) return a.name.localeCompare(b.name);
        return a.privacy === "private" ? -1 : 1;
      });
      return { indexers };
    } catch {
      return serverError(set, "Failed to fetch Prowlarr indexers");
    }
  })
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
