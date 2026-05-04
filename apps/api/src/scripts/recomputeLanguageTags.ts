/**
 * Recompute language_tags for all media files from their stored audio_tracks.
 * Fixes stale tags produced by the old classifier (e.g. "EN-", "FR-", "FR" where
 * "VFQ"/"VFF" is correct) without requiring a full MediaInfo rescan.
 *
 * Usage (from monorepo root):
 *   cd apps/api && bun --env-file=../../.env src/scripts/recomputeLanguageTags.ts
 *   cd apps/api && bun --env-file=../../.env src/scripts/recomputeLanguageTags.ts --dry-run
 */

import { classifyLanguageTags, type LibraryAudioTrack } from "@hously/shared";
import { prisma } from "@hously/api/db";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  // Only target files whose stored audio tracks contain BCP-47 codes (e.g.
  // "en-US", "fr-CA", "fr-FR"). Generic ISO codes like "fra" or "en" are
  // already handled correctly; re-classifying them risks downgrading VFF/VFQ
  // tags that were computed from richer data (title fields) during a prior scan.
  const files = await prisma.$queryRaw<
    { id: number; audio_tracks: unknown; language_tags: string[] }[]
  >`
    SELECT id, audio_tracks, language_tags
    FROM media_files
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(audio_tracks) AS t
      WHERE t->>'language' ~ '-'
    )
    ORDER BY id
  `;

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const correct = classifyLanguageTags(
      file.audio_tracks as LibraryAudioTrack[],
      null,
    );
    const current = [...file.language_tags].sort();
    const same =
      correct.length === current.length &&
      [...correct].sort().every((v, i) => v === current[i]);

    if (same) {
      skipped++;
      continue;
    }

    console.log(
      `File ${file.id}: ${JSON.stringify(current)} → ${JSON.stringify(correct)}`,
    );

    if (!dryRun) {
      await prisma.mediaFile.update({
        where: { id: file.id },
        data: { languageTags: correct },
      });
    }

    updated++;
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] Would update" : "Updated"} ${updated} files, ${skipped} already correct.`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
