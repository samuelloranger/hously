# Custom Formats — Frontend (Plan 2b, web UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **All UI work uses the `frontend-design` skill** for component craft, matching Hously's existing settings design system (neutral palette, `rounded-xl` bordered cards, dark-mode, lucide icons, `AiPickBanner` accent for score surfaces) — do NOT invent a new aesthetic.

**Goal:** Ship the custom-formats UI: a custom-format manager with a condition builder, quality-profile form fields for `min_seeders` + format assignments, and a translated per-release score-breakdown panel in interactive search — all en/fr.

**Architecture:** Consume Plan 2a's API (`/api/custom-formats`, extended `/api/quality-profiles`, `score_breakdown` in search). New endpoint constants + TanStack hooks + queryKeys. New components under `pages/settings/_component/` and `pages/medias/_component/`. All deterministic backend codes (condition types, operators, rejection reasons, score components, validation errors) map to `t()` keys present in BOTH locale files.

**Tech Stack:** React 19 + TanStack Query/Router, Tailwind, react-i18next, Vitest. Frontend only — depends on Plan 2a (stacked branch `feat/custom-formats-api`).

**Branch:** `feat/custom-formats-web` (stacked on `feat/custom-formats-api`).

---

## File Structure

- **Create** `apps/web/src/lib/endpoints/customFormats.ts` — `CUSTOM_FORMATS_ENDPOINTS`.
- **Modify** `apps/web/src/lib/queryKeys.ts` — add `customFormats` keys.
- **Create** `apps/web/src/pages/settings/useCustomFormats.ts` — list/create/update/delete hooks + `CustomFormatFormPayload`.
- **Modify** `apps/shared/src/types/` (qualityProfiles + a customFormats type file) — `CustomFormat`, `CustomFormatCondition`, `QualityProfileCustomFormatAssignment`, extend `QualityProfile` + responses.
- **Create** `apps/web/src/pages/settings/_component/ConditionBuilder.tsx` — the condition-row editor.
- **Create** `apps/web/src/pages/settings/_component/CustomFormatForm.tsx` + `CustomFormatEditorModal.tsx` + `CustomFormatsTab.tsx` — manager.
- **Modify** `apps/web/src/pages/settings/_component/QualityProfileForm.tsx` — add `min_seeders` field + `CustomFormatAssignmentEditor`.
- **Create** `apps/web/src/pages/settings/_component/CustomFormatAssignmentEditor.tsx`.
- **Modify** `apps/web/src/pages/settings/useQualityProfiles.ts` — extend `QualityProfileFormPayload`.
- **Create** `apps/web/src/pages/medias/_component/ScoreBreakdownPanel.tsx` — per-release breakdown.
- **Modify** `apps/web/src/pages/medias/_component/InteractiveSearchResultsList.tsx` — render the panel + use `quality_rejection_reasons` codes.
- **Create** `apps/web/src/lib/i18n/scoringCodes.ts` — central code→`t()`-key maps (rejection, component, condition-type, operator, validation).
- **Modify** `apps/web/src/locales/en/common.json` + `apps/web/src/locales/fr/common.json` — all new keys (added together).
- **Tests:** `ConditionBuilder.test.tsx`, `scoringCodes.test.ts` (Vitest).

---

## Task 1: Endpoints, shared types, queryKeys

**Files:** create `lib/endpoints/customFormats.ts`; modify `lib/queryKeys.ts`; add shared types.

- [ ] **Step 1: Endpoint constants** — `apps/web/src/lib/endpoints/customFormats.ts`:

```typescript
export const CUSTOM_FORMATS_ENDPOINTS = {
  LIST: "/api/custom-formats",
  CREATE: "/api/custom-formats",
  GET: (id: number) => `/api/custom-formats/${id}`,
  UPDATE: (id: number) => `/api/custom-formats/${id}`,
  DELETE: (id: number) => `/api/custom-formats/${id}`,
} as const;
```

- [ ] **Step 2: queryKeys** — in `apps/web/src/lib/queryKeys.ts`, add alongside `qualityProfiles`:

```typescript
  customFormats: {
    all: ["custom-formats"] as const,
    list: () => ["custom-formats", "list"] as const,
  },
```

- [ ] **Step 3: Shared types** — add to `apps/shared/src/types/` (mirror the condition union from the API's `customFormatTypes.ts`, but as the FE-facing DTO). Create `apps/shared/src/types/customFormats.ts` and export from the package index:

```typescript
export type ConditionType =
  | "title_regex" | "release_group" | "source" | "resolution" | "codec"
  | "language" | "hdr_flag" | "proper_repack" | "size_range" | "indexer"
  | "freeleech" | "seeders";
export type ConditionOperator =
  | "matches" | "equals" | "gte" | "lte" | "lt" | "gt" | "between" | "is_true";
export interface CustomFormatCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value?: string | number | [number, number];
  negate?: boolean;
}
export interface CustomFormat {
  id: number;
  name: string;
  conditions: CustomFormatCondition[];
  created_at: string;
  updated_at: string;
}
export interface CustomFormatsListResponse { custom_formats: CustomFormat[]; }
export interface QualityProfileCustomFormatAssignment {
  custom_format_id: number;
  name?: string;        // present in responses, omit in payloads
  score: number;
  required: boolean;
  forbidden: boolean;
}
```
Extend `QualityProfile` (in `qualityProfiles.ts` shared type) with `min_seeders: number;` and `custom_formats: QualityProfileCustomFormatAssignment[];`.

- [ ] **Step 4: Typecheck** — `cd apps/web && bunx tsc --noEmit 2>&1 | tail -5` → clean. **Commit:** `feat(web): custom-format endpoints, types, queryKeys`.

---

## Task 2: i18n code maps + locale keys (en + fr)

**Files:** create `lib/i18n/scoringCodes.ts` + test; modify both `common.json`.

- [ ] **Step 1: Central code maps** — `apps/web/src/lib/i18n/scoringCodes.ts` maps each backend code to a translation key:

```typescript
export const REJECTION_CODE_KEYS: Record<string, string> = {
  resolution_below_min: "scoring.reject.resolutionBelowMin",
  resolution_above_cutoff: "scoring.reject.resolutionAboveCutoff",
  hdr_required_absent: "scoring.reject.hdrRequiredAbsent",
  language_no_match: "scoring.reject.languageNoMatch",
  size_over_cap: "scoring.reject.sizeOverCap",
  is_sample: "scoring.reject.isSample",
  seeders_below_min: "scoring.reject.seedersBelowMin",
  custom_format_required_absent: "scoring.reject.customFormatRequiredAbsent",
  custom_format_forbidden_present: "scoring.reject.customFormatForbiddenPresent",
};
export const COMPONENT_CODE_KEYS: Record<string, string> = {
  resolution_tier: "scoring.component.resolutionTier",
  preferred_source: "scoring.component.preferredSource",
  preferred_codec: "scoring.component.preferredCodec",
  language_match: "scoring.component.languageMatch",
  prefer_hdr: "scoring.component.preferHdr",
  proper_repack: "scoring.component.properRepack",
  freeleech: "scoring.component.freeleech",
  tracker_priority: "scoring.component.trackerPriority",
  size_penalty: "scoring.component.sizePenalty",
  custom_format: "scoring.component.customFormat",
};
export const CONDITION_TYPE_KEYS: Record<string, string> = {
  title_regex: "customFormats.condition.titleRegex",
  release_group: "customFormats.condition.releaseGroup",
  source: "customFormats.condition.source",
  resolution: "customFormats.condition.resolution",
  codec: "customFormats.condition.codec",
  language: "customFormats.condition.language",
  hdr_flag: "customFormats.condition.hdrFlag",
  proper_repack: "customFormats.condition.properRepack",
  size_range: "customFormats.condition.sizeRange",
  indexer: "customFormats.condition.indexer",
  freeleech: "customFormats.condition.freeleech",
  seeders: "customFormats.condition.seeders",
};
export const OPERATOR_KEYS: Record<string, string> = {
  matches: "customFormats.operator.matches",
  equals: "customFormats.operator.equals",
  gte: "customFormats.operator.gte",
  lte: "customFormats.operator.lte",
  lt: "customFormats.operator.lt",
  gt: "customFormats.operator.gt",
  between: "customFormats.operator.between",
  is_true: "customFormats.operator.isTrue",
};
export const VALIDATION_CODE_KEYS: Record<string, string> = {
  conditions_not_array: "customFormats.error.conditionsNotArray",
  conditions_empty: "customFormats.error.conditionsEmpty",
  condition_not_object: "customFormats.error.conditionNotObject",
  condition_type_invalid: "customFormats.error.conditionTypeInvalid",
  operator_invalid_for_type: "customFormats.error.operatorInvalidForType",
  negate_invalid: "customFormats.error.negateInvalid",
  value_invalid_for_operator: "customFormats.error.valueInvalidForOperator",
  regex_invalid: "customFormats.error.regexInvalid",
  unknown_custom_format_id: "customFormats.error.unknownCustomFormatId",
};
/** Fallback to the raw code if no mapping (defensive). */
export function codeKey(map: Record<string, string>, code: string): string {
  return map[code] ?? code;
}
```

- [ ] **Step 2: Add the keys to BOTH locale files.** Add a `scoring` block and extend `customFormats`/`settings.qualityProfiles` in `apps/web/src/locales/en/common.json` AND `apps/web/src/locales/fr/common.json`. Every key referenced above plus UI labels (manager title/description, "Add condition", "ALL of:", negate, score/required/forbidden, min_seeders + "0 = off" helper, breakdown panel title). EN values are plain English; FR values are proper French (e.g. `resolutionBelowMin`: "Résolution sous le minimum", `seedersBelowMin`: "Pas assez de sources (seeders)"). **The en and fr key sets must be identical** — no key in one missing from the other.

- [ ] **Step 3: Test the maps are complete** — `scoringCodes.test.ts`: assert every value in each map resolves to a non-missing key in the en locale JSON (import the en common.json and walk the dotted path). This guards against drift.

Run: `cd apps/web && bun run test scoringCodes 2>&1 | tail -5` → PASS. **Commit:** `feat(web): scoring/condition code→i18n maps with en+fr keys`.

---

## Task 3: ConditionBuilder component (frontend-design)

**Files:** create `ConditionBuilder.tsx` + `ConditionBuilder.test.tsx`.

Build with the **frontend-design** skill. Contract:
```typescript
interface ConditionBuilderProps {
  conditions: CustomFormatCondition[];
  onChange: (next: CustomFormatCondition[]) => void;
}
```

- [ ] **Step 1: Implement.** UX per design:
  - A labeled group ("ALL of:" header via `t`). Each condition = one row.
  - **Type select** (12 options, labels via `CONDITION_TYPE_KEYS`).
  - **Operator select** filtered to valid operators for the selected type (regex types → `matches`; source/codec/indexer/language → `equals`; resolution/seeders/size_range → numeric ops incl. `between`; hdr_flag/proper_repack/freeleech → `is_true` only). Mirror the API's `allowedOperators` rules exactly.
  - **Value input morphs by type/operator:** regex/equals-string → text input with an inline validity dot (try `new RegExp(value)` for regex types; invalid → red dot + `regex_invalid` hint); numeric single op → number input; `between` → two number inputs (min/max); `is_true` → no value input.
  - **Negate** toggle (subtle), **remove** (×) button. **"Add condition"** ghost button appends a sensible default (`{type:"title_regex",operator:"matches",value:""}`).
  - When the type changes, reset operator to the first valid one and clear the value to a type-appropriate default.
  - Match existing form-control styling from `QualityProfileForm.tsx` (selects, inputs, the custom checkbox/`FieldLabel` patterns) and dark mode.

- [ ] **Step 2: Tests** (Vitest + Testing Library): changing type narrows operators; selecting `size_range` + `between` renders two number inputs; invalid regex shows the invalid state; add/remove mutate via `onChange`; `is_true` type renders no value input. Run `cd apps/web && bun run test ConditionBuilder 2>&1 | tail -6` → PASS. **Commit:** `feat(web): ConditionBuilder with per-type operators + value inputs`.

---

## Task 4: Custom-format manager (form + modal + tab)

**Files:** create `CustomFormatForm.tsx`, `CustomFormatEditorModal.tsx`, `CustomFormatsTab.tsx`, `useCustomFormats.ts`; wire the tab into settings.

- [ ] **Step 1: Hooks** — `useCustomFormats.ts`: `useCustomFormatsList()` (query `CUSTOM_FORMATS_ENDPOINTS.LIST` → `CustomFormatsListResponse`), `useCreateCustomFormat()`, `useUpdateCustomFormat()`, `useDeleteCustomFormat()` (mutations invalidating `queryKeys.customFormats.all`). `CustomFormatFormPayload = { name: string; conditions: CustomFormatCondition[] }`. Mirror `useQualityProfiles.ts` patterns (useFetcher, toast on error in the consuming component).

- [ ] **Step 2: CustomFormatForm** — name input + `<ConditionBuilder>`. On submit, surface API validation errors by mapping `error` (a code) through `VALIDATION_CODE_KEYS` → `t()` (the web `httpClient` throws `HttpError` with the code in `.message`/field — mirror how other forms read API error codes). Disable submit while pending.

- [ ] **Step 3: CustomFormatEditorModal + CustomFormatsTab** — mirror `QualityProfileEditorModal.tsx` + `QualityProfilesTab.tsx` exactly (card list, create/edit/delete, empty state, loading). Each card shows the name + a compact human summary of conditions (e.g. "title matches /atmos/ · seeders ≥ 5"). Add the tab to the settings navigation next to Quality Profiles (find where `QualityProfilesTab` is registered and add `CustomFormatsTab` alongside).

- [ ] **Step 4: Typecheck + lint + manual smoke** — `cd apps/web && bunx tsc --noEmit && bun run lint 2>&1 | tail -8`. **Commit:** `feat(web): custom-format manager (form, modal, tab)`.

---

## Task 5: Quality-profile form — min_seeders + assignments

**Files:** modify `QualityProfileForm.tsx`, `useQualityProfiles.ts`; create `CustomFormatAssignmentEditor.tsx`.

- [ ] **Step 1: Extend payload** — in `useQualityProfiles.ts`, add to `QualityProfileFormPayload`:
```typescript
  min_seeders: number;
  custom_formats: { custom_format_id: number; score: number; required: boolean; forbidden: boolean }[];
```
Update `emptyPayload` (`min_seeders: 0`, `custom_formats: []`) and `profileToForm` to map from the profile response.

- [ ] **Step 2: min_seeders field** — add a number input in `QualityProfileForm.tsx` (near `max_size_gb`), labeled via `t`, with a "0 = off / never grab dead torrents" helper. `set("min_seeders", Number(...) || 0)`.

- [ ] **Step 3: CustomFormatAssignmentEditor** — props `{ value: assignment[]; onChange }`. Lists `useCustomFormatsList()` formats; lets the user add an assignment (select an unassigned format), then per row: a score stepper (number, may be negative), and a `required`/`forbidden`/neither segmented control (mutually exclusive — selecting required clears forbidden). Remove button. Render it in `QualityProfileForm` below the existing fields. Empty/no-formats state links to the Custom Formats tab.

- [ ] **Step 4: Tests + typecheck** — a small test for the required/forbidden mutual-exclusivity and score editing. `cd apps/web && bun run test QualityProfile 2>&1 | tail -5` and `bunx tsc --noEmit`. **Commit:** `feat(web): quality-profile min_seeders + custom-format assignments`.

---

## Task 6: Score-breakdown panel in interactive search

**Files:** create `ScoreBreakdownPanel.tsx`; modify `InteractiveSearchResultsList.tsx`.

- [ ] **Step 1: ScoreBreakdownPanel** — props `{ breakdown: ScoreBreakdownDto }`. If `rejected`: render the rejection reasons (each code → `REJECTION_CODE_KEYS` → `t()`, interpolating `params` where the key uses them, e.g. `seedersBelowMin` with `{min, got}`). Else: render `total` prominently + each component as a row "label  +N" (component code → `COMPONENT_CODE_KEYS` → `t()`; `custom_format` rows show the format `name` from `params.name`), and `matched_formats` as chips. Style after `AiPickBanner.tsx` (read it for the accent/card treatment), dark-mode aware.

- [ ] **Step 2: Wire into results** — in `InteractiveSearchResultsList.tsx`, for each release with `score_breakdown`, add an expandable disclosure (collapsed by default) under the row showing `<ScoreBreakdownPanel>`. Replace any display of the raw `rejection_reason` string with the translated `quality_rejection_reasons` codes (keep `rejection_reason` as a fallback only if `quality_rejection_reasons` is absent). Preserve all existing row behavior (grab button, badges, etc.).

- [ ] **Step 3: Typecheck + lint + test** — `cd apps/web && bunx tsc --noEmit && bun run lint 2>&1 | tail -8`. A render test that a rejected breakdown shows translated reasons and a scored one shows component rows. **Commit:** `feat(web): per-release score-breakdown panel in interactive search`.

---

## Task 7: Verification

- [ ] **Step 1:** `cd apps/web && bunx tsc --noEmit 2>&1 | tail -5` → clean.
- [ ] **Step 2:** `cd apps/web && bun run lint 2>&1 | tail -8` → clean.
- [ ] **Step 3:** `cd apps/web && bun run test 2>&1 | tail -8` → all web tests pass.
- [ ] **Step 4:** i18n parity check — confirm en and fr `common.json` have identical key sets for every new key (the Task 2 test covers en; spot-check fr has the same paths). Commit any fixes.

---

## Self-Review (run after authoring during execution)

- **Spec coverage (Plan 2 frontend portion):** condition builder ✓ (T3), custom-format manager ✓ (T4), profile min_seeders + assignments ✓ (T5), translated score-breakdown panel + rejection codes ✓ (T6), en+fr for every code ✓ (T2). Matches the arc design doc's "FE condition builder + score-breakdown panel + t() mapping (en + fr)".
- **Code→key consistency:** the five code maps in `scoringCodes.ts` cover exactly the backend's emitted codes (rejection: 9, component: 10, condition type: 12, operator: 8, validation: 9) — cross-check against `customFormatTypes.ts` / `customFormatValidation.ts` / `releaseScorer.ts`.
- **i18n discipline:** no English prose rendered directly from API responses; every code goes through a `t()` map.

## Follow-on

- **Plan 3:** AI authoring (intent → drafted conditions + regex preview) + tuner — adds an "AI suggest" affordance to the ConditionBuilder/manager built here.
- **Plan 4:** Suggest-profile-from-library — adds a "Suggest from library" action to the QualityProfiles tab.
- Drop the legacy `rejection_reason` string from the search response once the FE fully uses codes (coordinate with a future backend cleanup).
