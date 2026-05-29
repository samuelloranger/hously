# Custom Formats — Transparent, AI-Tunable Release Scoring

**Date:** 2026-05-29
**Status:** Approved (design) — pending implementation plan
**Author:** Brainstormed with Claude

## Context

Hously replaces Radarr/Sonarr with a built-in media library. The chosen edge is
**AI applied to power-user depth**: use AI to collapse the expertise barrier on
the things power-users fight with, *without* removing manual control.

The single most powerful and most-hated part of the \*arr stack lives exactly
here: **custom formats and release scoring**. Configuring them correctly is a
dark art — the entire TRaSH-guides ecosystem exists because it's so hard. That
is a barrier AI can demolish and that \*arr structurally will not build.

### What exists today

- **`scoreRelease`** (`apps/api/src/utils/medias/releaseScorer.ts`, 225 lines) —
  a pure function. Hard-rejections accumulate into a `string[]` (returned early
  if any); otherwise a weighted numeric `score` accumulates from **fixed
  dimensions**: resolution tier ×1000, preferred source ×500, codec ×200,
  language ×300, `preferHdr` +100, PROPER/REPACK +150, freeleech +200, tracker
  priority bonus, and a size penalty. Return type: `number | string[]`.
- **`QualityProfile`** (`prisma/schema.prisma`) — the fixed-dimension config
  (`minResolution`, `cutoffResolution`, `preferredSources`, `preferredCodecs`,
  `preferredLanguages`, `prioritizedTrackers`, `preferTrackerOverQuality`,
  `maxSizeGb`, `requireHdr`, `preferHdr`).
- **Four consumers** of `scoreRelease`, all on the `number | string[]` contract:
  `searchAndGrab` (grab chokepoint), `filesFailProfile` (upgrade detection),
  `pickBest` (RSS auto-grab), and the interactive search route.
- **`ParsedRelease`** (`utils/medias/filenameParser.ts`) already parses
  resolution, source, codec, hdr, isSample, isProper, etc. Release-level
  properties (`indexerName`, `freeleech`, `sizeBytes`, **`seeders`**) are passed
  in alongside the parsed title — `seeders` is captured by both the Jackett and
  Prowlarr adapters and the release type, but is currently **unused by scoring**.

### The limitation

The scorer is **fixed-dimension**. You cannot express "reject anything from
release-group X", "+200 for Dolby Atmos", "prefer this specific edition", or
"never grab a release with < 5 seeders". That is the wall power-users hit.

## Goals

- Let users define arbitrary **custom formats** (named condition sets) with
  per-profile scores and hard required/forbidden gates — Radarr-parity power.
- Make every grab decision **fully inspectable** (per-release score breakdown).
- Use AI to **author** formats from natural language and **tune** scores from
  real history — the part \*arr won't build — always confirm-only.
- Work on a **small local model** (tiered) and remain fully usable with **AI
  off** (manual editor + transparency need no AI).

## Non-Goals

- Rewriting the proven fixed-dimension scorer. This is **additive** (Approach 1):
  a profile with zero custom formats behaves **byte-identically** to today.
- Autonomous mutation. AI proposes; the user reviews and confirms every field.
- A `minCustomFormatScore` accumulation gate (Radarr has one). Deferred — the
  explicit required/forbidden toggles cover hard gating more intuitively, and
  scores handle ranking. Revisit only if a real need appears.

## Architecture

### 1. Data model (additive — no migration of existing profiles)

```prisma
model CustomFormat {
  id         Int    @id @default(autoincrement())
  name       String
  /// Condition[] — a format MATCHES when ALL its conditions match.
  /// Condition = { type, operator, value, negate? }
  conditions Json
  @@map("custom_formats")
}

model QualityProfileCustomFormat {     // join — carries score + hard gates
  id               Int     @id @default(autoincrement())
  qualityProfileId Int     @map("quality_profile_id")
  customFormatId   Int     @map("custom_format_id")
  score            Int     @default(0)        // may be negative; ranking only
  required         Boolean @default(false)    // reject release if format ABSENT
  forbidden        Boolean @default(false)    // reject release if format PRESENT

  qualityProfile QualityProfile @relation(fields: [qualityProfileId], references: [id], onDelete: Cascade)
  customFormat   CustomFormat   @relation(fields: [customFormatId], references: [id], onDelete: Cascade)

  @@unique([qualityProfileId, customFormatId])
  @@map("quality_profile_custom_formats")
}

// QualityProfile gains: minSeeders Int @default(0)   // 0 = off
```

Existing profiles → zero custom formats, `minSeeders = 0` → identical behavior.

### 2. Condition types (v1 — all derivable from existing parse/release data)

`title_regex`, `release_group` (regex), `source`, `resolution`, `codec`,
`language` (audio flag), `hdr_flag`, `proper_repack`, `size_range`, `indexer`,
`freeleech`, **`seeders`** (operators `>=` / `<=` / `<` / `>` / range).

A format matches when **all** its conditions match; each condition is
individually negatable (`negate: true`).

### 3. Seeders handling (decided)

Seeders predict *deliverability*, not *quality* — so they are deliberately **not**
a built-in linear score term (a `score += seeders × k` term would bias toward
high-population public trackers, fight `prioritizedTrackers`, and let popularity
beat quality). Instead, two mechanisms:

1. **Built-in `minSeeders` hard-reject gate** on `QualityProfile` (default 0 =
   off; sane to enable at 1–3). The universal "never grab a dead torrent" guard
   for users who never author a custom format. Evaluated alongside the existing
   size/resolution hard rejects.
2. **`seeders` custom-format condition** for nuance: `forbidden if seeders < 5`
   (dead-torrent gate), `+50 if seeders >= 100` (a user-chosen, bounded
   tie-breaker), optionally scoped per-tracker by combining with an `indexer`
   condition. The cross-tracker trade-off becomes the user's explicit decision.

No built-in seeder *ranking* bonus — custom-format scores own ranking.

### 4. Engine integration (the additive pass)

`scoreRelease` keeps its `number | string[]` contract. New evaluation order:

1. Existing fixed-dimension hard rejects (resolution, HDR, language, size, sample).
2. **New built-in hard rejects:** `minSeeders` gate.
3. **Custom-format evaluation** (only if the profile has assigned formats):
   for each assigned format, evaluate its conditions against the parsed release +
   release-level properties:
   - `required` format absent → reject.
   - `forbidden` format present → reject.
   - otherwise add the format's `score` to the total (additive on top of the
     fixed-dimension base score).
4. If any rejections → return `string[]`; else return the numeric total.

The four existing callers are untouched when no formats are assigned.

### 5. Transparency (score breakdown — nearly free)

New **`scoreReleaseDetailed()`** returns a structured `ScoreBreakdown`:
- base components (resolution/source/codec/language/HDR/PROPER/freeleech/tracker/
  size penalty), each with its contribution;
- **each matched custom format and its score contribution**;
- required/forbidden/minSeeders gate outcomes;
- rejection reasons.

`scoreRelease` becomes a thin wrapper that collapses `ScoreBreakdown` to the old
`number | string[]`. The interactive-search UI renders an expandable per-release
breakdown (reuse existing release-row styling).

### 6. AI layer (tiered, confirm-only)

- **Authoring** — "describe what you want" → AI drafts a `CustomFormat`'s
  structured conditions + a suggested per-profile score. **Regex safety:**
  AI-proposed `title_regex` / `release_group` patterns are test-run against the
  user's recent real release titles and shown matching vs. non-matching **before
  save** — essential because a small local model writing regex is otherwise
  risky. The user edits every field; nothing auto-activates.
- **Tuner** — AI recommends format/score adjustments from the user's grab history
  (`DownloadHistory`) + what is actually available on their indexers. Proposes;
  user confirms.
- **Tier 0 (AI off):** manual format editor + score breakdown are fully usable
  with no AI.
- Tiering follows configured local-AI availability/capability (small vs capable
  model), reusing the `localAi` service and the AI Pick JSON-output / fenced-strip
  pattern.

### 7. API

- `GET/POST/PUT/DELETE /api/custom-formats` — CRUD for formats.
- Custom-format assignments (`score`/`required`/`forbidden`) edited via the
  existing quality-profile endpoints (extend `QualityProfile` payload).
- `POST /api/custom-formats/ai-author` — `{ intent }` → drafted format +
  regex-test results against recent titles.
- `POST /api/custom-formats/ai-tune` — `{ qualityProfileId }` → suggested
  adjustments + rationale.
- `POST /api/medias/search` (existing) returns the `ScoreBreakdown` per release.
- snake_case responses per conventions; query keys in `@/lib/queryKeys`.

### 8. UI

- **Settings → Quality Profiles:** a Custom Formats manager (list, create/edit
  with a condition builder, per-profile score + required/forbidden toggles),
  plus the `minSeeders` field on the profile.
- **AI authoring panel:** intent box → drafted conditions + live regex match
  preview against recent titles → review/edit → save.
- **AI tuner panel:** recommended adjustments with rationale and one-click apply
  (confirm-only).
- **Interactive search:** expandable per-release score breakdown.
- Reuse `AiPickBanner` styling for AI surfaces.

## Data flow (scoring)

parsed release + release props (incl. `seeders`) + profile (+ assigned formats)
→ `scoreReleaseDetailed()` → fixed-dimension base + `minSeeders` gate +
custom-format pass (required/forbidden/score) → `ScoreBreakdown` →
`number | string[]` for the four callers, full breakdown for the search UI.

## Error handling

- AI configured but unreachable → manual editor + breakdown still work; soft
  notice on AI panels.
- Invalid AI-proposed regex → caught and surfaced in the match-preview; never
  saved unvalidated.
- Profiles with no custom formats / `minSeeders = 0` → behavior identical to
  current `scoreRelease` (regression-guarded by test).
- Missing `seeders` on a release (null) → `minSeeders` gate and `seeders`
  conditions treat null as "unknown": do not hard-reject on null (avoid dropping
  releases from indexers that omit the field); document this.

## Testing

- Condition evaluation = pure functions, unit-tested with no AI.
- `ScoreBreakdown` snapshot tests across representative releases/profiles.
- **Regression test:** a no-custom-format profile scores identically to the
  pre-change `scoreRelease` across a fixture corpus.
- `minSeeders` gate + null-seeders handling tested explicitly.
- AI authoring/tuner: `localAi` mocked; assert bounded prompt, robust JSON parse,
  and that regex preview runs before save.

## Phasing (within this doc — all v1)

1. Schema (`CustomFormat`, `QualityProfileCustomFormat`, `minSeeders`) + migration.
2. Engine: `scoreReleaseDetailed()` + custom-format pass + `minSeeders` gate +
   `seeders` condition; `scoreRelease` wrapper; regression tests.
3. API CRUD + quality-profile payload extension; search returns `ScoreBreakdown`.
4. UI: custom-format manager + condition builder + score breakdown.
5. AI authoring (with regex preview) + AI tuner.

## Open questions

None blocking. Default `minSeeders` (0), the bounded tie-breaker score magnitudes
in AI-suggested formats, and the recent-titles sample size for regex preview are
tunable during implementation.
