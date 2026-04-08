/**
 * One-off script: sync added_at from Radarr/Sonarr into library_media.
 * Run from apps/api: bun run scripts/sync-added-at.ts
 * No MediaInfo rescan — only touches added_at.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeRadarrConfig, normalizeSonarrConfig } from "../src/utils/plugins/normalizers";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [radarrPlugin, sonarrPlugin] = await Promise.all([
    prisma.plugin.findFirst({ where: { type: "radarr" } }),
    prisma.plugin.findFirst({ where: { type: "sonarr" } }),
  ]);

  const radarrConfig = radarrPlugin?.enabled
    ? normalizeRadarrConfig(radarrPlugin.config)
    : null;

  const sonarrConfig = sonarrPlugin?.enabled
    ? normalizeSonarrConfig(sonarrPlugin.config)
    : null;

  // ── Radarr ────────────────────────────────────────────────────────────────
  if (radarrConfig) {
    console.log("Fetching Radarr movies...");
    const res = await fetch(`${radarrConfig.website_url}/api/v3/movie`, {
      headers: { "X-Api-Key": radarrConfig.api_key },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Radarr /api/v3/movie → ${res.status}`);

    const movies = (await res.json()) as Array<{ tmdbId: number; added?: string }>;

    let updated = 0;
    for (const movie of movies) {
      if (!movie.tmdbId || !movie.added) continue;
      const addedAt = new Date(movie.added);
      if (isNaN(addedAt.getTime())) continue;
      const r = await prisma.libraryMedia.updateMany({ where: { tmdbId: movie.tmdbId }, data: { addedAt } });
      if (r.count > 0) updated++;
    }
    console.log(`Radarr: updated ${updated} / ${movies.length} movies`);
  } else {
    console.log("Radarr not configured, skipping.");
  }

  // ── Sonarr ────────────────────────────────────────────────────────────────
  if (sonarrConfig) {
    console.log("Fetching Sonarr series...");
    const res = await fetch(`${sonarrConfig.website_url}/api/v3/series`, {
      headers: { "X-Api-Key": sonarrConfig.api_key },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Sonarr /api/v3/series → ${res.status}`);

    const allSeries = (await res.json()) as Array<{ tmdbId?: number; added?: string }>;

    let updated = 0;
    for (const series of allSeries) {
      if (!series.tmdbId || !series.added) continue;
      const addedAt = new Date(series.added);
      if (isNaN(addedAt.getTime())) continue;
      const r = await prisma.libraryMedia.updateMany({ where: { tmdbId: series.tmdbId }, data: { addedAt } });
      if (r.count > 0) updated++;
    }
    console.log(`Sonarr: updated ${updated} / ${allSeries.length} series`);
  } else {
    console.log("Sonarr not configured, skipping.");
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
