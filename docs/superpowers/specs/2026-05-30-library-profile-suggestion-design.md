# Suggest Quality Profile from Library (AI-assisted) — Design

**Date:** 2026-05-30
**Status:** Approved (design) — pending implementation plan
**Position:** Plan 4 of the Custom Formats arc (depends on Plans 1 + 2).

## Context

Part of the "AI applied to power-user depth" arc. After the custom-formats
scoring engine (Plan 1), CRUD + UI (Plan 2), and AI authoring/tuner (Plan 3),
this feature closes the onboarding gap: **analyze the user's existing library
and suggest a complete quality profile that matches what they actually keep.**

The \*arr stack makes new users hand-build quality profiles / custom formats
from scratch (the TRaSH-guide problem). Hously can instead *measure* a user's
demonstrated taste from their library and propose a profile — a zero-config
starting point no standalone downloader offers.

### Data surface (what makes this possible)

`MediaFile` (`prisma/schema.prisma`) stores rich per-file metadata for every
downloaded item: `resolution`, `source`, `videoCodec`, `hdrFormat`,
`releaseGroup`, `languageTags`, `audioFormat`, `bitDepth`, `sizeBytes`,
`isProper`. Aggregating these is a deterministic measurement of taste — no
guessing required.

### Decisions carried from brainstorming

- **Signal:** library files (`MediaFile`) only — "what you actually keep."
- **Output:** a full draft `QualityProfile` + suggested custom formats.
- **AI boundary:** deterministic derivation, with AI as a rationale/refinement
  layer. Works fully with AI OFF (rules alone produce a usable draft); the LLM
  only names, explains, and suggests nuance — safe on a small model,
  reproducible. (Tiered, consistent with the rest of the arc.)
- **Single profile** (no cluster detection in v1).
- **Confirm-only:** the endpoint suggests; nothing is persisted until the user
  reviews/edits and saves.
- **i18n:** backend returns stable codes + params; FE translates (en/fr). AI
  rationale is localized by passing the user locale into the prompt.

## Goals

- One-click "Suggest from library" → a complete, editable draft profile +
  custom formats grounded in real library statistics.
- Useful with AI disabled (deterministic draft + code-based rationale).
- Transparent: every derived field carries provenance (which stat drove it).

## Non-Goals

- No cluster detection / multiple-profile suggestion (v1 = one profile).
- No autonomous creation — user reviews and saves.
- No new persistence model — the suggest endpoint is read-only; saving reuses
  Plan 2's profile/custom-format create endpoints.
- The LLM does NOT invent thresholds/regex from raw data (Approach 2 rejected).

## Dependencies & sequencing

- **Plan 1 (built):** `CustomFormat`, `QualityProfileCustomFormat`,
  `QualityProfile.minSeeders`, the `AssignedCustomFormat` / condition types.
- **Plan 2 (required before build):** profile + custom-format CRUD endpoints and
  the create/save UI this feature reuses to persist the reviewed draft.
- Shares the `localAi` plumbing with Plan 3.
- **Build order:** spec now; implement after Plan 2 lands the save path (no
  stubs, no duplicated CRUD).

## Architecture

Four units, each independently testable.

### 1. `libraryTasteAnalyzer` (service)

Aggregates `MediaFile` rows for downloaded library items into `LibraryTasteStats`:

```ts
interface DimensionStat<T> { value: T; count: number; share: number; } // share = count / sample
interface LibraryTasteStats {
  sampleSize: number;                       // analyzable files
  resolution: DimensionStat<number>[];      // desc by count
  source: DimensionStat<string>[];
  videoCodec: DimensionStat<string>[];
  hdrFormat: DimensionStat<string>[];       // includes a "none" bucket
  language: DimensionStat<string>[];        // from languageTags (flattened)
  releaseGroup: DimensionStat<string>[];
  sizeGbByResolution: Record<number, { p50: number; p90: number; n: number }>;
  coverage: Record<string, number>;         // share of files with non-null value per dimension
}
```

Deterministic and pure given the rows. Excludes items with no files (wanted /
unmatched). Files with a null dimension value are excluded from that
dimension's distribution but counted in `coverage`.

### 2. `profileDeriver` (pure fn `deriveProfile(stats) → DraftProfile`)

Explicit, documented rules (defaults — tunable in implementation):

- `minResolution` = the dominant resolution (highest-count), used as the floor.
- `preferredSources` / `preferredCodecs` / `preferredLanguages` = values with
  `share ≥ 0.10`, ordered by count.
- `preferHdr` = true if HDR (non-"none") share ≥ 0.25; **never** auto-set
  `requireHdr` (too aggressive).
- `maxSizeGb` = the p90 of observed sizes at `minResolution`, rounded up; null if
  insufficient size data.
- `minSeeders` = 0 (not inferable from files).
- **Suggested custom format "Preferred Groups":** release groups appearing in
  `≥ 3` titles → one custom format with a `release_group` regex alternation
  (`^(GroupA|GroupB|...)$`) and a positive score (e.g. +50). Omitted if no group
  qualifies.

Returns:
```ts
interface DraftField<T> { value: T; provenanceCode: string; params?: Record<string, string|number>; }
interface DraftProfile {
  minResolution: DraftField<number>;
  preferredSources: DraftField<string[]>;
  preferredCodecs: DraftField<string[]>;
  preferredLanguages: DraftField<string[]>;
  preferHdr: DraftField<boolean>;
  maxSizeGb: DraftField<number | null>;
  minSeeders: DraftField<number>;
}
interface DraftCustomFormat { name: string; conditions: FormatCondition[]; score: number; required: boolean; forbidden: boolean; provenanceCode: string; }
```
`provenanceCode` examples: `min_resolution_dominant`, `source_by_frequency`,
`prefer_hdr_share`, `max_size_p90`, `preferred_groups_frequent`.

### 3. `profileSuggestionAi` (service, tiered, optional)

Given `LibraryTasteStats` + `DraftProfile`, the LLM returns JSON:
`{ name: string, rationale: string, refinements?: StructuredDelta[] }`.
- `name`: a short profile name.
- `rationale`: localized prose (user locale passed into the prompt).
- `refinements`: optional structured suggested changes the user may accept
  (e.g. tighten a source list) — never auto-applied.
Reuses the `localAi` client + AI Pick JSON-output / fenced-strip pattern, with a
bounded prompt. If AI is off/unreachable → return `ai_used: false` with a
deterministic name (e.g. "Library Match") and a **code-based fallback rationale**
assembled from the draft provenance codes (FE renders it via `t()`).

### 4. API + UI

- **`POST /api/quality-profiles/suggest-from-library`** (authenticated, read-only)
  → `{ sample_size, stats, draft_profile, draft_custom_formats, rationale, ai_used }`
  (snake_case). No DB writes.
- **Save** reuses Plan 2's `POST /api/quality-profiles` + custom-format create —
  the UI assembles the create payload from the reviewed draft.
- **UI** (Settings → Quality Profiles): a "Suggest from library" action → panel
  with (a) the analysis summary (distributions + sample size + coverage), (b) the
  editable proposed profile fields + suggested custom formats, (c) the rationale,
  (d) Create / Edit / Discard. Confirm-only. Built with the `frontend-design`
  skill. All labels i18n (en + fr); provenance + stat labels via codes.

## Data flow

`MediaFile` rows → `libraryTasteAnalyzer` → `LibraryTasteStats` →
`profileDeriver` → `DraftProfile` + draft formats → (optional) `profileSuggestionAi`
→ API response → UI review/edit → save via Plan 2 create endpoints.

## Error handling

- **Insufficient data:** sample size `< 10` analyzable files → respond with code
  `insufficient_library_data` (+ `sample_size`), no draft. UI suggests adding
  media first.
- **Sparse dimension coverage:** if a dimension's coverage is very low, the
  deriver omits that field rather than deriving from noise; `coverage` is
  surfaced so the UI can note it.
- **AI off/unreachable:** deterministic draft + code-based fallback rationale;
  `ai_used: false`. Never blocks.
- **No qualifying release groups:** no Preferred Groups format (don't force one).
- **All same resolution / single value:** still valid — derives a tight profile.

## Testing

- `libraryTasteAnalyzer` + `profileDeriver` are pure → fixture-driven unit tests:
  a "mostly 1080p BluRay x265 French" library asserts the expected draft;
  edge cases (empty, single-resolution, mixed, missing per-file metadata,
  no-qualifying-groups, insufficient-data threshold).
- `profileSuggestionAi`: `localAi` mocked; assert bounded prompt, locale passed,
  robust JSON parse, and the AI-off fallback path (`ai_used: false` + code
  rationale).
- API: read-only contract (no writes) verified.

## i18n (cross-cutting)

- Stat labels, dimension names, provenance codes, fallback rationale, UI strings
  → stable codes + params; FE maps to `t()` keys (en + fr added together).
- AI `rationale` → produced in the user locale via the prompt.
- User-authored content (final profile name if edited, group names) → verbatim.

## Planning note

The UI panel (analysis summary + editable draft + rationale) must be planned
with the `frontend-design` skill.

## Open questions

None blocking. The derivation thresholds (10% frequency, p90 size, 25% HDR,
≥3-title groups) and the insufficient-data floor (10 files) are tunable during
implementation.
