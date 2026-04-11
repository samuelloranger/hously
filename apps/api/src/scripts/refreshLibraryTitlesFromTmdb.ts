/**
 * Refresh `library_media` title, sort_title, overview, year, poster (and movie
 * `digital_release_date`) from TMDB using English (en-US) — same as
 * `addOrUpdateLibraryFromTmdb`.
 *
 * Default: **dry-run** (no DB writes). Pass `--apply` to persist changes.
 *
 * Usage (from monorepo root):
 *   cd apps/api && bun --env-file=../../.env src/scripts/refreshLibraryTitlesFromTmdb.ts
 *   cd apps/api && bun --env-file=../../.env src/scripts/refreshLibraryTitlesFromTmdb.ts --apply
 *   cd apps/api && bun --env-file=../../.env src/scripts/refreshLibraryTitlesFromTmdb.ts --limit=5
 */

import { prisma } from "@hously/api/db";
import { normalizeTmdbConfig } from "@hously/api/utils/plugins/normalizers";
import { TMDB_LANGUAGE_LIBRARY_PERSISTENCE } from "@hously/api/utils/medias/tmdbFetchers";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function sortTitleFromName(name: string): string {
  return name.replace(/^(the |a |an )/i, "").trim();
}

function pickDigitalRelease(
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string }>;
  }>,
): Date | null {
  for (const country of ["US", ...results.map((r) => r.iso_3166_1)]) {
    const entry = results.find((r) => r.iso_3166_1 === country);
    const digital = entry?.release_dates.find((d) => d.type === 4);
    if (digital) return new Date(digital.release_date);
  }
  return null;
}

function sameInstant(a: Date | null | undefined, b: Date | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.getTime() === b.getTime();
}

const INTER_ITEM_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tmdbFetch<T>(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}/${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", TMDB_LANGUAGE_LIBRARY_PERSISTENCE);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

type PlannedChange = {
  id: number;
  tmdbId: number;
  type: string;
  fields: string[];
  before: { title: string; sortTitle: string | null; overview: string | null };
  after: { title: string; sortTitle: string; overview: string | null };
};

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg
    ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "", 10) || 0)
    : undefined;

  const plugin = await prisma.plugin.findFirst({
    where: { type: "tmdb" },
    select: { enabled: true, config: true },
  });
  const cfg = plugin?.enabled ? normalizeTmdbConfig(plugin.config) : null;
  const apiKey = cfg?.api_key ?? null;
  if (!apiKey) {
    console.error("TMDB plugin is not configured or disabled.");
    process.exit(1);
  }

  const rows = await prisma.libraryMedia.findMany({
    orderBy: { id: "asc" },
    ...(limit != null ? { take: limit } : {}),
    select: {
      id: true,
      tmdbId: true,
      type: true,
      title: true,
      sortTitle: true,
      overview: true,
      year: true,
      posterUrl: true,
      digitalReleaseDate: true,
    },
  });

  console.log(
    dryRun
      ? `Dry run: ${rows.length} library item(s). No writes. Use --apply to update.\n`
      : `Applying updates to ${rows.length} library item(s)…\n`,
  );

  const changes: PlannedChange[] = [];
  let errors = 0;
  let unchanged = 0;

  for (const row of rows) {
    try {
      if (row.type === "movie") {
        const [details, releaseDatesData] = await Promise.all([
          tmdbFetch<{
            title: string;
            release_date: string;
            poster_path: string | null;
            overview: string;
          }>(`movie/${row.tmdbId}`, apiKey),
          tmdbFetch<{
            results: Array<{
              iso_3166_1: string;
              release_dates: Array<{ type: number; release_date: string }>;
            }>;
          }>(`movie/${row.tmdbId}/release_dates`, apiKey),
        ]);

        const year = details.release_date
          ? parseInt(details.release_date.slice(0, 4), 10)
          : null;
        const posterUrl = details.poster_path
          ? `${TMDB_IMAGE_BASE}${details.poster_path}`
          : null;
        const digitalReleaseDate = pickDigitalRelease(releaseDatesData.results);
        const sortTitle = sortTitleFromName(details.title);
        const overview = details.overview || null;

        const titleChanged = row.title !== details.title;
        const sortChanged = (row.sortTitle ?? "") !== sortTitle;
        const overviewChanged = (row.overview ?? null) !== overview;
        const yearChanged = row.year !== year;
        const posterChanged = (row.posterUrl ?? null) !== posterUrl;
        const digitalChanged = !sameInstant(
          row.digitalReleaseDate,
          digitalReleaseDate,
        );

        const anyChange =
          titleChanged ||
          sortChanged ||
          overviewChanged ||
          yearChanged ||
          posterChanged ||
          digitalChanged;

        if (!anyChange) {
          unchanged += 1;
          continue;
        }

        const fields: string[] = [];
        if (titleChanged) fields.push("title");
        if (sortChanged) fields.push("sortTitle");
        if (overviewChanged) fields.push("overview");
        if (yearChanged) fields.push("year");
        if (posterChanged) fields.push("posterUrl");
        if (digitalChanged) fields.push("digitalReleaseDate");

        changes.push({
          id: row.id,
          tmdbId: row.tmdbId,
          type: row.type,
          fields,
          before: {
            title: row.title,
            sortTitle: row.sortTitle,
            overview: row.overview,
          },
          after: {
            title: details.title,
            sortTitle,
            overview,
          },
        });

        if (!dryRun) {
          await prisma.libraryMedia.update({
            where: { id: row.id },
            data: {
              title: details.title,
              sortTitle,
              overview,
              year,
              posterUrl,
              digitalReleaseDate,
            },
          });
        }
      } else if (row.type === "show") {
        const details = await tmdbFetch<{
          name: string;
          first_air_date: string;
          poster_path: string | null;
          overview: string;
        }>(`tv/${row.tmdbId}`, apiKey);

        const year = details.first_air_date
          ? parseInt(details.first_air_date.slice(0, 4), 10)
          : null;
        const posterUrl = details.poster_path
          ? `${TMDB_IMAGE_BASE}${details.poster_path}`
          : null;
        const sortTitle = sortTitleFromName(details.name);
        const overview = details.overview || null;

        const titleChanged = row.title !== details.name;
        const sortChanged = (row.sortTitle ?? "") !== sortTitle;
        const overviewChanged = (row.overview ?? null) !== overview;
        const yearChanged = row.year !== year;
        const posterChanged = (row.posterUrl ?? null) !== posterUrl;

        const anyChange =
          titleChanged ||
          sortChanged ||
          overviewChanged ||
          yearChanged ||
          posterChanged;

        if (!anyChange) {
          unchanged += 1;
          continue;
        }

        const fields: string[] = [];
        if (titleChanged) fields.push("title");
        if (sortChanged) fields.push("sortTitle");
        if (overviewChanged) fields.push("overview");
        if (yearChanged) fields.push("year");
        if (posterChanged) fields.push("posterUrl");

        changes.push({
          id: row.id,
          tmdbId: row.tmdbId,
          type: row.type,
          fields,
          before: {
            title: row.title,
            sortTitle: row.sortTitle,
            overview: row.overview,
          },
          after: {
            title: details.name,
            sortTitle,
            overview,
          },
        });

        if (!dryRun) {
          await prisma.libraryMedia.update({
            where: { id: row.id },
            data: {
              title: details.name,
              sortTitle,
              overview,
              year,
              posterUrl,
            },
          });
        }
      } else {
        unchanged += 1;
      }
    } catch (e) {
      errors += 1;
      console.error(
        `Error id=${row.id} tmdbId=${row.tmdbId} type=${row.type}:`,
        e instanceof Error ? e.message : e,
      );
    }
    await sleep(INTER_ITEM_DELAY_MS);
  }

  for (const c of changes) {
    console.log(
      `— [${c.type}] id=${c.id} tmdb=${c.tmdbId} fields=[${c.fields.join(", ")}]`,
    );
    console.log(`    title: ${JSON.stringify(c.before.title)} → ${JSON.stringify(c.after.title)}`);
    if (c.before.sortTitle !== c.after.sortTitle) {
      console.log(
        `    sortTitle: ${JSON.stringify(c.before.sortTitle)} → ${JSON.stringify(c.after.sortTitle)}`,
      );
    }
    if (c.before.overview !== c.after.overview) {
      const prev =
        c.before.overview == null
          ? "(null)"
          : c.before.overview.length > 120
            ? `${c.before.overview.slice(0, 120)}…`
            : c.before.overview;
      const next =
        c.after.overview == null
          ? "(null)"
          : c.after.overview.length > 120
            ? `${c.after.overview.slice(0, 120)}…`
            : c.after.overview;
      console.log(`    overview: ${prev} → ${next}`);
    }
    console.log("");
  }

  console.log(
    `Summary: ${changes.length} item(s) ${dryRun ? "would change" : "updated"}, ${unchanged} unchanged, ${errors} error(s).`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
