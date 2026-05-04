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
  // Target files whose stored audio tracks contain BCP-47 codes (e.g. "en-US",
  // "fr-CA", "fr-FR") or "und" language with a non-empty title that may now be
  // recoverable. Generic ISO codes on files without those patterns are left alone
  // to avoid downgrading VFF/VFQ computed from richer data during a prior scan.
  const files = await prisma.$queryRaw<
    { id: number; audio_tracks: unknown; language_tags: string[] }[]
  >`
    SELECT id, audio_tracks, language_tags
    FROM media_files
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(audio_tracks) AS t
      WHERE t->>'language' ~ '-'
         OR (t->>'language' = 'und' AND coalesce(t->>'title', '') != '')
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
