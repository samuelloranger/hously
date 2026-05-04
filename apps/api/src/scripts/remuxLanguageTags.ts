/**
 * Remux UND-tagged media files to embed correct language metadata.
 * - MKV: mkvpropedit (in-place, no temp file)
 * - MP4: ffmpeg -c copy (temp file, replaces original)
 * - AVI: mkvmerge → .mkv (path changes, DB updated)
 *
 * Usage:
 *   cd apps/api && bun --env-file=../../.env src/scripts/remuxLanguageTags.ts
 *   cd apps/api && bun --env-file=../../.env src/scripts/remuxLanguageTags.ts --dry-run
 */

import { $ } from "bun";
import { existsSync, renameSync, unlinkSync } from "fs";
import { dirname, basename, join } from "path";
import { classifyLanguageTags, type LibraryAudioTrack } from "@hously/shared";
import { prisma } from "@hously/api/db";

const dryRun = process.argv.includes("--dry-run");

// ─── Language tag → container metadata ────────────────────────────────────────

interface LangMeta {
  iso: string; // ISO 639-2 (mkvpropedit / ffmpeg)
  ietf: string; // BCP-47 (mkvpropedit language-ietf)
  name: string; // track name
}

const LANG_META: Record<string, LangMeta> = {
  EN: { iso: "eng", ietf: "en", name: "English" },
  VFQ: { iso: "fra", ietf: "fr-CA", name: "VFQ" },
  VFF: { iso: "fra", ietf: "fr-FR", name: "VFF" },
  VFI: { iso: "fra", ietf: "fr", name: "VFI" },
  FR: { iso: "fra", ietf: "fr", name: "French" },
};

// ─── Title → per-track language assignment ────────────────────────────────────

// Array index = audio track index; value = language tag to assign.
const TITLE_LANGS: Record<string, string[]> = {
  "58 minutes pour vivre": ["EN"],
  "Alien, la résurrection": ["EN"],
  "Alita : Battle Angel": ["EN"],
  Burlesque: ["VFF", "EN"],
  'El Camino : Un film "Breaking Bad"': ["EN"],
  Esther: ["EN"],
  "Fred Pellerin : La tuque en mousse de nombril": ["VFQ"],
  "Green Lantern": ["VFF"],
  "La Planète des singes : L'Affrontement": ["EN"],
  "Lac Mystère": ["VFQ"],
  "Le Roi lion 2 : L'Honneur de la tribu": ["VFI"],
  "Le Roi lion 3 : Hakuna matata": ["VFI"],
  "Les 4 Fantastiques": ["EN"],
  "Les 4 Fantastiques et le Surfer d'argent": ["EN"],
  "Pirates des Caraïbes : Jusqu'au bout du monde": ["EN"],
  "Pokémon Détective Pikachu": ["EN"],
  "X-Men Origins : Wolverine": ["EN"],
  "6teen": ["VFQ"],
  Bones: ["EN"],
  Cerebrum: ["VFQ"],
  "District 31": ["VFQ"],
  Friends: ["EN"],
  Joey: ["EN"],
  "Once Upon a Time (2011)": ["VFI"],
};

const WONDER_WOMAN_TITLE = "Wonder Woman";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ext(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();
}

async function processMkv(filePath: string, langs: string[]): Promise<boolean> {
  const args: string[] = [filePath];
  for (let i = 0; i < langs.length; i++) {
    const meta = LANG_META[langs[i]];
    if (!meta) {
      console.warn(`  Unknown tag ${langs[i]}, skipping track ${i}`);
      continue;
    }
    args.push(
      "--edit",
      `track:a${i + 1}`,
      "--set",
      `language=${meta.iso}`,
      "--set",
      `language-ietf=${meta.ietf}`,
      "--set",
      `name=${meta.name}`,
    );
  }
  if (dryRun) {
    console.log(`  [DRY] mkvpropedit ${args.join(" ")}`);
    return true;
  }
  const result = await $`mkvpropedit ${args}`.quiet();
  return result.exitCode === 0;
}

async function processMp4(filePath: string, langs: string[]): Promise<boolean> {
  const tmp = filePath + ".remux.tmp.mp4";
  const mapArgs: string[] = [];
  const metaArgs: string[] = [];
  for (let i = 0; i < langs.length; i++) {
    const meta = LANG_META[langs[i]];
    if (!meta) continue;
    metaArgs.push(`-metadata:s:a:${i}`, `language=${meta.iso}`);
    metaArgs.push(`-metadata:s:a:${i}`, `handler_name=${meta.name}`);
  }
  if (dryRun) {
    console.log(
      `  [DRY] ffmpeg -i "${filePath}" -c copy ${metaArgs.join(" ")} "${tmp}" && mv`,
    );
    return true;
  }
  const result =
    await $`ffmpeg -y -i ${filePath} -c copy -map 0 ${metaArgs} ${tmp}`.quiet();
  if (result.exitCode !== 0) {
    if (existsSync(tmp)) unlinkSync(tmp);
    return false;
  }
  renameSync(tmp, filePath);
  return true;
}

// Returns the new .mkv path, or null on failure.
async function processAvi(
  filePath: string,
  langs: string[],
): Promise<string | null> {
  const dir = dirname(filePath);
  const base = basename(filePath, "." + ext(filePath));
  const outPath = join(dir, base + ".mkv");

  const trackArgs: string[] = [];
  for (let i = 0; i < langs.length; i++) {
    const meta = LANG_META[langs[i]];
    if (!meta) continue;
    trackArgs.push(
      "--language",
      `${i}:${meta.iso}`,
      "--track-name",
      `${i}:${meta.name}`,
    );
  }

  if (dryRun) {
    console.log(
      `  [DRY] mkvmerge -o "${outPath}" ${trackArgs.join(" ")} "${filePath}"`,
    );
    console.log(`  [DRY] unlink "${filePath}"`);
    return outPath;
  }

  try {
    const result =
      await $`mkvmerge -o ${outPath} ${trackArgs} ${filePath}`.quiet();
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      // mkvmerge exits 1 for warnings, 2+ for errors
      throw new Error(`exit code ${result.exitCode}`);
    }
  } catch {
    // mkvmerge can't handle some codecs (e.g. WMA) — fall back to ffmpeg
    if (existsSync(outPath)) unlinkSync(outPath);
    console.warn("  mkvmerge failed, falling back to ffmpeg");
    const metaArgs: string[] = [];
    for (let i = 0; i < langs.length; i++) {
      const meta = LANG_META[langs[i]];
      if (!meta) continue;
      metaArgs.push(`-metadata:s:a:${i}`, `language=${meta.iso}`);
      metaArgs.push(`-metadata:s:a:${i}`, `handler_name=${meta.name}`);
    }
    const tmp = outPath + ".tmp";
    const fb =
      await $`ffmpeg -y -i ${filePath} -f matroska -c copy -map 0 ${metaArgs} ${tmp}`
        .quiet()
        .nothrow();
    if (fb.exitCode !== 0) {
      if (existsSync(tmp)) unlinkSync(tmp);
      return null;
    }
    renameSync(tmp, outPath);
  }
  unlinkSync(filePath);
  return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Handle Wonder Woman deletion separately
  const wwFile = await prisma.mediaFile.findFirst({
    where: { media: { title: WONDER_WOMAN_TITLE } },
    select: { id: true, filePath: true, mediaId: true },
  });
  if (wwFile) {
    console.log(`\nWonder Woman: ${wwFile.filePath}`);
    if (dryRun) {
      console.log(
        "  [DRY] delete file + remove media_file record + set status=wanted",
      );
    } else {
      if (existsSync(wwFile.filePath)) unlinkSync(wwFile.filePath);
      await prisma.mediaFile.delete({ where: { id: wwFile.id } });
      await prisma.libraryMedia.update({
        where: { id: wwFile.mediaId! },
        data: { status: "wanted" },
      });
      console.log("  Deleted file, removed record, status → wanted");
    }
  }

  // Fetch all UND files for the mapped titles
  const titles = Object.keys(TITLE_LANGS);
  const files = await prisma.mediaFile.findMany({
    where: {
      languageTags: { equals: ["UND"] },
      media: { title: { in: titles } },
    },
    select: {
      id: true,
      filePath: true,
      audioTracks: true,
      media: { select: { title: true } },
    },
    orderBy: { filePath: "asc" },
  });

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const title = file.media!.title;
    const langs = TITLE_LANGS[title];
    if (!langs) continue;

    const extension = ext(file.filePath);
    console.log(`\n[${extension.toUpperCase()}] ${file.filePath}`);
    console.log(`  → ${langs.join(", ")}`);

    let newPath: string | null = file.filePath;
    let success = false;

    if (extension === "mkv") {
      success = await processMkv(file.filePath, langs);
    } else if (extension === "mp4") {
      success = await processMp4(file.filePath, langs);
    } else if (extension === "avi") {
      newPath = await processAvi(file.filePath, langs);
      success = newPath !== null;
    } else {
      console.warn(`  Unsupported extension: ${extension}`);
      fail++;
      continue;
    }

    if (!success) {
      console.error("  FAILED");
      fail++;
      continue;
    }

    ok++;

    if (dryRun) continue;

    // Re-scan audio tracks from the updated file to get fresh metadata,
    // then recompute language_tags. For AVI→MKV, also update the path.
    const updateData: Record<string, unknown> = {};

    if (newPath !== file.filePath) {
      updateData.filePath = newPath;
      updateData.fileName = basename(newPath!);
    }

    // Build corrected audio tracks from the existing stored tracks,
    // overriding the language fields with the new assignments.
    const existingTracks = file.audioTracks as unknown as LibraryAudioTrack[];
    const updatedTracks = existingTracks.map((track, i) => {
      const tag = langs[i] ?? langs[langs.length - 1];
      const meta = LANG_META[tag];
      if (!meta) return track;
      return {
        ...track,
        language: tag === "EN" ? "en" : tag,
        language_name:
          tag === "EN"
            ? "English"
            : tag === "VFQ"
              ? "French (Québec)"
              : tag === "VFF"
                ? "French (France)"
                : tag === "VFI"
                  ? "French (International)"
                  : "French",
      };
    });

    updateData.audioTracks = updatedTracks as object[];
    updateData.languageTags = classifyLanguageTags(updatedTracks, null);

    await prisma.mediaFile.update({
      where: { id: file.id },
      data: updateData,
    });

    console.log(`  ✓ language_tags → ${updateData.languageTags}`);
  }

  console.log(`\n─────────────────────────────`);
  console.log(`${dryRun ? "[DRY RUN] " : ""}Done: ${ok} ok, ${fail} failed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
