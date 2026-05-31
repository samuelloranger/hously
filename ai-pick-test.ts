// Ad-hoc regression test: run Hously's real "AI pick best release" use case against
// the local llama-swap models, across multiple datasets. Imports the REAL prompt
// builder; replicates the REAL parser from services/localAi/client.ts.
import {
  AI_SYSTEM_PROMPT,
  buildAiPickPrompt,
  type AiPickMediaContext,
  type AiPickRelease,
} from "./apps/api/src/utils/medias/buildAiPickPrompt";

// --- verbatim copy of parseLocalAiPickResponse from client.ts ---
function truncateAtWord(str: string, max: number): string {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}
function parseLocalAiPickResponse(responseText: string, candidates: AiPickRelease[]) {
  const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const trimmed = (fenceMatch ? fenceMatch[1] : responseText).trim();
  let parsed: { release_key?: string; reasoning?: string };
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed.release_key !== "string" || !candidates.some((r) => r.key === parsed.release_key)) {
    return null;
  }
  return { release_key: parsed.release_key, reasoning: truncateAtWord(parsed.reasoning ?? "", 150) };
}

type Scenario = {
  name: string;
  media: AiPickMediaContext;
  releases: AiPickRelease[];
  expected: string; // the key a good model should pick
  verdicts: Record<string, string>;
};

const SCENARIOS: Scenario[] = [
  {
    name: "movie + CAM trap",
    media: { title: "Dune: Part Two", year: 2024, type: "movie" },
    expected: "r5", // 2160p WEB-DL — best quality/size/seeders balance (r1 REMUX also defensible)
    releases: [
      { key: "r1", title: "Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos-FraMeSToR", size_bytes: 82_400_000_000, seeders: 38, score: 120 },
      { key: "r2", title: "Dune.Part.Two.2024.1080p.BluRay.x264-SPARKS", size_bytes: 12_300_000_000, seeders: 312, score: 95 },
      { key: "r3", title: "Dune.Part.Two.2024.720p.WEBRip.x264-GalaxyRG", size_bytes: 1_400_000_000, seeders: 540, score: 60 },
      { key: "r4", title: "Dune.Part.Two.2024.HDCAM.x264-CRYPTIC", size_bytes: 1_100_000_000, seeders: 9, score: 5 },
      { key: "r5", title: "Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.HDR.H265-FLUX", size_bytes: 18_700_000_000, seeders: 205, score: 110 },
    ],
    verdicts: {
      r1: "🆗 highest score but 82GB REMUX (defensible)",
      r2: "🆗 1080p, lots of seeders",
      r3: "🆗 720p, low quality",
      r4: "❌ CAM — must never pick",
      r5: "👍 best balance: 2160p WEB-DL, score 110, 205 seeders",
    },
  },
  {
    name: "tv season + dead-torrent/episode/foreign traps",
    media: { title: "The Bear", year: 2024, type: "tv" },
    expected: "r2",
    releases: [
      { key: "r1", title: "The.Bear.S03.2160p.DSNP.WEB-DL.DDP5.1.HDR.H265-NTb", size_bytes: 38_000_000_000, seeders: 0, score: 115 },
      { key: "r2", title: "The.Bear.S03.1080p.WEB-DL.DDP5.1.H264-FLUX", size_bytes: 14_000_000_000, seeders: 284, score: 100 },
      { key: "r3", title: "The.Bear.S03.COMPLETE.720p.WEBRip.x265-ION265", size_bytes: 5_200_000_000, seeders: 191, score: 72 },
      { key: "r4", title: "The.Bear.S03E01.1080p.WEB.h264-ETHEL", size_bytes: 1_800_000_000, seeders: 96, score: 40 },
      { key: "r5", title: "The.Bear.S03.FRENCH.1080p.WEB-DL.H264-FRATERNiTY", size_bytes: 13_000_000_000, seeders: 61, score: 55 },
    ],
    verdicts: {
      r1: "⚠️  DEAD torrent (0 seeders) — top score but undownloadable",
      r2: "👍 IDEAL — full season, 1080p, alive (284 seeders), high score",
      r3: "🆗 full season but only 720p",
      r4: "❌ single EPISODE, not the full season",
      r5: "❌ FRENCH audio — wrong language",
    },
  },
];

const IP = (await Bun.file("/tmp/llama_ip.txt").text()).trim();
const MODELS = ["qwen3-4b", "phi4-mini", "smollm3-3b"];

for (const sc of SCENARIOS) {
  console.log("\n#######################################################");
  console.log(`SCENARIO: ${sc.name}   (ideal pick = ${sc.expected})`);
  console.log("#######################################################");
  for (const model of MODELS) {
    let raw = "";
    try {
      const res = await fetch(`http://${IP}:8080/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: buildAiPickPrompt(sc.media, sc.releases) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      raw = ((await res.json()) as any)?.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      raw = `__FETCH_ERROR__ ${e}`;
    }
    const parsed = parseLocalAiPickResponse(raw, sc.releases);
    const tag = !parsed ? "❌ REJECTED (bad JSON/key)" : parsed.release_key === sc.expected ? "✅ IDEAL" : `picked ${parsed.release_key}`;
    console.log(`\n  ${model.padEnd(11)} → ${tag}`);
    if (parsed) {
      console.log(`     grade: ${sc.verdicts[parsed.release_key] ?? "?"}`);
      console.log(`     reasoning: ${parsed.reasoning}`);
    } else {
      console.log(`     raw: ${JSON.stringify(raw).slice(0, 200)}`);
    }
  }
}
