import { Elysia, t } from "elysia";
import type { QualityProfile } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, conflict, forbidden, notFound, serverError } from "@hously/api/errors";

function mapProfile(p: QualityProfile) {
  return {
    id: p.id,
    name: p.name,
    min_resolution: p.minResolution,
    preferred_sources: p.preferredSources,
    preferred_codecs: p.preferredCodecs,
    preferred_languages: p.preferredLanguages,
    max_size_gb: p.maxSizeGb,
    require_hdr: p.requireHdr,
    prefer_hdr: p.preferHdr,
    cutoff_resolution: p.cutoffResolution,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

const RESOLUTIONS = new Set([480, 720, 1080, 2160]);

export const qualityProfilesRoutes = new Elysia({ prefix: "/api/quality-profiles" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ set }) => {
    try {
      const rows = await prisma.qualityProfile.findMany({
        orderBy: { name: "asc" },
      });
      return { profiles: rows.map(mapProfile) };
    } catch {
      return serverError(set, "Failed to list quality profiles");
    }
  })
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user?.is_admin) return forbidden(set, "Admin access required");
      if (!RESOLUTIONS.has(body.min_resolution)) {
        return badRequest(set, "min_resolution must be 480, 720, 1080, or 2160");
      }
      if (
        body.cutoff_resolution != null &&
        !RESOLUTIONS.has(body.cutoff_resolution)
      ) {
        return badRequest(
          set,
          "cutoff_resolution must be 480, 720, 1080, or 2160",
        );
      }
      try {
        const p = await prisma.qualityProfile.create({
          data: {
            name: body.name.trim(),
            minResolution: body.min_resolution,
            preferredSources: body.preferred_sources,
            preferredCodecs: body.preferred_codecs,
            preferredLanguages: body.preferred_languages ?? [],
            maxSizeGb: body.max_size_gb ?? null,
            requireHdr: body.require_hdr,
            preferHdr: body.prefer_hdr,
            cutoffResolution: body.cutoff_resolution ?? null,
          },
        });
        return { profile: mapProfile(p) };
      } catch (e: unknown) {
        const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002"
          ? "A profile with this name already exists"
          : "Failed to create quality profile";
        if (msg.includes("already exists")) {
          return conflict(set, msg);
        }
        return serverError(set, msg);
      }
    },
    {
      body: t.Object({
        name: t.String(),
        min_resolution: t.Number(),
        preferred_sources: t.Array(t.String()),
        preferred_codecs: t.Array(t.String()),
        preferred_languages: t.Optional(t.Array(t.String())),
        max_size_gb: t.Optional(t.Nullable(t.Number())),
        require_hdr: t.Boolean(),
        prefer_hdr: t.Boolean(),
        cutoff_resolution: t.Optional(t.Nullable(t.Number())),
      }),
    },
  )
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user?.is_admin) return forbidden(set, "Admin access required");
      const id = parseInt(params.id, 10);
      if (!Number.isFinite(id)) return badRequest(set, "Invalid id");
      if (!RESOLUTIONS.has(body.min_resolution)) {
        return badRequest(set, "min_resolution must be 480, 720, 1080, or 2160");
      }
      if (
        body.cutoff_resolution != null &&
        !RESOLUTIONS.has(body.cutoff_resolution)
      ) {
        return badRequest(
          set,
          "cutoff_resolution must be 480, 720, 1080, or 2160",
        );
      }
      try {
        const existing = await prisma.qualityProfile.findUnique({
          where: { id },
        });
        if (!existing) return notFound(set, "Quality profile not found");
        const p = await prisma.qualityProfile.update({
          where: { id },
          data: {
            name: body.name.trim(),
            minResolution: body.min_resolution,
            preferredSources: body.preferred_sources,
            preferredCodecs: body.preferred_codecs,
            preferredLanguages: body.preferred_languages ?? [],
            maxSizeGb: body.max_size_gb ?? null,
            requireHdr: body.require_hdr,
            preferHdr: body.prefer_hdr,
            cutoffResolution: body.cutoff_resolution ?? null,
          },
        });
        return { profile: mapProfile(p) };
      } catch (e: unknown) {
        const dup = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
        if (dup) return conflict(set, "A profile with this name already exists");
        return serverError(set, "Failed to update quality profile");
      }
    },
    {
      body: t.Object({
        name: t.String(),
        min_resolution: t.Number(),
        preferred_sources: t.Array(t.String()),
        preferred_codecs: t.Array(t.String()),
        preferred_languages: t.Optional(t.Array(t.String())),
        max_size_gb: t.Optional(t.Nullable(t.Number())),
        require_hdr: t.Boolean(),
        prefer_hdr: t.Boolean(),
        cutoff_resolution: t.Optional(t.Nullable(t.Number())),
      }),
    },
  )
  .delete("/:id", async ({ user, params, set }) => {
    if (!user?.is_admin) return forbidden(set, "Admin access required");
    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) return badRequest(set, "Invalid id");
    try {
      const existing = await prisma.qualityProfile.findUnique({
        where: { id },
      });
      if (!existing) return notFound(set, "Quality profile not found");
      const inUse = await prisma.libraryMedia.count({
        where: { qualityProfileId: id },
      });
      if (inUse > 0) {
        return conflict(
          set,
          "Cannot delete profile while library items are assigned to it",
        );
      }
      await prisma.qualityProfile.delete({ where: { id } });
      return { success: true };
    } catch {
      return serverError(set, "Failed to delete quality profile");
    }
  });
