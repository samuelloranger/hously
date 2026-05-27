export interface AiPickRelease {
  key: string;
  title: string;
  size_bytes: number | null;
  seeders: number | null;
  score: number | null;
}

export interface AiPickMediaContext {
  title: string;
  year: number | null;
  type: string;
}

export const AI_SYSTEM_PROMPT =
  "You are a media release selection assistant for a homelab. " +
  "Given a list of torrent releases, pick the best one. " +
  'Respond ONLY with valid JSON matching: { "release_key": string, "reasoning": string }. ' +
  "Keep reasoning under 150 characters.";

export function buildAiPickPrompt(
  media: AiPickMediaContext,
  releases: AiPickRelease[],
): string {
  const header = `Media: ${media.title}${media.year ? ` (${media.year})` : ""} [${media.type}]`;

  const list = releases
    .map((r, i) => {
      const size =
        r.size_bytes != null
          ? `${(r.size_bytes / 1e9).toFixed(1)} GB`
          : "unknown size";
      const seeders =
        r.seeders != null ? `${r.seeders} seeders` : "unknown seeders";
      const score = r.score != null ? `score:${r.score}` : "unscored";
      return `${i + 1}. key="${r.key}" | ${r.title} | ${size} | ${seeders} | ${score}`;
    })
    .join("\n");

  return `${header}\n\nReleases:\n${list}\n\nPick the best release key and explain why in one sentence.`;
}
