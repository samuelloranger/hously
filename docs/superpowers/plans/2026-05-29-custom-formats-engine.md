# Custom Formats — Scoring Engine Foundation (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the release-scoring engine to support user-defined custom formats (with per-profile score / required / forbidden), a built-in `minSeeders` reject gate, and a structured i18n-safe score breakdown — additively, so a profile with zero custom formats scores byte-identically to today.

**Architecture:** Keep the proven `scoreRelease` logic; introduce a new `scoreReleaseDetailed()` that returns a structured `ScoreBreakdown` (codes + params, never localized prose). `scoreRelease` becomes a thin wrapper preserving its `number | string[]` contract, but its rejection strings become **stable codes**. A pure `customFormatEvaluator` evaluates condition sets. New Prisma models (`CustomFormat`, `QualityProfileCustomFormat`) and a `QualityProfile.minSeeders` column. All four `scoreRelease` callers thread `seeders` and the profile's assigned formats.

**Tech Stack:** Bun + Elysia + Prisma (PostgreSQL), TypeScript. Tests: `bun test`. This plan is **API-only** — no web/UI, no AI, no new HTTP routes (those are Plans 2 and 3).

**Scope boundary:** This plan does NOT surface the breakdown in any API response or add CRUD endpoints — `searchAndGrab` / search / RSS / upgrade-detection keep working exactly as before (with formats defaulting to none). It DOES change the rejection strings returned by `scoreRelease` from display tokens (`"Resolution"`) to stable codes (`"resolution_below_min"`); the search route passes these through as `rejection_reason` codes. The FE `t()` mapping of those codes is Plan 2 — until then the UI may show raw codes for rejected releases. Acceptable for this unstable, internal app.

---

## File Structure

- **Create** `apps/api/src/utils/medias/customFormatTypes.ts` — condition/format/breakdown types + rejection & component code unions.
- **Create** `apps/api/src/utils/medias/customFormatEvaluator.ts` — pure `conditionMatches` / `formatMatches`.
- **Create** `apps/api/src/utils/medias/customFormatEvaluator.test.ts` — evaluator unit tests.
- **Modify** `apps/api/src/utils/medias/releaseScorer.ts` — add `scoreReleaseDetailed`, codes, `minSeeders` gate, custom-format pass; `scoreRelease` becomes a wrapper accepting `seeders`.
- **Modify** `apps/api/src/utils/medias/releaseScorer.test.ts` — update rejection assertions to codes; add breakdown + minSeeders + format regression tests.
- **Modify** `apps/api/prisma/schema.prisma` — `CustomFormat`, `QualityProfileCustomFormat`, `QualityProfile.minSeeders` + relations.
- **Modify** `apps/api/src/services/mediaGrabberHelpers.ts` — `profileToScoreInput` maps formats + `minSeeders`; add `QualityProfileWithFormats` type + include helper.
- **Modify** the four `scoreRelease` call sites to load formats and pass `seeders`:
  - `apps/api/src/services/mediaGrabberSearch.ts:113`
  - `apps/api/src/utils/medias/pickBestRelease.ts:26`
  - `apps/api/src/services/upgradeDetection.ts:42`
  - `apps/api/src/routes/medias/search/index.ts:160` (+ local `toScoreInput`)

---

## Task 1: Prisma schema — custom format models + minSeeders

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the two new models**

Append after the `QualityProfile` model block:

```prisma
model CustomFormat {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  /// FormatCondition[] (see customFormatTypes.ts). A format MATCHES when ALL
  /// its conditions match; each condition is individually negatable.
  conditions  Json
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  profileLinks QualityProfileCustomFormat[]

  @@map("custom_formats")
}

model QualityProfileCustomFormat {
  id               Int     @id @default(autoincrement())
  qualityProfileId Int     @map("quality_profile_id")
  customFormatId   Int     @map("custom_format_id")
  score            Int     @default(0)
  required         Boolean @default(false)
  forbidden        Boolean @default(false)

  qualityProfile QualityProfile @relation(fields: [qualityProfileId], references: [id], onDelete: Cascade)
  customFormat   CustomFormat   @relation(fields: [customFormatId], references: [id], onDelete: Cascade)

  @@unique([qualityProfileId, customFormatId])
  @@index([qualityProfileId], map: "ix_qp_custom_format_profile")
  @@map("quality_profile_custom_formats")
}
```

- [ ] **Step 2: Add `minSeeders` + back-relation to `QualityProfile`**

Inside `model QualityProfile`, add after `cutoffResolution`:

```prisma
  minSeeders               Int      @default(0) @map("min_seeders")
```

And add to its relations block (next to `media` / `defaultForSettings`):

```prisma
  customFormats      QualityProfileCustomFormat[]
```

- [ ] **Step 3: Create the migration**

Run: `cd apps/api && bunx prisma migrate dev --name add_custom_formats`
Expected: a new folder under `apps/api/prisma/migrations/`, Prisma client regenerated, no errors.

- [ ] **Step 4: Verify client types**

Run: `cd apps/api && bunx prisma generate && bunx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors referencing `CustomFormat` / `minSeeders` (other pre-existing errors, if any, are out of scope).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(scoring): add CustomFormat, QualityProfileCustomFormat, minSeeders schema"
```

---

## Task 2: Shared scoring/format types

**Files:**
- Create: `apps/api/src/utils/medias/customFormatTypes.ts`

- [ ] **Step 1: Write the types file**

```typescript
// apps/api/src/utils/medias/customFormatTypes.ts
import type { ParsedRelease } from "@hously/api/utils/medias/filenameParser";

/** Condition dimensions — all derivable from existing parse/release data. */
export type ConditionType =
  | "title_regex"
  | "release_group"
  | "source"
  | "resolution"
  | "codec"
  | "language"
  | "hdr_flag"
  | "proper_repack"
  | "size_range"
  | "indexer"
  | "freeleech"
  | "seeders";

export type ConditionOperator =
  | "matches" // regex: title_regex, release_group
  | "equals" // source, codec, resolution, indexer, language
  | "gte"
  | "lte"
  | "lt"
  | "gt" // seeders, resolution
  | "between" // size_range (GB), seeders
  | "is_true"; // hdr_flag, proper_repack, freeleech

export interface FormatCondition {
  type: ConditionType;
  operator: ConditionOperator;
  /** string for regex/equals, number for numeric ops, [min,max] for between. */
  value?: string | number | [number, number];
  /** Invert this single condition's result. */
  negate?: boolean;
}

/** A custom format as it applies within one quality profile. */
export interface AssignedCustomFormat {
  name: string;
  conditions: FormatCondition[];
  score: number;
  required: boolean;
  forbidden: boolean;
}

/** Everything a condition can be evaluated against. */
export interface ReleaseEvalContext {
  parsed: ParsedRelease;
  rawTitle: string;
  sizeBytes: number | null;
  indexerName: string | null;
  seeders: number | null;
  freeleech: boolean;
}

/** Rejection reason as a stable code + interpolation params (NEVER localized prose). */
export interface RejectionReason {
  code: string;
  params?: Record<string, string | number>;
}

export type ScoreComponentCode =
  | "resolution_tier"
  | "preferred_source"
  | "preferred_codec"
  | "language_match"
  | "prefer_hdr"
  | "proper_repack"
  | "freeleech"
  | "tracker_priority"
  | "size_penalty"
  | "custom_format";

export interface ScoreComponent {
  code: ScoreComponentCode;
  value: number;
  params?: Record<string, string | number>;
}

export type ScoreBreakdown =
  | { rejected: true; reasons: RejectionReason[] }
  | {
      rejected: false;
      total: number;
      components: ScoreComponent[];
      matchedFormats: string[];
    };
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep customFormatTypes`
Expected: no output (file compiles).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/utils/medias/customFormatTypes.ts
git commit -m "feat(scoring): add custom-format and score-breakdown types"
```

---

## Task 3: Custom format evaluator (pure, TDD)

**Files:**
- Create: `apps/api/src/utils/medias/customFormatEvaluator.ts`
- Test: `apps/api/src/utils/medias/customFormatEvaluator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/utils/medias/customFormatEvaluator.test.ts
import { describe, expect, test } from "bun:test";
import type { ParsedRelease } from "@hously/api/utils/medias/filenameParser";
import type {
  FormatCondition,
  ReleaseEvalContext,
} from "@hously/api/utils/medias/customFormatTypes";
import {
  conditionMatches,
  formatMatches,
} from "@hously/api/utils/medias/customFormatEvaluator";

function parsed(overrides: Partial<ParsedRelease> = {}): ParsedRelease {
  return {
    resolution: 1080,
    source: "BluRay",
    codec: "x265",
    hdr: null,
    audio: null,
    group: null,
    streaming: null,
    isSample: false,
    isProper: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<ReleaseEvalContext> = {}): ReleaseEvalContext {
  return {
    parsed: parsed(),
    rawTitle: "Some.Movie.2024.1080p.BluRay.x265-GROUP",
    sizeBytes: 5_000_000_000,
    indexerName: "MyTracker",
    seeders: 42,
    freeleech: false,
    ...overrides,
  };
}

const cond = (c: Partial<FormatCondition>): FormatCondition => ({
  type: "title_regex",
  operator: "matches",
  ...c,
}) as FormatCondition;

describe("conditionMatches", () => {
  test("title_regex matches case-insensitively", () => {
    expect(
      conditionMatches(cond({ type: "title_regex", operator: "matches", value: "bluray" }), ctx()),
    ).toBe(true);
  });

  test("release_group matches parsed group", () => {
    expect(
      conditionMatches(
        cond({ type: "release_group", operator: "matches", value: "^GROUP$" }),
        ctx({ parsed: parsed({ group: "GROUP" }) }),
      ),
    ).toBe(true);
  });

  test("seeders gte passes/fails", () => {
    expect(conditionMatches(cond({ type: "seeders", operator: "gte", value: 10 }), ctx({ seeders: 42 }))).toBe(true);
    expect(conditionMatches(cond({ type: "seeders", operator: "gte", value: 100 }), ctx({ seeders: 42 }))).toBe(false);
  });

  test("seeders with null value never matches a numeric op", () => {
    expect(conditionMatches(cond({ type: "seeders", operator: "gte", value: 1 }), ctx({ seeders: null }))).toBe(false);
  });

  test("size_range between (GB) inclusive", () => {
    expect(conditionMatches(cond({ type: "size_range", operator: "between", value: [1, 10] }), ctx({ sizeBytes: 5_000_000_000 }))).toBe(true);
    expect(conditionMatches(cond({ type: "size_range", operator: "between", value: [6, 10] }), ctx({ sizeBytes: 5_000_000_000 }))).toBe(false);
  });

  test("hdr_flag is_true", () => {
    expect(conditionMatches(cond({ type: "hdr_flag", operator: "is_true" }), ctx({ parsed: parsed({ hdr: "HDR10" }) }))).toBe(true);
    expect(conditionMatches(cond({ type: "hdr_flag", operator: "is_true" }), ctx())).toBe(false);
  });

  test("indexer equals (case-insensitive)", () => {
    expect(conditionMatches(cond({ type: "indexer", operator: "equals", value: "mytracker" }), ctx())).toBe(true);
  });

  test("negate inverts the result", () => {
    expect(conditionMatches(cond({ type: "title_regex", operator: "matches", value: "bluray", negate: true }), ctx())).toBe(false);
  });

  test("invalid regex does not throw — returns false", () => {
    expect(conditionMatches(cond({ type: "title_regex", operator: "matches", value: "(" }), ctx())).toBe(false);
  });
});

describe("formatMatches", () => {
  test("matches only when ALL conditions match", () => {
    const conditions: FormatCondition[] = [
      cond({ type: "source", operator: "equals", value: "BluRay" }),
      cond({ type: "seeders", operator: "gte", value: 10 }),
    ];
    expect(formatMatches({ name: "F", conditions, score: 100, required: false, forbidden: false }, ctx())).toBe(true);
    expect(formatMatches({ name: "F", conditions, score: 100, required: false, forbidden: false }, ctx({ seeders: 1 }))).toBe(false);
  });

  test("empty conditions never matches (guards against an empty format scoring everything)", () => {
    expect(formatMatches({ name: "F", conditions: [], score: 100, required: false, forbidden: false }, ctx())).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && bun test src/utils/medias/customFormatEvaluator.test.ts`
Expected: FAIL — `conditionMatches`/`formatMatches` not exported.

- [ ] **Step 3: Implement the evaluator**

```typescript
// apps/api/src/utils/medias/customFormatEvaluator.ts
import { parseAudioFlags } from "@hously/api/utils/medias/filenameParser";
import type {
  AssignedCustomFormat,
  FormatCondition,
  ReleaseEvalContext,
} from "@hously/api/utils/medias/customFormatTypes";

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function numericCompare(op: FormatCondition["operator"], actual: number, value: FormatCondition["value"]): boolean {
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2) return false;
    const [min, max] = value;
    return actual >= min && actual <= max;
  }
  const target = asNumber(value);
  if (target == null) return false;
  switch (op) {
    case "gte": return actual >= target;
    case "lte": return actual <= target;
    case "lt": return actual < target;
    case "gt": return actual > target;
    case "equals": return actual === target;
    default: return false;
  }
}

function regexMatch(value: FormatCondition["value"], subject: string | null): boolean {
  if (typeof value !== "string" || subject == null) return false;
  try {
    return new RegExp(value, "i").test(subject);
  } catch {
    return false; // invalid regex never matches (and never throws)
  }
}

function stringEquals(value: FormatCondition["value"], subject: string | null): boolean {
  if (typeof value !== "string" || subject == null) return false;
  return value.trim().toLowerCase() === subject.trim().toLowerCase();
}

/** Evaluate a single condition (before negate is applied). */
function rawMatch(c: FormatCondition, ctx: ReleaseEvalContext): boolean {
  switch (c.type) {
    case "title_regex": return regexMatch(c.value, ctx.rawTitle);
    case "release_group": return regexMatch(c.value, ctx.parsed.group);
    case "source": return stringEquals(c.value, ctx.parsed.source);
    case "codec": return stringEquals(c.value, ctx.parsed.codec);
    case "indexer": return stringEquals(c.value, ctx.indexerName);
    case "resolution": {
      const res = ctx.parsed.resolution;
      if (res == null) return false;
      return numericCompare(c.operator, res, c.value);
    }
    case "language": {
      if (typeof c.value !== "string") return false;
      const flags = new Set(parseAudioFlags(ctx.rawTitle).map((f) => f.toLowerCase()));
      return flags.has(c.value.trim().toLowerCase());
    }
    case "hdr_flag": return ctx.parsed.hdr != null;
    case "proper_repack": return ctx.parsed.isProper;
    case "freeleech": return ctx.freeleech;
    case "seeders": {
      if (ctx.seeders == null) return false;
      return numericCompare(c.operator, ctx.seeders, c.value);
    }
    case "size_range": {
      if (ctx.sizeBytes == null) return false;
      const gb = ctx.sizeBytes / 1e9;
      return numericCompare(c.operator, gb, c.value);
    }
    default: return false;
  }
}

export function conditionMatches(c: FormatCondition, ctx: ReleaseEvalContext): boolean {
  const r = rawMatch(c, ctx);
  return c.negate ? !r : r;
}

/** A format matches when it has at least one condition and ALL conditions match. */
export function formatMatches(format: AssignedCustomFormat, ctx: ReleaseEvalContext): boolean {
  if (!format.conditions.length) return false;
  return format.conditions.every((c) => conditionMatches(c, ctx));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && bun test src/utils/medias/customFormatEvaluator.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/medias/customFormatEvaluator.ts apps/api/src/utils/medias/customFormatEvaluator.test.ts
git commit -m "feat(scoring): pure custom-format condition evaluator with tests"
```

---

## Task 4: scoreReleaseDetailed + codes + minSeeders + format pass (TDD)

**Files:**
- Modify: `apps/api/src/utils/medias/releaseScorer.ts`
- Modify: `apps/api/src/utils/medias/releaseScorer.test.ts`

This task refactors `scoreRelease` to delegate to a new `scoreReleaseDetailed`. The numeric scoring math is unchanged; only the *shape* changes (codes + components) and two new mechanisms are added (`minSeeders`, custom formats).

- [ ] **Step 1: Extend `QualityProfileScoreInput` and write failing tests**

In `apps/api/src/utils/medias/releaseScorer.ts`, add to the `QualityProfileScoreInput` interface (after `preferHdr`):

```typescript
  /** Built-in dead-torrent guard. 0 = off. Rejects when seeders < minSeeders (null seeders never rejected). */
  minSeeders: number;
  /** Custom formats assigned to this profile (with per-profile score + gates). */
  customFormats: AssignedCustomFormat[];
```

Add imports at the top of `releaseScorer.ts`:

```typescript
import type {
  AssignedCustomFormat,
  RejectionReason,
  ReleaseEvalContext,
  ScoreBreakdown,
  ScoreComponent,
} from "@hously/api/utils/medias/customFormatTypes";
import { formatMatches } from "@hously/api/utils/medias/customFormatEvaluator";
```

Now add tests to `apps/api/src/utils/medias/releaseScorer.test.ts`. First, update the existing `baseProfile` fixture to include the two new required fields:

```typescript
const baseProfile: QualityProfileScoreInput = {
  minResolution: 1080,
  cutoffResolution: null,
  preferredSources: ["BluRay", "WEB-DL"],
  preferredCodecs: ["x265", "x264"],
  preferredLanguages: [],
  prioritizedTrackers: [],
  preferTrackerOverQuality: false,
  maxSizeGb: null,
  requireHdr: false,
  preferHdr: false,
  minSeeders: 0,
  customFormats: [],
};
```

Then append new test blocks:

```typescript
import {
  scoreRelease,
  scoreReleaseDetailed,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import type { ReleaseEvalContext } from "@hously/api/utils/medias/customFormatTypes";

function ctxOf(
  p: ReturnType<typeof parsed>,
  over: Partial<ReleaseEvalContext> = {},
): ReleaseEvalContext {
  return {
    parsed: p,
    rawTitle: "Movie.2024.1080p.BluRay.x265-GROUP",
    sizeBytes: 5_000_000_000,
    indexerName: null,
    seeders: 50,
    freeleech: false,
    ...over,
  };
}

describe("rejection codes (i18n-safe)", () => {
  test("below min resolution → code resolution_below_min", () => {
    const r = scoreRelease(parsed({ resolution: 720 }), baseProfile, null);
    expect(r).toEqual(["resolution_below_min"]);
  });

  test("require HDR absent → hdr_required_absent", () => {
    const r = scoreRelease(parsed(), { ...baseProfile, requireHdr: true }, null);
    expect(r).toEqual(["hdr_required_absent"]);
  });
});

describe("minSeeders gate", () => {
  test("rejects below minSeeders → seeders_below_min", () => {
    const b = scoreReleaseDetailed(ctxOf(parsed(), { seeders: 2 }), { ...baseProfile, minSeeders: 5 });
    expect(b.rejected).toBe(true);
    if (b.rejected) expect(b.reasons.map((x) => x.code)).toContain("seeders_below_min");
  });

  test("null seeders is NOT rejected by the gate", () => {
    const b = scoreReleaseDetailed(ctxOf(parsed(), { seeders: null }), { ...baseProfile, minSeeders: 5 });
    expect(b.rejected).toBe(false);
  });
});

describe("custom format pass", () => {
  const atmos: AssignedCustomFormat = {
    name: "Atmos",
    conditions: [{ type: "title_regex", operator: "matches", value: "atmos" }],
    score: 200,
    required: false,
    forbidden: false,
  };

  test("matched format adds its score and appears in components", () => {
    const b = scoreReleaseDetailed(
      ctxOf(parsed(), { rawTitle: "Movie.2024.1080p.BluRay.Atmos.x265-GROUP" }),
      { ...baseProfile, customFormats: [atmos] },
    );
    expect(b.rejected).toBe(false);
    if (!b.rejected) {
      expect(b.matchedFormats).toContain("Atmos");
      expect(b.components.find((c) => c.code === "custom_format" && c.value === 200)).toBeDefined();
    }
  });

  test("forbidden format present → rejected", () => {
    const b = scoreReleaseDetailed(
      ctxOf(parsed(), { rawTitle: "Movie.2024.1080p.BluRay.Atmos.x265-GROUP" }),
      { ...baseProfile, customFormats: [{ ...atmos, forbidden: true }] },
    );
    expect(b.rejected).toBe(true);
    if (b.rejected) expect(b.reasons[0].code).toBe("custom_format_forbidden_present");
  });

  test("required format absent → rejected", () => {
    const b = scoreReleaseDetailed(ctxOf(parsed()), { ...baseProfile, customFormats: [{ ...atmos, required: true }] });
    expect(b.rejected).toBe(true);
    if (b.rejected) expect(b.reasons[0].code).toBe("custom_format_required_absent");
  });
});

describe("regression: no custom formats, minSeeders 0 → identical total", () => {
  test("score matches a hand-computed baseline", () => {
    // 1080p == minResolution (tier delta 0), source BluRay is preferredSources[0] (+500),
    // codec x265 is preferredCodecs[0] (+200) → 700.
    const r = scoreRelease(parsed(), baseProfile, 5_000_000_000, "Movie.2024.1080p.BluRay.x265-GROUP");
    expect(r).toBe(700);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && bun test src/utils/medias/releaseScorer.test.ts`
Expected: FAIL — `scoreReleaseDetailed` not exported; rejection strings are still `"Resolution"` not `"resolution_below_min"`.

- [ ] **Step 3: Refactor `releaseScorer.ts`**

Replace the body of `scoreRelease` (from `export function scoreRelease(` to its closing brace) with `scoreReleaseDetailed` + a thin wrapper. The numeric math below is copied verbatim from the current implementation — only the reject tokens become codes and components are recorded.

```typescript
export function scoreReleaseDetailed(
  ctx: ReleaseEvalContext,
  profile: QualityProfileScoreInput,
): ScoreBreakdown {
  const { parsed, sizeBytes, indexerName, seeders, freeleech } = ctx;
  const titleForFlags = ctx.rawTitle;
  const reasons: RejectionReason[] = [];

  const pr = resolutionRank(parsed.resolution);
  const minR = minResolutionRank(profile.minResolution);
  if (minR == null || pr == null) {
    reasons.push({ code: "resolution_below_min" });
  } else if (pr < minR) {
    reasons.push({ code: "resolution_below_min", params: { min: profile.minResolution } });
  } else if (profile.cutoffResolution != null) {
    const cutoffR = minResolutionRank(profile.cutoffResolution);
    if (cutoffR != null && pr > cutoffR) {
      reasons.push({ code: "resolution_above_cutoff", params: { cutoff: profile.cutoffResolution } });
    }
  }

  if (profile.requireHdr && !parsed.hdr) reasons.push({ code: "hdr_required_absent" });

  if (profile.preferredLanguages.length > 0) {
    const flags = new Set(parseAudioFlags(titleForFlags).map((f) => f.toLowerCase()));
    const hasMatch = profile.preferredLanguages.some((p) => flags.has(p.trim().toLowerCase()));
    if (!hasMatch) reasons.push({ code: "language_no_match" });
  }

  if (profile.maxSizeGb != null && sizeBytes != null && sizeBytes > profile.maxSizeGb * 1e9) {
    reasons.push({ code: "size_over_cap", params: { cap_gb: profile.maxSizeGb } });
  }

  if (parsed.isSample) reasons.push({ code: "is_sample" });

  // Built-in minSeeders gate — null seeders is treated as unknown (never rejected).
  if (profile.minSeeders > 0 && seeders != null && seeders < profile.minSeeders) {
    reasons.push({ code: "seeders_below_min", params: { min: profile.minSeeders, got: seeders } });
  }

  // Custom-format gates (required absent / forbidden present).
  const matchedFormats: string[] = [];
  for (const fmt of profile.customFormats) {
    const matched = formatMatches(fmt, ctx);
    if (matched) matchedFormats.push(fmt.name);
    if (fmt.required && !matched) reasons.push({ code: "custom_format_required_absent", params: { name: fmt.name } });
    if (fmt.forbidden && matched) reasons.push({ code: "custom_format_forbidden_present", params: { name: fmt.name } });
  }

  if (reasons.length > 0) return { rejected: true, reasons };

  const components: ScoreComponent[] = [];
  const add = (code: ScoreComponent["code"], value: number, params?: ScoreComponent["params"]) => {
    if (value !== 0) components.push({ code, value, ...(params ? { params } : {}) });
  };

  const tierDelta = pr! - minR!;
  add("resolution_tier", tierDelta * 1000, { tier: tierDelta });

  const srcIdx = profile.preferredSources.findIndex((pref) => parsedSourceMatchesPreferred(parsed.source, pref));
  add("preferred_source", indexScore(srcIdx, 500));

  const codecIdx = profile.preferredCodecs.findIndex((pref) => (parsed.codec ? codecMatches(pref, parsed.codec) : false));
  add("preferred_codec", indexScore(codecIdx, 200));

  add("language_match", languagePreferenceScore(titleForFlags, profile.preferredLanguages));

  if (profile.preferHdr && parsed.hdr) add("prefer_hdr", 100);
  if (parsed.isProper) add("proper_repack", 150);
  if (freeleech) add("freeleech", 200);

  if (profile.maxSizeGb == null && sizeBytes != null) {
    const gb = sizeBytes / 1e9;
    if (gb > 10) add("size_penalty", -Math.floor(gb - 10) * 50);
  }

  if (indexerName && profile.prioritizedTrackers.length > 0) {
    const trackerIdx = profile.prioritizedTrackers.findIndex((t) => t.toLowerCase() === indexerName.toLowerCase());
    if (trackerIdx >= 0) {
      const base = profile.preferTrackerOverQuality ? 1500 : 300;
      add("tracker_priority", indexScore(trackerIdx, base));
    }
  }

  for (const fmt of profile.customFormats) {
    if (matchedFormats.includes(fmt.name)) add("custom_format", fmt.score, { name: fmt.name });
  }

  const total = components.reduce((sum, c) => sum + c.value, 0);
  return { rejected: false, total, components, matchedFormats };
}

/**
 * Backwards-compatible wrapper. Returns a numeric score on success, or an array
 * of stable rejection CODES (not localized prose — the FE translates them).
 */
export function scoreRelease(
  parsed: ParsedRelease,
  profile: QualityProfileScoreInput,
  sizeBytes: number | null,
  releaseTitleForFlags?: string | null,
  indexerName?: string | null,
  freeleech?: boolean,
  seeders?: number | null,
): number | string[] {
  const breakdown = scoreReleaseDetailed(
    {
      parsed,
      rawTitle: releaseTitleForFlags ?? "",
      sizeBytes,
      indexerName: indexerName ?? null,
      seeders: seeders ?? null,
      freeleech: Boolean(freeleech),
    },
    profile,
  );
  return breakdown.rejected ? breakdown.reasons.map((r) => r.code) : breakdown.total;
}
```

> NOTE: The math (`tierDelta * 1000`, `indexScore(srcIdx, 500)`, etc.) is identical to the current implementation; the regression test in Step 1 guards the total. The helper functions (`resolutionRank`, `minResolutionRank`, `parsedSourceMatchesPreferred`, `codecMatches`, `indexScore`, `languagePreferenceScore`) already exist above in the file — keep them.

- [ ] **Step 4: Run the full scorer test file**

Run: `cd apps/api && bun test src/utils/medias/releaseScorer.test.ts`
Expected: PASS. If any pre-existing test asserts an old token (e.g. expects `"Resolution"`), update it to the new code (`"resolution_below_min"`, `"hdr_required_absent"`, `"language_no_match"`, `"size_over_cap"`, `"is_sample"`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/medias/releaseScorer.ts apps/api/src/utils/medias/releaseScorer.test.ts
git commit -m "feat(scoring): scoreReleaseDetailed with codes, minSeeders gate, custom-format pass"
```

---

## Task 5: Thread formats + seeders through `profileToScoreInput` and all callers

**Files:**
- Modify: `apps/api/src/services/mediaGrabberHelpers.ts`
- Modify: `apps/api/src/services/mediaGrabberSearch.ts` (call ~line 113)
- Modify: `apps/api/src/utils/medias/pickBestRelease.ts` (call ~line 26)
- Modify: `apps/api/src/services/upgradeDetection.ts` (call ~line 42)
- Modify: `apps/api/src/routes/medias/search/index.ts` (local `toScoreInput` + call ~line 160)

- [ ] **Step 1: Add a profile-with-formats loader + extend `profileToScoreInput`**

In `apps/api/src/services/mediaGrabberHelpers.ts`, add imports:

```typescript
import type { AssignedCustomFormat } from "@hously/api/utils/medias/customFormatTypes";
```

Add a reusable Prisma include + type and a loader, and extend the mapper:

```typescript
/** Prisma include that pulls a profile's assigned custom formats. */
export const qualityProfileFormatsInclude = {
  customFormats: { include: { customFormat: true } },
} as const;

type QualityProfileWithFormats = Prisma.QualityProfileGetPayload<{
  include: typeof qualityProfileFormatsInclude;
}>;

function mapAssignedFormats(p: QualityProfileWithFormats): AssignedCustomFormat[] {
  return (p.customFormats ?? []).map((link) => ({
    name: link.customFormat.name,
    conditions: (link.customFormat.conditions as AssignedCustomFormat["conditions"]) ?? [],
    score: link.score,
    required: link.required,
    forbidden: link.forbidden,
  }));
}

/** Load a quality profile with its custom formats, or null. */
export async function loadProfileWithFormats(
  id: number,
): Promise<QualityProfileWithFormats | null> {
  return prisma.qualityProfile.findUnique({
    where: { id },
    include: qualityProfileFormatsInclude,
  });
}
```

Then change the existing `profileToScoreInput` signature and body to accept the with-formats payload and populate the new fields:

```typescript
export function profileToScoreInput(
  p: QualityProfileWithFormats,
): QualityProfileScoreInput {
  return {
    minResolution: p.minResolution,
    cutoffResolution: p.cutoffResolution ?? null,
    preferredSources: p.preferredSources,
    preferredCodecs: p.preferredCodecs,
    preferredLanguages: p.preferredLanguages ?? [],
    prioritizedTrackers: p.prioritizedTrackers ?? [],
    preferTrackerOverQuality: p.preferTrackerOverQuality ?? false,
    maxSizeGb: p.maxSizeGb,
    requireHdr: p.requireHdr,
    preferHdr: p.preferHdr,
    minSeeders: p.minSeeders ?? 0,
    customFormats: mapAssignedFormats(p),
  };
}
```

- [ ] **Step 2: Update the profile load in `mediaGrabberSearch.ts`**

Find where the profile is loaded (the value passed to `profileToScoreInput`, around line 80–83). Change that `prisma.qualityProfile.findUnique({ where: { id: ... } })` to include formats:

```typescript
const prof = await prisma.qualityProfile.findUnique({
  where: { id: qualityProfileId },
  include: qualityProfileFormatsInclude,
});
```

Add `qualityProfileFormatsInclude` to the existing import from `mediaGrabberHelpers`. Then update the `scoreRelease` call (~line 113) to pass seeders:

```typescript
const sc = scoreRelease(
  parsed,
  profileInput,
  size,
  title,
  release.indexer,
  release.freeleech,
  release.seeders, // NEW — minSeeders gate + seeders conditions
);
```

- [ ] **Step 3: Update `pickBestRelease.ts` (~line 26)**

This util scores indexer releases. Pass `seeders` from the release object. Locate the `scoreRelease(` call and add the release's seeders as the 7th argument:

```typescript
const result = scoreRelease(
  parsed,
  scoreInput,
  release.sizeBytes ?? null,
  release.title,
  release.indexer,
  release.freeleech,
  release.seeders ?? null, // NEW
);
```

If `pickBestRelease` receives its `scoreInput` from a profile it loads itself, switch that load to `include: qualityProfileFormatsInclude` and `profileToScoreInput`. If it receives `scoreInput` from its caller, no profile-load change is needed here (the caller already supplies the full input).

- [ ] **Step 4: Update `upgradeDetection.ts` (~line 42)**

`filesFailProfile` scores *existing local files*, which have no seeders. Pass `null` for seeders so the `minSeeders` gate never rejects a local file:

```typescript
const result = scoreRelease(
  parsed,
  scoreInput,
  sizeBytes,
  fileName,
  null, // indexer — N/A for local files
  false, // freeleech — N/A
  null, // seeders — N/A for local files (minSeeders gate skipped)
);
```

Ensure whatever builds `scoreInput` here supplies `minSeeders` and `customFormats`. If it calls `profileToScoreInput`, switch its profile load to `include: qualityProfileFormatsInclude`. If it constructs the input inline, add `minSeeders: profile.minSeeders ?? 0` and `customFormats: mapAssignedFormats(profile)` (export `mapAssignedFormats` from helpers if needed).

- [ ] **Step 5: Update the search route (`routes/medias/search/index.ts`)**

The route has a local `toScoreInput(p: QualityProfile)`. Change it to accept the with-formats payload and populate the new fields (mirror `profileToScoreInput`):

```typescript
import {
  qualityProfileFormatsInclude,
  profileToScoreInput,
} from "@hously/api/services/mediaGrabberHelpers";
```

Replace the local `toScoreInput` usage with the shared `profileToScoreInput`, and change the route's profile load to `include: qualityProfileFormatsInclude`. Then update the `scoreRelease(` call (~line 160) to pass seeders:

```typescript
const score = scoreRelease(
  parsed,
  scoreInput,
  r.sizeBytes,
  r.title,
  r.indexer,
  r.freeleech,
  r.seeders, // NEW
);
```

> The route currently surfaces rejection strings as `rejection_reason`. Those are now codes (e.g. `resolution_below_min`). Leave the pass-through as-is — Plan 2 adds the FE `t()` mapping.

- [ ] **Step 6: Typecheck + full API test suite**

Run: `cd apps/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | head -30`
Expected: no errors in the modified files (a missing `minSeeders`/`customFormats` on any `QualityProfileScoreInput` literal is a compile error — fix by adding the fields).

Run: `cd apps/api && bun test`
Expected: PASS. Fix any test that built a `QualityProfileScoreInput` literal without the two new fields, or asserted an old rejection token.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(scoring): thread minSeeders + custom formats + seeders through all scoreRelease callers"
```

---

## Task 6: Lint + final verification

- [ ] **Step 1: Lint the API workspace**

Run: `cd apps/api && bun run lint 2>&1 | tail -20`
Expected: no new lint errors in changed files. Fix any (unused imports, etc.).

- [ ] **Step 2: Full repo typecheck**

Run: `make typecheck 2>&1 | tail -20`
Expected: API typechecks. (Web is untouched by this plan.)

- [ ] **Step 3: Confirm no behavior change for existing profiles (manual reasoning + test)**

Re-run: `cd apps/api && bun test src/utils/medias/releaseScorer.test.ts`
Confirm the `regression: no custom formats, minSeeders 0 → identical total` test passes — this is the guarantee that existing users see no scoring change.

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(scoring): lint + typecheck fixes for custom-format engine"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Engine additive layer ✓ (Task 4), CustomFormat + assignment + minSeeders schema ✓ (Task 1), 12-condition evaluator incl. seeders ✓ (Task 3), required/forbidden gates ✓ (Task 4), score breakdown with codes/components ✓ (Task 4), i18n codes (no prose) ✓ (Tasks 2/4), seeders as built-in gate + condition ✓ (Tasks 3/4), null-seeders handling ✓ (Tasks 3/4), all four callers threaded ✓ (Task 5), regression guarantee ✓ (Tasks 4/6). API/UI/AI explicitly deferred to Plans 2–3.
- **Placeholders:** none — every code step shows complete code.
- **Type consistency:** `scoreReleaseDetailed(ctx, profile) → ScoreBreakdown`; `scoreRelease(...7 args)` returns `number | string[]`; `QualityProfileScoreInput` gains `minSeeders: number` + `customFormats: AssignedCustomFormat[]`; `formatMatches(format, ctx)` / `conditionMatches(cond, ctx)` consistent across Tasks 3–5.

## Follow-on plans (not in this doc)

- **Plan 2 — API + UI:** CustomFormat CRUD endpoints, quality-profile payload extension (score/required/forbidden + minSeeders), surface `ScoreBreakdown` in the search response, FE condition builder + score-breakdown panel + `t()` mapping of all rejection/component codes (en + fr). **Use the `frontend-design` skill for the UI.**
- **Plan 3 — AI authoring + tuner:** `POST /api/custom-formats/ai-author` (intent → drafted conditions + regex preview against recent titles), `POST /api/custom-formats/ai-tune`, locale passed into prompts. Reuse `localAi` client + AI Pick JSON pattern.
