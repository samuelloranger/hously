# Custom Formats — API + Profile Wiring (Plan 2a of the arc, backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose custom formats over the API (CRUD + condition validation), let quality profiles carry `min_seeders` and custom-format assignments, and surface the structured score breakdown + rejection codes in the interactive-search response.

**Architecture:** Build on Plan 1's engine (committed on this branch). Add a `/api/custom-formats` CRUD route, a pure `validateFormatConditions` guard reused by writes, extend the existing `/api/quality-profiles` create/update + `mapProfile` to handle `min_seeders` and assignments (persisted as `QualityProfileCustomFormat` rows), and change the search route to call `scoreReleaseDetailed` so it can return per-release `score_breakdown` and code-based `quality_rejection_reasons`.

**Tech Stack:** Bun + Elysia (TypeBox `t` validation) + Prisma. Tests: `bun test`. **Backend only** — the condition-builder UI, score-breakdown panel, and `t()` code translation are Plan 2b (frontend, built with the frontend-design skill).

**Database safety:** Root `.env` `DATABASE_URL` is PRODUCTION (port 5434). All tests/commands MUST override with the dev DB: `export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously"` (port 5433, running). NEVER run `prisma migrate`/`db push`/`migrate reset` here — Plan 1's migration already created the tables on the dev DB.

---

## File Structure

- **Create** `apps/api/src/utils/medias/customFormatValidation.ts` — pure `validateFormatConditions(value): { ok: true; conditions: FormatCondition[] } | { ok: false; code: string }`.
- **Create** `apps/api/src/utils/medias/customFormatValidation.test.ts`.
- **Create** `apps/api/src/routes/custom-formats/index.ts` — `customFormatsRoutes` (CRUD).
- **Create** `apps/api/src/routes/custom-formats/index.test.ts`.
- **Modify** `apps/api/src/index.ts` — mount `customFormatsRoutes`.
- **Modify** `apps/api/src/routes/quality-profiles/index.ts` — `mapProfile` returns `min_seeders` + `custom_formats`; create/update accept `min_seeders` + `custom_formats[]`.
- **Modify** `apps/api/src/routes/quality-profiles/index.test.ts` (create if absent) — assignment round-trip.
- **Modify** `apps/api/src/routes/medias/search/index.ts` — use `scoreReleaseDetailed`; populate `quality_rejection_reasons` (codes) + `score_breakdown`.
- **Modify** `apps/shared/src/types/media.ts` — add `score_breakdown?: ScoreBreakdownDto | null` to `InteractiveReleaseItem`; add the DTO type.

---

## Task 1: Condition validation (pure, TDD)

Validates the shape of `FormatCondition[]` and enforces valid operators per condition type — closing the "operator silently ignored" gap flagged in Plan 1 review.

**Files:**
- Create: `apps/api/src/utils/medias/customFormatValidation.ts`
- Test: `apps/api/src/utils/medias/customFormatValidation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/utils/medias/customFormatValidation.test.ts
import { describe, expect, test } from "bun:test";
import { validateFormatConditions } from "@hously/api/utils/medias/customFormatValidation";

describe("validateFormatConditions", () => {
  test("accepts a valid regex condition", () => {
    const r = validateFormatConditions([
      { type: "title_regex", operator: "matches", value: "atmos" },
    ]);
    expect(r.ok).toBe(true);
  });

  test("accepts seeders numeric + between", () => {
    expect(validateFormatConditions([{ type: "seeders", operator: "gte", value: 5 }]).ok).toBe(true);
    expect(validateFormatConditions([{ type: "size_range", operator: "between", value: [1, 10] }]).ok).toBe(true);
  });

  test("rejects non-array", () => {
    const r = validateFormatConditions("nope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("conditions_not_array");
  });

  test("rejects empty array", () => {
    const r = validateFormatConditions([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("conditions_empty");
  });

  test("rejects unknown condition type", () => {
    const r = validateFormatConditions([{ type: "bogus", operator: "equals", value: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("condition_type_invalid");
  });

  test("rejects an operator not allowed for the type (e.g. regex op on source)", () => {
    const r = validateFormatConditions([{ type: "source", operator: "matches", value: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("operator_invalid_for_type");
  });

  test("rejects invalid regex value", () => {
    const r = validateFormatConditions([{ type: "title_regex", operator: "matches", value: "(" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("regex_invalid");
  });

  test("rejects between without a 2-number tuple", () => {
    const r = validateFormatConditions([{ type: "size_range", operator: "between", value: [1] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_invalid_for_operator");
  });

  test("rejects numeric operator with non-number value", () => {
    const r = validateFormatConditions([{ type: "seeders", operator: "gte", value: "five" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_invalid_for_operator");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && bun test src/utils/medias/customFormatValidation.test.ts`
Expected: FAIL — `validateFormatConditions` not exported.

- [ ] **Step 3: Implement**

```typescript
// apps/api/src/utils/medias/customFormatValidation.ts
import type {
  ConditionOperator,
  ConditionType,
  FormatCondition,
} from "@hously/api/utils/medias/customFormatTypes";

const REGEX_TYPES = new Set<ConditionType>(["title_regex", "release_group"]);
const STRING_EQ_TYPES = new Set<ConditionType>(["source", "codec", "indexer", "language"]);
const NUMERIC_TYPES = new Set<ConditionType>(["resolution", "seeders", "size_range"]);
const BOOL_TYPES = new Set<ConditionType>(["hdr_flag", "proper_repack", "freeleech"]);

const ALL_TYPES = new Set<ConditionType>([
  ...REGEX_TYPES, ...STRING_EQ_TYPES, ...NUMERIC_TYPES, ...BOOL_TYPES,
]);

const NUMERIC_OPS = new Set<ConditionOperator>(["gte", "lte", "lt", "gt", "equals", "between"]);

type ValidationResult =
  | { ok: true; conditions: FormatCondition[] }
  | { ok: false; code: string };

function allowedOperators(type: ConditionType): Set<ConditionOperator> {
  if (REGEX_TYPES.has(type)) return new Set(["matches"]);
  if (STRING_EQ_TYPES.has(type)) return new Set(["equals"]);
  if (BOOL_TYPES.has(type)) return new Set(["is_true"]);
  // numeric
  return NUMERIC_OPS;
}

function valueOkForOperator(op: ConditionOperator, value: unknown): boolean {
  if (op === "is_true") return value === undefined || typeof value === "boolean";
  if (op === "matches" || op === "equals") {
    // regex/equals carry a string; numeric "equals" carries a number
    return typeof value === "string" || typeof value === "number";
  }
  if (op === "between") {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((v) => typeof v === "number" && Number.isFinite(v))
    );
  }
  // gte/lte/lt/gt
  return typeof value === "number" && Number.isFinite(value);
}

export function validateFormatConditions(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return { ok: false, code: "conditions_not_array" };
  if (value.length === 0) return { ok: false, code: "conditions_empty" };

  for (const raw of value) {
    if (typeof raw !== "object" || raw == null) return { ok: false, code: "condition_not_object" };
    const c = raw as Partial<FormatCondition>;
    if (typeof c.type !== "string" || !ALL_TYPES.has(c.type as ConditionType)) {
      return { ok: false, code: "condition_type_invalid" };
    }
    if (typeof c.operator !== "string") return { ok: false, code: "operator_invalid_for_type" };
    if (!allowedOperators(c.type as ConditionType).has(c.operator as ConditionOperator)) {
      return { ok: false, code: "operator_invalid_for_type" };
    }
    if (c.negate !== undefined && typeof c.negate !== "boolean") {
      return { ok: false, code: "negate_invalid" };
    }
    if (!valueOkForOperator(c.operator as ConditionOperator, c.value)) {
      return { ok: false, code: "value_invalid_for_operator" };
    }
    if (c.operator === "matches" && typeof c.value === "string") {
      try {
        new RegExp(c.value);
      } catch {
        return { ok: false, code: "regex_invalid" };
      }
    }
  }
  return { ok: true, conditions: value as FormatCondition[] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && bun test src/utils/medias/customFormatValidation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/medias/customFormatValidation.ts apps/api/src/utils/medias/customFormatValidation.test.ts
git commit -m "feat(custom-formats): condition validation with per-type operator rules"
```

---

## Task 2: CustomFormat CRUD route

**Files:**
- Create: `apps/api/src/routes/custom-formats/index.ts`
- Test: `apps/api/src/routes/custom-formats/index.test.ts`

- [ ] **Step 1: Implement the route**

```typescript
// apps/api/src/routes/custom-formats/index.ts
import { Elysia, t } from "elysia";
import type { CustomFormat } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, conflict, forbidden, notFound, serverError } from "@hously/api/errors";
import { validateFormatConditions } from "@hously/api/utils/medias/customFormatValidation";

function mapCustomFormat(f: CustomFormat) {
  return {
    id: f.id,
    name: f.name,
    conditions: f.conditions,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
  };
}

const bodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  conditions: t.Array(t.Record(t.String(), t.Any())),
});

export const customFormatsRoutes = new Elysia({ prefix: "/api/custom-formats" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ set }) => {
    try {
      const rows = await prisma.customFormat.findMany({ orderBy: { name: "asc" } });
      return { custom_formats: rows.map(mapCustomFormat) };
    } catch {
      return serverError(set, "Failed to list custom formats");
    }
  })
  .get("/:id", async ({ params, set }) => {
    const row = await prisma.customFormat.findUnique({ where: { id: Number(params.id) } });
    if (!row) return notFound(set, "Custom format not found");
    return mapCustomFormat(row);
  })
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user?.is_admin) return forbidden(set, "Admin access required");
      const v = validateFormatConditions(body.conditions);
      if (!v.ok) return badRequest(set, v.code);
      try {
        const row = await prisma.customFormat.create({
          data: { name: body.name.trim(), conditions: v.conditions },
        });
        set.status = 201;
        return mapCustomFormat(row);
      } catch (e) {
        if (String(e).includes("Unique constraint")) return conflict(set, "A custom format with that name already exists");
        return serverError(set, "Failed to create custom format");
      }
    },
    { body: bodySchema },
  )
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user?.is_admin) return forbidden(set, "Admin access required");
      const v = validateFormatConditions(body.conditions);
      if (!v.ok) return badRequest(set, v.code);
      try {
        const row = await prisma.customFormat.update({
          where: { id: Number(params.id) },
          data: { name: body.name.trim(), conditions: v.conditions },
        });
        return mapCustomFormat(row);
      } catch (e) {
        if (String(e).includes("Record to update not found")) return notFound(set, "Custom format not found");
        if (String(e).includes("Unique constraint")) return conflict(set, "A custom format with that name already exists");
        return serverError(set, "Failed to update custom format");
      }
    },
    { body: bodySchema },
  )
  .delete("/:id", async ({ user, params, set }) => {
    if (!user?.is_admin) return forbidden(set, "Admin access required");
    try {
      await prisma.customFormat.delete({ where: { id: Number(params.id) } });
      return { deleted: true };
    } catch (e) {
      if (String(e).includes("Record to delete does not exist")) return notFound(set, "Custom format not found");
      return serverError(set, "Failed to delete custom format");
    }
  });
```

> NOTE: confirm the exact helper names in `@hously/api/errors` (e.g. `badRequest`, `conflict`, `forbidden`, `notFound`, `serverError`) by reading `apps/api/src/errors.ts` (or wherever `@hously/api/errors` resolves) and the `user.is_admin` shape by checking how `quality-profiles/index.ts` reads it — mirror that exactly.

- [ ] **Step 2: Write a route test (TDD-after for an Elysia route is acceptable here; mirror an existing route test file's setup)**

First read an existing route test (e.g. `apps/api/src/routes/quality-profiles/index.test.ts` if present, else another `routes/**/index.test.ts`) to copy the app-bootstrap + auth-mock pattern. Then:

```typescript
// apps/api/src/routes/custom-formats/index.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { prisma } from "@hously/api/db";
import { customFormatsRoutes } from "@hously/api/routes/custom-formats";
// Reuse the project's existing test harness for authenticated admin requests.
// Mirror the helper used by other route tests (e.g. a makeRequest/withAdmin util).

describe("custom-formats route", () => {
  beforeEach(async () => {
    await prisma.customFormat.deleteMany({});
  });

  test("POST creates, GET lists, PUT updates, DELETE removes", async () => {
    // Use the same authenticated-request helper other route tests use.
    // 1. POST { name: "Atmos", conditions: [{type:"title_regex",operator:"matches",value:"atmos"}] } → 201, returns id
    // 2. GET "/" → custom_formats contains "Atmos"
    // 3. PUT :id with new name → 200, name updated
    // 4. DELETE :id → { deleted: true }; GET :id → 404
    // Assertions per step.
  });

  test("POST with invalid operator-for-type → 400 operator_invalid_for_type", async () => {
    // POST conditions [{type:"source",operator:"matches",value:"x"}] → expect 400 with code
  });
});
```

> If the project has NO reusable authenticated-route test harness, implement these as direct handler/integration tests following whatever pattern the nearest existing `routes/**/*.test.ts` uses. Do NOT invent a new harness — match the codebase. If no route is unit-tested anywhere, report DONE_WITH_CONCERNS and cover the logic via the `validateFormatConditions` unit tests (Task 1) instead, noting the gap.

- [ ] **Step 3: Run tests**

Run: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bun test src/routes/custom-formats/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/custom-formats
git commit -m "feat(custom-formats): CRUD route with validation + admin gating"
```

---

## Task 3: Mount the route

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add import + `.use()`**

Mirror the existing `qualityProfilesRoutes` wiring (import near line 28, `.use(...)` near line 140):

```typescript
import { customFormatsRoutes } from "./routes/custom-formats";
// ... in the plugin chain, next to .use(qualityProfilesRoutes):
  .use(customFormatsRoutes)
```

- [ ] **Step 2: Typecheck + smoke**

Run: `cd apps/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "custom-formats|index.ts" || echo "clean"`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(custom-formats): mount customFormatsRoutes"
```

---

## Task 4: Quality-profile payload — min_seeders + custom-format assignments

**Files:**
- Modify: `apps/api/src/routes/quality-profiles/index.ts`
- Test: `apps/api/src/routes/quality-profiles/index.test.ts` (create if absent)

- [ ] **Step 1: Extend `mapProfile`**

Change the profile load in the list/get handlers to `include: { customFormats: { include: { customFormat: true } } }` (reuse `qualityProfileFormatsInclude` from `@hously/api/services/mediaGrabberHelpers`), and extend `mapProfile`:

```typescript
import { qualityProfileFormatsInclude } from "@hously/api/services/mediaGrabberHelpers";
import type { Prisma } from "@prisma/client";

type ProfileWithFormats = Prisma.QualityProfileGetPayload<{
  include: typeof qualityProfileFormatsInclude;
}>;

function mapProfile(p: ProfileWithFormats) {
  return {
    id: p.id,
    name: p.name,
    min_resolution: p.minResolution,
    preferred_sources: p.preferredSources,
    preferred_codecs: p.preferredCodecs,
    preferred_languages: p.preferredLanguages,
    prioritized_trackers: p.prioritizedTrackers,
    prefer_tracker_over_quality: p.preferTrackerOverQuality,
    max_size_gb: p.maxSizeGb,
    require_hdr: p.requireHdr,
    prefer_hdr: p.preferHdr,
    cutoff_resolution: p.cutoffResolution,
    min_seeders: p.minSeeders,
    custom_formats: (p.customFormats ?? []).map((l) => ({
      custom_format_id: l.customFormatId,
      name: l.customFormat.name,
      score: l.score,
      required: l.required,
      forbidden: l.forbidden,
    })),
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}
```

Update both `findMany`/`findUnique` profile reads to add `include: qualityProfileFormatsInclude`.

- [ ] **Step 2: Extend create/update body + persistence**

Add to the TypeBox body schema for POST and PUT:

```typescript
  min_seeders: t.Optional(t.Integer({ minimum: 0 })),
  custom_formats: t.Optional(
    t.Array(
      t.Object({
        custom_format_id: t.Integer(),
        score: t.Integer(),
        required: t.Optional(t.Boolean()),
        forbidden: t.Optional(t.Boolean()),
      }),
    ),
  ),
```

In the create handler `data`, add `minSeeders: body.min_seeders ?? 0`. After creating the profile, persist assignments inside the same transaction:

```typescript
const created = await prisma.$transaction(async (tx) => {
  const profile = await tx.qualityProfile.create({
    data: {
      name: body.name.trim(),
      minResolution: body.min_resolution,
      preferredSources: body.preferred_sources,
      preferredCodecs: body.preferred_codecs,
      preferredLanguages: body.preferred_languages ?? [],
      prioritizedTrackers: body.prioritized_trackers ?? [],
      preferTrackerOverQuality: body.prefer_tracker_over_quality ?? false,
      maxSizeGb: body.max_size_gb ?? null,
      requireHdr: body.require_hdr,
      preferHdr: body.prefer_hdr,
      cutoffResolution: body.cutoff_resolution ?? null,
      minSeeders: body.min_seeders ?? 0,
    },
  });
  if (body.custom_formats?.length) {
    await tx.qualityProfileCustomFormat.createMany({
      data: body.custom_formats.map((a) => ({
        qualityProfileId: profile.id,
        customFormatId: a.custom_format_id,
        score: a.score,
        required: a.required ?? false,
        forbidden: a.forbidden ?? false,
      })),
    });
  }
  return tx.qualityProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: qualityProfileFormatsInclude,
  });
});
return mapProfile(created);
```

For the UPDATE handler: update scalar fields including `minSeeders`, then **replace** assignments (delete existing `qualityProfileCustomFormat` for the profile, recreate from `body.custom_formats` if provided) inside a `$transaction`, then re-read with the include and `mapProfile`. Leave assignments untouched when `custom_formats` is omitted (undefined) — only replace when the field is present.

> Wrap `createMany` in try/catch: a non-existent `custom_format_id` will violate the FK. On FK error return `badRequest(set, "unknown custom_format_id")`.

- [ ] **Step 3: Test the assignment round-trip**

Using the project's route test harness (mirror the custom-formats test from Task 2):

```typescript
// in apps/api/src/routes/quality-profiles/index.test.ts
// 1. Create a custom format -> id
// 2. POST a quality profile with custom_formats:[{custom_format_id:id, score:200, required:false, forbidden:true}] and min_seeders:3
// 3. GET the profile -> custom_formats[0] matches (score 200, forbidden true), min_seeders 3
// 4. PUT with custom_formats:[] -> GET shows no assignments; min_seeders update persists
```

Run: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bun test src/routes/quality-profiles/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/quality-profiles
git commit -m "feat(quality-profiles): accept min_seeders + custom-format assignments"
```

---

## Task 5: Surface ScoreBreakdown + rejection codes in interactive search

**Files:**
- Modify: `apps/shared/src/types/media.ts`
- Modify: `apps/api/src/routes/medias/search/index.ts`

- [ ] **Step 1: Add the DTO + field to shared types**

In `apps/shared/src/types/media.ts`, add (near `InteractiveReleaseItem`):

```typescript
export interface ScoreComponentDto {
  code: string;
  value: number;
  params?: Record<string, string | number>;
}
export interface ScoreBreakdownDto {
  rejected: boolean;
  total: number | null;          // null when rejected
  components: ScoreComponentDto[]; // empty when rejected
  matched_formats: string[];
}
```

Add to `InteractiveReleaseItem`: `score_breakdown?: ScoreBreakdownDto | null;`

- [ ] **Step 2: Populate from the engine in the search route**

In `apps/api/src/routes/medias/search/index.ts`, the scoring already calls `scoreRelease(...)` (~line 160 in Plan 1). Switch that path to `scoreReleaseDetailed` so the full breakdown is available, and map it. Import `scoreReleaseDetailed` from `@hously/api/utils/medias/releaseScorer`. Build the `ReleaseEvalContext` the same way the wrapper does:

```typescript
const breakdown = scoreReleaseDetailed(
  {
    parsed,
    rawTitle: r.title,
    sizeBytes: r.sizeBytes,
    indexerName: r.indexer,
    seeders: r.seeders,
    freeleech: Boolean(r.freeleech),
  },
  scoreInput,
);
```

Then in the release mapping (the `normalizedToInteractive`-style object around lines 40–55), set:

```typescript
quality_score: breakdown.rejected ? null : breakdown.total,
quality_rejection_reasons: breakdown.rejected ? breakdown.reasons.map((x) => x.code) : null,
score_breakdown: {
  rejected: breakdown.rejected,
  total: breakdown.rejected ? null : breakdown.total,
  components: breakdown.rejected ? [] : breakdown.components.map((c) => ({ code: c.code, value: c.value, ...(c.params ? { params: c.params } : {}) })),
  matched_formats: breakdown.rejected ? [] : breakdown.matchedFormats,
},
```

Keep `rejection_reason` (the joined human string) for now to avoid breaking existing FE; Plan 2b switches the FE to `quality_rejection_reasons` + `score_breakdown` and then it can be removed.

> The exact wiring of where `parsed`, `scoreInput`, and `r` are in scope must be confirmed by reading the current search route — thread `breakdown` to the mapping. If `parsed`/`scoreInput` are computed in a different function than the mapping, compute the breakdown where both the parsed release and `scoreInput` are available and pass `score_breakdown` through.

- [ ] **Step 3: Typecheck + scoring tests still green**

Run: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "search/index|media.ts" || echo "clean"`
Run: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bun test src/utils/medias/releaseScorer.test.ts 2>&1 | tail -4`
Expected: clean typecheck; 47+ scorer tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/shared/src/types/media.ts apps/api/src/routes/medias/search/index.ts
git commit -m "feat(search): return score_breakdown + rejection codes per release"
```

---

## Task 6: Lint + full verification

- [ ] **Step 1: Lint API src**

Run: `cd apps/api && bunx eslint src --ext .ts 2>&1 | tail -15`
Expected: clean (ignore the untracked `public/` build artifacts entirely — lint only `src`).

- [ ] **Step 2: Full API typecheck**

Run: `cd apps/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | tail -10`
Expected: no errors in our files.

- [ ] **Step 3: Run the targeted + full suites**

Run: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bun test src/routes/custom-formats src/routes/quality-profiles src/utils/medias 2>&1 | tail -8`
Then: `cd apps/api && export DATABASE_URL="postgresql://hously:hously@localhost:5433/hously" && bun test 2>&1 | tail -6`
Expected: our suites pass. The 8 pre-existing auth/DB integration failures (`prisma.user` undefined in those tests) are unrelated — note them, don't chase.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore(custom-formats): lint + typecheck fixes for API layer"
```

---

## Self-Review (completed during authoring)

- **Spec coverage (Plan 2 backend portion):** CRUD endpoints ✓ (T2/T3), profile payload `min_seeders`+assignments ✓ (T4), condition validation incl. per-type operators ✓ (T1, closes a Plan-1-review gap), `score_breakdown` + code-based `quality_rejection_reasons` in search ✓ (T5). FE condition builder / breakdown panel / `t()` mapping deferred to **Plan 2b (frontend, frontend-design skill)**.
- **Placeholders:** route-test bodies intentionally describe assertions rather than hard-coding an auth harness that may not exist — the plan instructs mirroring the codebase's existing route-test pattern and reporting if none exists. All non-test code steps contain complete code.
- **Type consistency:** `validateFormatConditions → {ok, conditions|code}`; `mapProfile` returns `min_seeders`+`custom_formats`; `ScoreBreakdownDto`/`ScoreComponentDto` match the engine's `ScoreBreakdown`; assignment shape `{custom_format_id, score, required, forbidden}` consistent across T4 and the DTO.

## Follow-on

- **Plan 2b (frontend):** custom-format manager + condition builder, profile-form fields (score/required/forbidden/min_seeders), interactive-search score-breakdown panel, en+fr `t()` keys for all rejection/component/validation codes. Build with the **frontend-design** skill.
- **Plan 3:** AI authoring + tuner. **Plan 4:** suggest-profile-from-library.
