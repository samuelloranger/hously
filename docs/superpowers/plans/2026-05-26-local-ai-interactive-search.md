# Local AI Interactive Search — AI Pick Feature

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Local AI integration (OpenAI-compatible endpoint) that analyzes interactive search results and surfaces a pinned "AI Pick" banner with a one-click grab button.

**Architecture:** The frontend fires a `POST /api/medias/search/ai-pick` request after search results load; the API fetches the local AI config, calls the user's llama server, and returns `{ release_key, reasoning }`. The frontend finds the matching release and renders a banner above the results list with an "AI Grab" button that reuses the existing `onDownload` handler.

**Tech Stack:** Elysia, Prisma, TanStack Query, React, Tailwind CSS, shadcn/ui, `@hously/shared`, `@hously/api`

---

## File Map

| Action | Path                                                                                | Responsibility                                                      |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Create | `apps/api/src/utils/medias/buildAiPickPrompt.ts`                                    | Pure function — builds the LLM prompt from media context + releases |
| Create | `apps/api/src/routes/integrations/local-ai/index.ts`                                | GET / PUT / GET test routes for Local AI config                     |
| Modify | `apps/api/src/utils/integrations/types.ts`                                          | Add `LocalAiConfig` type                                            |
| Modify | `apps/api/src/utils/integrations/normalizers.ts`                                    | Add `normalizeLocalAiConfig`                                        |
| Modify | `apps/api/src/routes/integrations/index.ts`                                         | Wire `localAiIntegrationRoutes`                                     |
| Modify | `apps/api/src/routes/medias/search/index.ts`                                        | Add `POST /ai-pick`                                                 |
| Modify | `apps/shared/src/types/integrations.ts`                                             | Add `LocalAiIntegration`, `LocalAiIntegrationUpdateResponse`        |
| Modify | `apps/web/src/lib/endpoints/integrations.ts`                                        | Add `LOCAL_AI`, `LOCAL_AI_TEST`                                     |
| Modify | `apps/web/src/lib/endpoints/medias.ts`                                              | Add `INTERACTIVE_SEARCH_AI_PICK`                                    |
| Modify | `apps/web/src/lib/queryKeys.ts`                                                     | Add `localAi` integration key, `aiPick` media key                   |
| Create | `apps/web/src/pages/settings/useLocalAiIntegration.ts`                              | useQuery for GET config                                             |
| Create | `apps/web/src/pages/settings/useUpdateLocalAiIntegration.ts`                        | useMutation for PUT config                                          |
| Create | `apps/web/src/pages/settings/_component/integrations/LocalAiIntegrationSection.tsx` | Settings card with base_url, model, test button                     |
| Modify | `apps/web/src/pages/settings/_component/integrations/index.ts`                      | Add export                                                          |
| Modify | `apps/web/src/pages/settings/_component/IntegrationsTab.tsx`                        | Add card to "other" group                                           |
| Create | `apps/web/src/pages/medias/_component/useAiPick.ts`                                 | useQuery — calls ai-pick endpoint                                   |
| Create | `apps/web/src/pages/medias/_component/AiPickBanner.tsx`                             | Pinned banner with loading/success/error states                     |
| Modify | `apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx`                   | Render banner + pass context to hook                                |

---

## Task 1: Shared types

**Files:**

- Modify: `apps/shared/src/types/integrations.ts`

- [ ] **Step 1: Add LocalAiIntegration and update response type**

Open `apps/shared/src/types/integrations.ts` and append after the last existing integration interface:

```typescript
export interface LocalAiIntegration {
  type: "local-ai";
  enabled: boolean;
  base_url: string;
  model: string;
}

export interface LocalAiIntegrationUpdateResponse {
  success: boolean;
  integration: LocalAiIntegration;
}
```

- [ ] **Step 2: Typecheck**

```bash
make typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/shared/src/types/integrations.ts
git commit -m "feat(shared): add LocalAiIntegration type"
```

---

## Task 2: API config utilities

**Files:**

- Modify: `apps/api/src/utils/integrations/types.ts`
- Modify: `apps/api/src/utils/integrations/normalizers.ts`

- [ ] **Step 1: Add LocalAiConfig to types.ts**

Open `apps/api/src/utils/integrations/types.ts` and add at the end:

```typescript
export interface LocalAiConfig {
  base_url: string;
  model: string;
}
```

- [ ] **Step 2: Add normalizeLocalAiConfig to normalizers.ts**

Open `apps/api/src/utils/integrations/normalizers.ts`. At the top, the file already imports from `"./types"` — add `LocalAiConfig` to that import. Then append at the end:

```typescript
export const normalizeLocalAiConfig = (
  config: unknown,
): LocalAiConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  if (typeof cfg.base_url !== "string" || !cfg.base_url) return null;
  if (typeof cfg.model !== "string" || !cfg.model) return null;
  return { base_url: cfg.base_url.replace(/\/+$/, ""), model: cfg.model };
};
```

- [ ] **Step 3: Write the failing test**

Create `apps/api/src/__tests__/normalizeLocalAiConfig.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { normalizeLocalAiConfig } from "@hously/api/utils/integrations/normalizers";

describe("normalizeLocalAiConfig", () => {
  it("returns null for null input", () => {
    expect(normalizeLocalAiConfig(null)).toBeNull();
  });

  it("returns null when base_url is missing", () => {
    expect(normalizeLocalAiConfig({ model: "llama3.2" })).toBeNull();
  });

  it("returns null when model is missing", () => {
    expect(
      normalizeLocalAiConfig({ base_url: "http://localhost:11434" }),
    ).toBeNull();
  });

  it("returns config with trimmed trailing slash on base_url", () => {
    const result = normalizeLocalAiConfig({
      base_url: "http://homelab:11434/",
      model: "llama3.2",
    });
    expect(result).toEqual({
      base_url: "http://homelab:11434",
      model: "llama3.2",
    });
  });

  it("returns config as-is when valid", () => {
    const result = normalizeLocalAiConfig({
      base_url: "http://homelab:11434",
      model: "mistral",
    });
    expect(result).toEqual({
      base_url: "http://homelab:11434",
      model: "mistral",
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd apps/api && bun test src/__tests__/normalizeLocalAiConfig.test.ts
```

Expected: FAIL — `normalizeLocalAiConfig` not yet exported.

- [ ] **Step 5: Run test again after implementing**

```bash
cd apps/api && bun test src/__tests__/normalizeLocalAiConfig.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/utils/integrations/types.ts \
        apps/api/src/utils/integrations/normalizers.ts \
        apps/api/src/__tests__/normalizeLocalAiConfig.test.ts
git commit -m "feat(api): add LocalAiConfig type and normalizer"
```

---

## Task 3: API — buildAiPickPrompt utility

**Files:**

- Create: `apps/api/src/utils/medias/buildAiPickPrompt.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/buildAiPickPrompt.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { buildAiPickPrompt } from "@hously/api/utils/medias/buildAiPickPrompt";

const releases = [
  {
    key: "guid-1",
    title: "Movie.2024.1080p.BluRay.x265-GROUP",
    size_bytes: 8_000_000_000,
    seeders: 42,
    score: 2500,
  },
  {
    key: "guid-2",
    title: "Movie.2024.720p.WEB-DL.x264-OTHER",
    size_bytes: 3_000_000_000,
    seeders: 12,
    score: 1200,
  },
];

describe("buildAiPickPrompt", () => {
  it("includes media title and year", () => {
    const prompt = buildAiPickPrompt(
      { title: "My Movie", year: 2024, type: "movie" },
      releases,
    );
    expect(prompt).toContain("My Movie");
    expect(prompt).toContain("2024");
  });

  it("includes each release key", () => {
    const prompt = buildAiPickPrompt(
      { title: "My Movie", year: null, type: "movie" },
      releases,
    );
    expect(prompt).toContain("guid-1");
    expect(prompt).toContain("guid-2");
  });

  it("includes size in GB", () => {
    const prompt = buildAiPickPrompt(
      { title: "My Movie", year: null, type: "movie" },
      releases,
    );
    expect(prompt).toContain("8.0 GB");
    expect(prompt).toContain("3.0 GB");
  });

  it("handles null size_bytes gracefully", () => {
    const prompt = buildAiPickPrompt(
      { title: "My Movie", year: null, type: "movie" },
      [{ key: "g", title: "T", size_bytes: null, seeders: null, score: null }],
    );
    expect(prompt).toContain("unknown size");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && bun test src/__tests__/buildAiPickPrompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create buildAiPickPrompt.ts**

Create `apps/api/src/utils/medias/buildAiPickPrompt.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && bun test src/__tests__/buildAiPickPrompt.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/medias/buildAiPickPrompt.ts \
        apps/api/src/__tests__/buildAiPickPrompt.test.ts
git commit -m "feat(api): add buildAiPickPrompt utility"
```

---

## Task 4: API — Local AI integration routes

**Files:**

- Create: `apps/api/src/routes/integrations/local-ai/index.ts`
- Modify: `apps/api/src/routes/integrations/index.ts`

- [ ] **Step 1: Create the Local AI route file**

Create `apps/api/src/routes/integrations/local-ai/index.ts`:

```typescript
import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl } from "@hously/api/utils/integrations/utils";
import { normalizeLocalAiConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import {
  getIntegrationConfigRecord,
  invalidateIntegrationConfigCache,
} from "@hously/api/services/integrationConfigCache";

export const localAiIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/local-ai", async ({ set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "local-ai" },
      });
      const config = normalizeLocalAiConfig(integration?.config);
      return {
        integration: {
          type: "local-ai",
          enabled: integration?.enabled ?? false,
          base_url: config?.base_url ?? "",
          model: config?.model ?? "",
        },
      };
    } catch (error) {
      console.error("Error fetching Local AI config:", error);
      return serverError(set, "Failed to fetch Local AI config");
    }
  })
  .put(
    "/local-ai",
    async ({ user, body, set }) => {
      const baseUrl = body.base_url.trim().replace(/\/+$/, "");
      if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return badRequest(
          set,
          "Invalid base_url. Must be a valid http(s) URL.",
        );
      }
      if (!body.model.trim()) {
        return badRequest(set, "model is required");
      }

      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
          where: { type: "local-ai" },
          update: {
            enabled: body.enabled ?? true,
            config: { base_url: baseUrl, model: body.model.trim() },
            updatedAt: now,
          },
          create: {
            type: "local-ai",
            enabled: body.enabled ?? true,
            config: { base_url: baseUrl, model: body.model.trim() },
            createdAt: now,
            updatedAt: now,
          },
        });

        invalidateIntegrationConfigCache("local-ai");

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "local-ai" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            base_url: baseUrl,
            model: body.model.trim(),
          },
        };
      } catch (error) {
        console.error("Error saving Local AI config:", error);
        return serverError(set, "Failed to save Local AI config");
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        model: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/local-ai/test", async ({ set }) => {
    try {
      const record = await getIntegrationConfigRecord("local-ai");
      const config = normalizeLocalAiConfig(record?.config);
      if (!record?.enabled || !config) {
        set.status = 404;
        return { error: "Local AI integration not configured or disabled" };
      }

      const res = await fetch(`${config.base_url}/v1/models`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      }).catch(() => null);

      if (!res?.ok) {
        set.status = 502;
        return { error: "Could not connect to Local AI server" };
      }

      const data = (await res.json().catch(() => null)) as {
        data?: Array<{ id: string }>;
      } | null;

      const models = data?.data?.map((m) => m.id) ?? [];
      const model_available =
        models.length === 0 || models.includes(config.model);

      return { success: true, models, model_available };
    } catch (error) {
      console.error("Error testing Local AI connection:", error);
      return serverError(set, "Failed to test Local AI connection");
    }
  });
```

- [ ] **Step 2: Wire into integrations/index.ts**

Open `apps/api/src/routes/integrations/index.ts`. Add import and `.use()`:

```typescript
import { localAiIntegrationRoutes } from "./local-ai";
```

Inside the `integrationsRoutes` chain, add:

```typescript
  .use(localAiIntegrationRoutes)
```

(Add it before the closing semicolon, after `.use(minecraftIntegrationRoutes)`.)

- [ ] **Step 3: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/integrations/local-ai/index.ts \
        apps/api/src/routes/integrations/index.ts
git commit -m "feat(api): add Local AI integration routes (GET/PUT/test)"
```

---

## Task 5: API — ai-pick endpoint

**Files:**

- Modify: `apps/api/src/routes/medias/search/index.ts`

- [ ] **Step 1: Add the POST /ai-pick route**

Open `apps/api/src/routes/medias/search/index.ts`. At the top of the file, add these imports alongside the existing ones:

```typescript
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeLocalAiConfig } from "@hously/api/utils/integrations/normalizers";
import {
  buildAiPickPrompt,
  AI_SYSTEM_PROMPT,
} from "@hously/api/utils/medias/buildAiPickPrompt";
```

Then append a new route to the existing Elysia chain in this file (before the final semicolon/export):

```typescript
  .post(
    "/ai-pick",
    async ({ body, set }) => {
      const record = await getIntegrationConfigRecord("local-ai");
      const config = normalizeLocalAiConfig(record?.config);

      if (!record?.enabled || !config) {
        set.status = 404;
        return { error: "Local AI integration not configured or disabled" };
      }

      const candidates = body.releases.filter((r) => !r.rejected);
      if (candidates.length === 0) {
        set.status = 422;
        return { error: "No valid releases to analyze" };
      }

      let responseText: string;
      try {
        const res = await fetch(`${config.base_url}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: AI_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildAiPickPrompt(body.media_context, candidates),
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          set.status = 502;
          return { error: "Could not get response from AI" };
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        responseText = data?.choices?.[0]?.message?.content ?? "";
      } catch {
        set.status = 502;
        return { error: "Could not get response from AI" };
      }

      let parsed: { release_key?: string; reasoning?: string };
      try {
        parsed = JSON.parse(responseText) as {
          release_key?: string;
          reasoning?: string;
        };
      } catch {
        set.status = 502;
        return { error: "Could not get response from AI" };
      }

      if (
        typeof parsed.release_key !== "string" ||
        !candidates.find((r) => r.key === parsed.release_key)
      ) {
        set.status = 502;
        return { error: "Could not get response from AI" };
      }

      return {
        release_key: parsed.release_key,
        reasoning: (parsed.reasoning ?? "").slice(0, 150),
      };
    },
    {
      body: t.Object({
        media_context: t.Object({
          title: t.String(),
          year: t.Nullable(t.Number()),
          type: t.Union([t.Literal("movie"), t.Literal("tv")]),
        }),
        releases: t.Array(
          t.Object({
            key: t.String(),
            title: t.String(),
            size_bytes: t.Nullable(t.Number()),
            seeders: t.Nullable(t.Number()),
            score: t.Nullable(t.Number()),
            rejected: t.Boolean(),
          }),
        ),
      }),
    },
  )
```

- [ ] **Step 2: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/medias/search/index.ts
git commit -m "feat(api): add POST /api/medias/search/ai-pick endpoint"
```

---

## Task 6: Frontend — endpoints + query keys

**Files:**

- Modify: `apps/web/src/lib/endpoints/integrations.ts`
- Modify: `apps/web/src/lib/endpoints/medias.ts`
- Modify: `apps/web/src/lib/queryKeys.ts`

- [ ] **Step 1: Add LOCAL_AI endpoints**

Open `apps/web/src/lib/endpoints/integrations.ts`. Inside `INTEGRATION_ENDPOINTS`, add after the last existing entry:

```typescript
  LOCAL_AI: "/api/integrations/local-ai",
  LOCAL_AI_TEST: "/api/integrations/local-ai/test",
```

- [ ] **Step 2: Add AI_PICK media endpoint**

Open `apps/web/src/lib/endpoints/medias.ts`. Inside `MEDIAS_ENDPOINTS`, add after `INTERACTIVE_SEARCH_DOWNLOAD`:

```typescript
  INTERACTIVE_SEARCH_AI_PICK: "/api/medias/search/ai-pick",
```

- [ ] **Step 3: Add query keys**

Open `apps/web/src/lib/queryKeys.ts`.

In the `integrations` section, add after the last existing key factory:

```typescript
    localAi: () => [...queryKeys.integrations.all, "local-ai"] as const,
```

In the `medias` section (the object that contains `interactiveSearch`), add:

```typescript
    aiPick: (
      title: string,
      year: number | null,
      mediaType: "movie" | "tv",
      releaseKeys: string,
    ) =>
      [
        ...queryKeys.medias.all,
        "ai-pick",
        title,
        year,
        mediaType,
        releaseKeys,
      ] as const,
```

- [ ] **Step 4: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/endpoints/integrations.ts \
        apps/web/src/lib/endpoints/medias.ts \
        apps/web/src/lib/queryKeys.ts
git commit -m "feat(web): add Local AI endpoints and query keys"
```

---

## Task 7: Frontend — settings hooks

**Files:**

- Create: `apps/web/src/pages/settings/useLocalAiIntegration.ts`
- Create: `apps/web/src/pages/settings/useUpdateLocalAiIntegration.ts`

- [ ] **Step 1: Create useLocalAiIntegration.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { LocalAiIntegration } from "@hously/shared/types";

export function useLocalAiIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.localAi(),
    queryFn: () =>
      fetcher<{ integration: LocalAiIntegration }>(
        INTEGRATION_ENDPOINTS.LOCAL_AI,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
```

- [ ] **Step 2: Create useUpdateLocalAiIntegration.ts**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { LocalAiIntegrationUpdateResponse } from "@hously/shared/types";

export function useUpdateLocalAiIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { base_url: string; model: string; enabled: boolean }) =>
      fetcher<LocalAiIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.LOCAL_AI,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.localAi(),
      });
    },
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/settings/useLocalAiIntegration.ts \
        apps/web/src/pages/settings/useUpdateLocalAiIntegration.ts
git commit -m "feat(web): add useLocalAiIntegration and useUpdateLocalAiIntegration hooks"
```

---

## Task 8: Frontend — settings card

**Files:**

- Create: `apps/web/src/pages/settings/_component/integrations/LocalAiIntegrationSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/integrations/index.ts`
- Modify: `apps/web/src/pages/settings/_component/IntegrationsTab.tsx`

- [ ] **Step 1: Create LocalAiIntegrationSection.tsx**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useLocalAiIntegration } from "@/pages/settings/useLocalAiIntegration";
import { useUpdateLocalAiIntegration } from "@/pages/settings/useUpdateLocalAiIntegration";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/api/context";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";

export function LocalAiIntegrationSection() {
  const { data, isLoading } = useLocalAiIntegration();
  return (
    <LocalAiIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function LocalAiIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useLocalAiIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateLocalAiIntegration();
  const fetcher = useFetcher();

  const [baseUrl, setBaseUrl] = useState(data?.integration?.base_url ?? "");
  const [model, setModel] = useState(data?.integration?.model ?? "");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));
  const [testState, setTestState] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");

  const isDirty =
    baseUrl !== (data?.integration?.base_url ?? "") ||
    model !== (data?.integration?.model ?? "") ||
    enabled !== Boolean(data?.integration?.enabled);

  const handleCancel = () => {
    setBaseUrl(data?.integration?.base_url ?? "");
    setModel(data?.integration?.model ?? "");
    setEnabled(Boolean(data?.integration?.enabled));
    setTestState("idle");
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ base_url: baseUrl, model, enabled })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  const handleTest = async () => {
    setTestState("loading");
    try {
      await fetcher(INTEGRATION_ENDPOINTS.LOCAL_AI_TEST);
      setTestState("ok");
    } catch {
      setTestState("error");
    }
  };

  return (
    <IntegrationSectionCard
      title="Local AI"
      description="OpenAI-compatible local LLM server (e.g. llama.cpp, Ollama) for AI-assisted release picking."
      enabled={enabled}
      onEnabledChange={setEnabled}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <div className="space-y-4">
        <IntegrationUrlInput
          label="Base URL"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="http://homelab:11434"
        />
        <div className="space-y-1.5">
          <Label className="text-sm">Model</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3.2"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={!enabled || testState === "loading"}
          >
            {testState === "loading" && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {t("settings.integrations.testConnection")}
          </Button>
          {testState === "ok" && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
          {testState === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <XCircle className="h-3.5 w-3.5" />
              Could not connect
            </span>
          )}
        </div>
      </div>
    </IntegrationSectionCard>
  );
}
```

- [ ] **Step 2: Add export to integrations/index.ts**

Open `apps/web/src/pages/settings/_component/integrations/index.ts` and add at the end:

```typescript
export { LocalAiIntegrationSection } from "@/pages/settings/_component/integrations/LocalAiIntegrationSection";
```

- [ ] **Step 3: Add to IntegrationsTab**

Open `apps/web/src/pages/settings/_component/IntegrationsTab.tsx`.

In the import at the top, add `LocalAiIntegrationSection` to the named imports from `"@/pages/settings/_component/integrations"`.

In the JSX, find the "other" group (the one containing `<WeatherIntegrationSection />`, `<HomeAssistantIntegrationSection />`, `<MinecraftIntegrationSection />`). Add after `<MinecraftIntegrationSection />`:

```tsx
<LocalAiIntegrationSection />
```

- [ ] **Step 4: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/settings/_component/integrations/LocalAiIntegrationSection.tsx \
        apps/web/src/pages/settings/_component/integrations/index.ts \
        apps/web/src/pages/settings/_component/IntegrationsTab.tsx
git commit -m "feat(web): add Local AI integration settings card"
```

---

## Task 9: Frontend — useAiPick hook

**Files:**

- Create: `apps/web/src/pages/medias/_component/useAiPick.ts`

- [ ] **Step 1: Create useAiPick.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { MEDIAS_ENDPOINTS } from "@/lib/endpoints";
import type { InteractiveReleaseItem } from "@hously/shared/types";

export interface AiPickResult {
  release_key: string;
  reasoning: string;
}

interface UseAiPickParams {
  enabled: boolean;
  releases: InteractiveReleaseItem[];
  mediaTitle: string;
  mediaYear: number | null;
  mediaType: "movie" | "tv";
}

export function useAiPick({
  enabled,
  releases,
  mediaTitle,
  mediaYear,
  mediaType,
}: UseAiPickParams) {
  const fetcher = useFetcher();

  // Only send non-rejected releases to the AI
  const candidates = releases.filter((r) => !r.rejected);
  const releaseKeys = candidates.map((r) => r.guid).join(",");

  return useQuery({
    queryKey: queryKeys.medias.aiPick(
      mediaTitle,
      mediaYear,
      mediaType,
      releaseKeys,
    ),
    queryFn: () =>
      fetcher<AiPickResult>(MEDIAS_ENDPOINTS.INTERACTIVE_SEARCH_AI_PICK, {
        method: "POST",
        body: {
          media_context: {
            title: mediaTitle,
            year: mediaYear,
            type: mediaType,
          },
          releases: candidates.map((r) => ({
            key: r.guid,
            title: r.title,
            size_bytes: r.size_bytes ?? null,
            seeders: r.seeders ?? null,
            score: r.quality_score ?? null,
            rejected: r.rejected,
          })),
        },
      }),
    enabled: enabled && candidates.length > 0,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/medias/_component/useAiPick.ts
git commit -m "feat(web): add useAiPick hook"
```

---

## Task 10: Frontend — AiPickBanner component + panel wiring

**Files:**

- Create: `apps/web/src/pages/medias/_component/AiPickBanner.tsx`
- Modify: `apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx`

- [ ] **Step 1: Create AiPickBanner.tsx**

```tsx
import { Sparkles, AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { InteractiveReleaseItem } from "@hously/shared/types";

interface AiPickBannerProps {
  isLoading: boolean;
  isError: boolean;
  release: InteractiveReleaseItem | null;
  reasoning: string | null;
  grabBusy: boolean;
  onGrab: (release: InteractiveReleaseItem) => void;
  onRetry: () => void;
  onDismiss: () => void;
}

export function AiPickBanner({
  isLoading,
  isError,
  release,
  reasoning,
  grabBusy,
  onGrab,
  onRetry,
  onDismiss,
}: AiPickBannerProps) {
  if (!isLoading && !isError && !release) return null;

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border px-4 py-3 text-sm",
        isError
          ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
          : "border-violet-500/30 bg-violet-500/5",
      )}
    >
      {isLoading && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-violet-500" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Could not get response from AI</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onRetry}
          >
            <RefreshCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && release && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <div className="min-w-0">
              <span className="font-medium text-violet-700 dark:text-violet-300">
                AI Pick:{" "}
              </span>
              <span className="break-all text-xs text-neutral-700 dark:text-neutral-300">
                {release.title}
              </span>
              {reasoning && (
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {reasoning}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="h-7 gap-1 bg-violet-600 hover:bg-violet-700 text-white text-xs"
              disabled={grabBusy}
              onClick={() => onGrab(release)}
            >
              <Sparkles className="h-3 w-3" />
              AI Grab
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-neutral-400"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into InteractiveSearchPanel**

Open `apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx`.

Add imports after the existing import block:

```typescript
import { useState } from "react";
import { useLocalAiIntegration } from "@/pages/settings/useLocalAiIntegration";
import { useAiPick } from "@/pages/medias/_component/useAiPick";
import { AiPickBanner } from "@/pages/medias/_component/AiPickBanner";
```

Inside `InteractiveSearchPanel`, after `const state = useInteractiveSearchState(props);` add:

```typescript
const { data: aiConfig } = useLocalAiIntegration();
const aiEnabled = Boolean(aiConfig?.integration?.enabled);

const mediaType =
  props.media?.media_type === "series"
    ? "tv"
    : (props.media?.media_type ?? "movie");

const aiPick = useAiPick({
  enabled:
    aiEnabled && state.releases.length > 0 && !state.activeQuery.isLoading,
  releases: state.releases,
  mediaTitle: props.media?.title ?? props.defaultSearchQuery ?? "",
  mediaYear: props.media?.year ?? null,
  mediaType: mediaType as "movie" | "tv",
});

const pickedRelease =
  aiPick.data?.release_key != null
    ? (state.releases.find((r) => r.guid === aiPick.data?.release_key) ?? null)
    : null;

const [aiDismissed, setAiDismissed] = useState(false);
```

Then in the JSX, between `<InteractiveSearchStatusStrip ... />` and `<InteractiveSearchResultsList ... />`, add:

```tsx
{
  !aiDismissed && aiEnabled && (
    <AiPickBanner
      isLoading={aiPick.isLoading}
      isError={aiPick.isError}
      release={pickedRelease}
      reasoning={aiPick.data?.reasoning ?? null}
      grabBusy={state.grabBusy}
      onGrab={state.downloadRelease}
      onRetry={() => void aiPick.refetch()}
      onDismiss={() => setAiDismissed(true)}
    />
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/medias/_component/AiPickBanner.tsx \
        apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx
git commit -m "feat(web): add AiPickBanner and wire AI pick into InteractiveSearchPanel"
```
