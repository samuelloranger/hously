# UptimeKuma Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an UptimeKuma plugin that shows monitor health as a compact widget on the Hously homepage, with a "View all monitors" modal, backed by a cached backend endpoint that invalidates whenever an UptimeKuma webhook arrives.

**Architecture:** New admin-configured plugin (`type: "uptimekuma"`, URL + encrypted API key). A backend route fetches UptimeKuma's Prometheus `/metrics`, parses `monitor_status`, caches the result in Redis (60 s TTL). The existing UptimeKuma webhook route already handles `MonitorUp` / `MonitorDown`; we add a single `deleteCache("plugin:uptimekuma:monitors")` call at that boundary so the next frontend poll sees fresh data. Frontend uses TanStack Query (60 s refetch interval, refetch-on-focus) — no SSE.

**Tech Stack:** Elysia + Prisma + ioredis / Bun RedisClient on the API, React 19 + TanStack Query + Tailwind 4 + Radix primitives on the web, shared types via `@hously/shared`.

**Design spec:** `docs/superpowers/specs/2026-04-15-uptimekuma-widget-design.md`

**Key reference patterns:**

- API plugin route model: `apps/api/src/routes/plugins/adguard/index.ts`
- API config normalizer: `apps/api/src/utils/plugins/normalizers.ts` (`normalizeAdguardConfig`)
- API-side plugin config type: `apps/api/src/utils/plugins/types.ts` (`AdguardPluginConfig`)
- API cache helpers: `apps/api/src/services/cache.ts` (`getJsonCache`, `setJsonCache`, `deleteCache`)
- Shared plugin response type: `apps/shared/src/types/plugins.ts` (`AdguardPlugin`, `AdguardPluginUpdateResponse`)
- Frontend plugin query/mutation: `apps/web/src/pages/settings/usePlugins.ts` (`useAdguardPlugin`, `useUpdateAdguardPlugin`)
- Frontend settings section: `apps/web/src/pages/settings/_component/plugins/AdguardPluginSection.tsx`
- Homepage panel pattern: `apps/web/src/pages/_component/WeatherPanel.tsx` + `WeatherForecastModal.tsx`
- Dashboard data hook: `apps/web/src/pages/_component/useWeather.ts`

---

## Task 1: UptimeKuma Prometheus metrics parser

Pure function, no I/O. Fully TDD.

**Files:**

- Create: `apps/api/src/utils/plugins/uptimekuma.ts`
- Create: `apps/api/src/__tests__/uptimekumaMetrics.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/__tests__/uptimekumaMetrics.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  parseMonitorStatus,
  summariseMonitors,
  type UptimekumaMonitor,
} from "../utils/plugins/uptimekuma";

const SAMPLE = `
# HELP monitor_cert_is_valid Is the certificate still valid? (1 = Yes, 0= No)
# TYPE monitor_cert_is_valid gauge
monitor_cert_is_valid{monitor_id="1",monitor_name="HA"} 1

# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)
# TYPE monitor_status gauge
monitor_status{monitor_id="1",monitor_name="HomeAssistant",monitor_type="docker",monitor_url="https://",monitor_hostname="null",monitor_port="null"} 1
monitor_status{monitor_id="2",monitor_name="Jellyfin",monitor_type="http",monitor_url="http://jf:8096",monitor_hostname="null",monitor_port="null"} 0
monitor_status{monitor_id="3",monitor_name="Pending",monitor_type="http",monitor_url="null",monitor_hostname="null",monitor_port="null"} 2
monitor_status{monitor_id="4",monitor_name="Maint",monitor_type="http",monitor_url="",monitor_hostname="null",monitor_port="null"} 3
monitor_status{monitor_id="5",monitor_name="Weird",monitor_type="http",monitor_url="http://ok",monitor_hostname="null",monitor_port="null"} 9
`;

describe("parseMonitorStatus", () => {
  test("ignores comments, non-status metrics and empty lines", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    expect(monitors).toHaveLength(5);
  });

  test("maps status codes to string statuses; unknown codes become pending", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    const byId = Object.fromEntries(monitors.map((m) => [m.id, m.status]));
    expect(byId["1"]).toBe("up");
    expect(byId["2"]).toBe("down");
    expect(byId["3"]).toBe("pending");
    expect(byId["4"]).toBe("maintenance");
    expect(byId["5"]).toBe("pending");
  });

  test("preserves name/type and normalises placeholder URLs to null", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    const byId = Object.fromEntries(monitors.map((m) => [m.id, m]));
    expect(byId["1"]).toEqual<UptimekumaMonitor>({
      id: "1",
      name: "HomeAssistant",
      type: "docker",
      url: null, // "https://" is a placeholder
      status: "up",
    });
    expect(byId["2"].url).toBe("http://jf:8096");
    expect(byId["3"].url).toBeNull(); // "null"
    expect(byId["4"].url).toBeNull(); // ""
  });

  test("returns an empty array for empty input", () => {
    expect(parseMonitorStatus("")).toEqual([]);
    expect(parseMonitorStatus("# HELP foo\n# TYPE foo gauge\n")).toEqual([]);
  });
});

describe("summariseMonitors", () => {
  test("counts each status bucket", () => {
    const monitors = parseMonitorStatus(SAMPLE);
    expect(summariseMonitors(monitors)).toEqual({
      total: 5,
      up: 1,
      down: 1,
      pending: 2,
      maintenance: 1,
    });
  });

  test("empty input yields zeros", () => {
    expect(summariseMonitors([])).toEqual({
      total: 0,
      up: 0,
      down: 0,
      pending: 0,
      maintenance: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd apps/api && bun test src/__tests__/uptimekumaMetrics.test.ts
```

Expected: FAIL — `Cannot find module '../utils/plugins/uptimekuma'`.

- [ ] **Step 3: Implement the parser**

Create `apps/api/src/utils/plugins/uptimekuma.ts`:

```ts
export type UptimekumaMonitorStatus = "up" | "down" | "pending" | "maintenance";

export interface UptimekumaMonitor {
  id: string;
  name: string;
  status: UptimekumaMonitorStatus;
  type: string;
  url: string | null;
}

export interface UptimekumaSummary {
  total: number;
  up: number;
  down: number;
  pending: number;
  maintenance: number;
}

// Matches lines like:
// monitor_status{monitor_id="1",monitor_name="HA",monitor_type="docker",monitor_url="https://",...} 1
const METRIC_LINE = /^monitor_status\{([^}]*)\}\s+([0-9]+(?:\.[0-9]+)?)\s*$/;

// Parses {label="value",label2="value2"} into a Record.
function parseLabels(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    out[match[1]] = match[2].replace(/\\(.)/g, "$1");
  }
  return out;
}

function normaliseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "null" || trimmed === "https://" || trimmed === "http://") {
    return null;
  }
  return trimmed;
}

function mapStatus(code: number): UptimekumaMonitorStatus {
  switch (code) {
    case 0:
      return "down";
    case 1:
      return "up";
    case 3:
      return "maintenance";
    case 2:
    default:
      return "pending";
  }
}

export function parseMonitorStatus(metricsText: string): UptimekumaMonitor[] {
  if (!metricsText) return [];
  const monitors: UptimekumaMonitor[] = [];
  for (const rawLine of metricsText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = METRIC_LINE.exec(line);
    if (!match) continue;
    const labels = parseLabels(match[1]);
    const id = labels.monitor_id;
    const name = labels.monitor_name;
    if (!id || !name) continue;
    const code = Number.parseInt(match[2], 10);
    monitors.push({
      id,
      name,
      type: labels.monitor_type ?? "",
      url: normaliseUrl(labels.monitor_url),
      status: mapStatus(Number.isFinite(code) ? code : -1),
    });
  }
  return monitors;
}

export function summariseMonitors(
  monitors: UptimekumaMonitor[],
): UptimekumaSummary {
  const summary: UptimekumaSummary = {
    total: monitors.length,
    up: 0,
    down: 0,
    pending: 0,
    maintenance: 0,
  };
  for (const m of monitors) {
    summary[m.status] += 1;
  }
  return summary;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd apps/api && bun test src/__tests__/uptimekumaMetrics.test.ts
```

Expected: PASS (8 assertions across 6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/plugins/uptimekuma.ts \
        apps/api/src/__tests__/uptimekumaMetrics.test.ts
git commit -m "feat(api): add UptimeKuma Prometheus metrics parser"
```

---

## Task 2: Backend config type + normalizer

**Files:**

- Modify: `apps/api/src/utils/plugins/types.ts` (append)
- Modify: `apps/api/src/utils/plugins/normalizers.ts` (import + append)

- [ ] **Step 1: Add the API-side config type**

Append to `apps/api/src/utils/plugins/types.ts`:

```ts
export interface UptimekumaPluginConfig {
  website_url: string;
  api_key: string;
}
```

- [ ] **Step 2: Add the normalizer**

In `apps/api/src/utils/plugins/normalizers.ts`, add `UptimekumaPluginConfig` to the top-level type import (alphabetical order inside the import list):

```ts
import type {
  AdguardPluginConfig,
  // ... existing entries ...
  UptimekumaPluginConfig,
  WeatherPluginConfig,
} from "./types";
```

Append to the bottom of `normalizers.ts`:

```ts
export const normalizeUptimekumaConfig = (
  config: unknown,
): UptimekumaPluginConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/utils/plugins/types.ts apps/api/src/utils/plugins/normalizers.ts
git commit -m "feat(api): add UptimekumaPluginConfig type and normalizer"
```

---

## Task 3: Shared plugin/monitor types

**Files:**

- Modify: `apps/shared/src/types/plugins.ts` (append)

- [ ] **Step 1: Append the shared types**

Append to `apps/shared/src/types/plugins.ts`:

```ts
export interface UptimekumaPlugin {
  type: "uptimekuma";
  enabled: boolean;
  website_url: string;
  api_key_set: boolean;
}

export interface UptimekumaPluginUpdateResponse {
  success: true;
  plugin: UptimekumaPlugin;
}

export type UptimekumaMonitorStatus = "up" | "down" | "pending" | "maintenance";

export interface UptimekumaMonitor {
  id: string;
  name: string;
  status: UptimekumaMonitorStatus;
  type: string;
  url: string | null;
}

export interface UptimekumaSummary {
  total: number;
  up: number;
  down: number;
  pending: number;
  maintenance: number;
}

export interface UptimekumaMonitorsResponse {
  summary: UptimekumaSummary;
  monitors: UptimekumaMonitor[];
  fetched_at: string;
}
```

- [ ] **Step 2: Typecheck shared package**

```bash
cd apps/shared && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/shared/src/types/plugins.ts
git commit -m "feat(shared): add UptimeKuma plugin and monitor types"
```

---

## Task 4: Frontend endpoint + queryKey entries

**Files:**

- Modify: `apps/web/src/lib/endpoints/plugins.ts`
- Modify: `apps/web/src/lib/queryKeys.ts`

- [ ] **Step 1: Add endpoint constants**

In `apps/web/src/lib/endpoints/plugins.ts`, add to `PLUGIN_ENDPOINTS`:

```ts
UPTIMEKUMA: "/api/plugins/uptimekuma",
UPTIMEKUMA_MONITORS: "/api/plugins/uptimekuma/monitors",
```

(Insert between `HOME_ASSISTANT_ENTITIES` and the closing `} as const;`.)

- [ ] **Step 2: Add query keys**

In `apps/web/src/lib/queryKeys.ts`, inside the `plugins` block, add:

```ts
uptimekuma: () => [...queryKeys.plugins.all, "uptimekuma"] as const,
uptimekumaMonitors: () =>
  [...queryKeys.plugins.all, "uptimekuma", "monitors"] as const,
```

Keep alphabetical grouping near `tmdb` / `homeAssistant`.

- [ ] **Step 3: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/endpoints/plugins.ts apps/web/src/lib/queryKeys.ts
git commit -m "feat(web): wire UptimeKuma endpoint constants and query keys"
```

---

## Task 5: Backend plugin routes (`uptimekuma/index.ts`)

The route has three endpoints: admin GET/PUT of config, authenticated GET of monitors (with Redis cache).

**Files:**

- Create: `apps/api/src/routes/plugins/uptimekuma/index.ts`
- Modify: `apps/api/src/routes/plugins/index.ts`

- [ ] **Step 1: Create the route module**

Create `apps/api/src/routes/plugins/uptimekuma/index.ts`:

```ts
import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getPluginConfigRecord,
  invalidatePluginConfigCache,
} from "@hously/api/services/pluginConfigCache";
import {
  deleteCache,
  getJsonCache,
  setJsonCache,
} from "@hously/api/services/cache";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeUptimekumaConfig } from "@hously/api/utils/plugins/normalizers";
import {
  parseMonitorStatus,
  summariseMonitors,
} from "@hously/api/utils/plugins/uptimekuma";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin, requireUser } from "@hously/api/middleware/auth";
import { badGateway, badRequest, serverError } from "@hously/api/errors";

const CACHE_KEY = "plugin:uptimekuma:monitors";
const CACHE_TTL_SECONDS = 60;

type MonitorsResponse = {
  summary: ReturnType<typeof summariseMonitors>;
  monitors: ReturnType<typeof parseMonitorStatus>;
  fetched_at: string;
};

const adminRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/uptimekuma", async ({ set }) => {
    try {
      const plugin = await getPluginConfigRecord("uptimekuma");
      const config = normalizeUptimekumaConfig(plugin?.config);
      return {
        plugin: {
          type: "uptimekuma" as const,
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key_set: Boolean(config?.api_key),
        },
      };
    } catch (error) {
      console.error("Error fetching UptimeKuma plugin config:", error);
      return serverError(set, "Failed to fetch UptimeKuma plugin config");
    }
  })
  .put(
    "/uptimekuma",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      try {
        const existingPlugin = await getPluginConfigRecord("uptimekuma");
        const existingConfig = normalizeUptimekumaConfig(
          existingPlugin?.config,
        );
        const providedKey = body.api_key?.trim() || "";
        const apiKey = providedKey || existingConfig?.api_key || "";

        if (!apiKey) {
          return badRequest(set, "api_key is required");
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          api_key: encrypt(apiKey),
        };

        await prisma.plugin.upsert({
          where: { type: "uptimekuma" },
          update: { enabled, config, updatedAt: now },
          create: {
            type: "uptimekuma",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });
        await invalidatePluginConfigCache("uptimekuma");
        await deleteCache(CACHE_KEY);

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "uptimekuma" },
        });

        return {
          success: true as const,
          plugin: {
            type: "uptimekuma" as const,
            enabled,
            website_url: websiteUrl,
            api_key_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving UptimeKuma plugin config:", error);
        return serverError(set, "Failed to save UptimeKuma plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );

const userRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/uptimekuma/monitors", async ({ set }) => {
    try {
      const cached = await getJsonCache<MonitorsResponse>(CACHE_KEY);
      if (cached) return cached;

      const plugin = await getPluginConfigRecord("uptimekuma");
      if (!plugin?.enabled) {
        return badRequest(set, "UptimeKuma plugin is not enabled");
      }
      const config = normalizeUptimekumaConfig(plugin.config);
      if (!config) {
        return badRequest(set, "UptimeKuma plugin is not configured");
      }

      const metricsUrl = new URL("/metrics", config.website_url);
      const authHeader = `Basic ${Buffer.from(`:${config.api_key}`).toString("base64")}`;

      const response = await fetch(metricsUrl.toString(), {
        headers: {
          Accept: "text/plain",
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        return badGateway(
          set,
          `UptimeKuma /metrics request failed with status ${response.status}`,
        );
      }

      const text = await response.text();
      const monitors = parseMonitorStatus(text);
      const summary = summariseMonitors(monitors);
      const payload: MonitorsResponse = {
        summary,
        monitors,
        fetched_at: new Date().toISOString(),
      };
      await setJsonCache(CACHE_KEY, payload, CACHE_TTL_SECONDS);
      return payload;
    } catch (error) {
      console.error("Error fetching UptimeKuma monitors:", error);
      return serverError(set, "Failed to fetch UptimeKuma monitors");
    }
  });

export const uptimekumaPluginRoutes = new Elysia()
  .use(adminRoutes)
  .use(userRoutes);
```

- [ ] **Step 2: Register the routes**

In `apps/api/src/routes/plugins/index.ts`:

```ts
import { uptimekumaPluginRoutes } from "./uptimekuma";
```

And add `.use(uptimekumaPluginRoutes)` to the `pluginsRoutes` chain (place after `adguardPluginRoutes`).

- [ ] **Step 3: Typecheck the API**

```bash
cd apps/api && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke-test locally**

Start services + API (if not already running):

```bash
make dev-services
cd apps/api && bun run dev
```

With the API running, call the admin GET (expect unconfigured-default response):

```bash
curl -sS -b "hously_session=<dev-session-cookie>" http://localhost:3000/api/plugins/uptimekuma | jq
```

Expected:

```json
{
  "plugin": {
    "type": "uptimekuma",
    "enabled": false,
    "website_url": "",
    "api_key_set": false
  }
}
```

Skip this step if you don't have a dev session available — the Task 17 E2E test covers this path with real data.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/plugins/uptimekuma/index.ts apps/api/src/routes/plugins/index.ts
git commit -m "feat(api): add UptimeKuma plugin routes (config + cached monitors)"
```

---

## Task 6: Webhook-triggered cache invalidation

Deletes `plugin:uptimekuma:monitors` whenever a `MonitorUp` / `MonitorDown` webhook arrives, so the next frontend poll sees fresh data.

**Files:**

- Modify: `apps/api/src/routes/webhooks/index.ts` (add invalidation inside the success branch)

- [ ] **Step 1: Add the invalidation side-effect**

In `apps/api/src/routes/webhooks/index.ts`:

1. At the top of the file, with the other imports, add:

```ts
import { deleteCache } from "@hously/api/services/cache";
```

2. Inside the `try { const parsed = handler(payload); ... }` block, immediately after the existing line:

```ts
const eventType = parsed.event_type;
```

insert:

```ts
// Invalidate the UptimeKuma monitors cache so the homepage widget
// reflects MonitorUp/MonitorDown events on the next refetch.
if (
  serviceName.toLowerCase() === "uptimekuma" &&
  (eventType === "MonitorUp" || eventType === "MonitorDown")
) {
  await deleteCache("plugin:uptimekuma:monitors");
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/webhooks/index.ts
git commit -m "feat(api): invalidate UptimeKuma cache on MonitorUp/Down webhooks"
```

---

## Task 7: Frontend config hooks (useUptimekumaPlugin + useUpdateUptimekumaPlugin)

**Files:**

- Modify: `apps/web/src/pages/settings/usePlugins.ts`

- [ ] **Step 1: Extend the type imports**

In `apps/web/src/pages/settings/usePlugins.ts`, add to the `@hously/shared/types` import block (alphabetical):

```ts
UptimekumaPlugin,
UptimekumaPluginUpdateResponse,
```

- [ ] **Step 2: Add the query + mutation hooks**

Append at the bottom of the file (near `useUpdateHomeAssistantPlugin`):

```ts
export function useUptimekumaPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.uptimekuma(),
    queryFn: () =>
      fetcher<{ plugin: UptimekumaPlugin }>(PLUGIN_ENDPOINTS.UPTIMEKUMA),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateUptimekumaPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key?: string;
      enabled: boolean;
    }) =>
      fetcher<UptimekumaPluginUpdateResponse>(PLUGIN_ENDPOINTS.UPTIMEKUMA, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.uptimekuma(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.uptimekumaMonitors(),
      });
    },
  });
}
```

- [ ] **Step 3: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/settings/usePlugins.ts
git commit -m "feat(web): add UptimeKuma plugin config hooks"
```

---

## Task 8: Frontend monitors hook

**Files:**

- Create: `apps/web/src/pages/_component/useUptimekumaMonitors.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { PLUGIN_ENDPOINTS } from "@/lib/endpoints";
import type { UptimekumaMonitorsResponse } from "@hously/shared/types";

export function useUptimekumaMonitors(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.uptimekumaMonitors(),
    queryFn: () =>
      fetcher<UptimekumaMonitorsResponse>(PLUGIN_ENDPOINTS.UPTIMEKUMA_MONITORS),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
```

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/_component/useUptimekumaMonitors.ts
git commit -m "feat(web): add useUptimekumaMonitors query hook"
```

---

## Task 9: Settings plugin section

**Files:**

- Create: `apps/web/src/pages/settings/_component/plugins/UptimekumaPluginSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/plugins/index.ts`
- Modify: `apps/web/src/pages/settings/_component/PluginsTab.tsx`

Mirrors `AdguardPluginSection` exactly — enabled toggle, URL input, single secret field (`api_key`). No username.

- [ ] **Step 1: Create the section**

```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUptimekumaPlugin,
  useUpdateUptimekumaPlugin,
} from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function UptimekumaPluginSection() {
  const { data, isLoading } = useUptimekumaPlugin();
  return (
    <UptimekumaPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function UptimekumaPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useUptimekumaPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateUptimekumaPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      apiKey !== "" ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, apiKey, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin?.website_url || "");
    setApiKey("");
    setEnabled(Boolean(data?.plugin?.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey.trim() ? apiKey : undefined,
        enabled,
      })
      .then(() => {
        setApiKey("");
        toast.success(t("settings.plugins.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  const keyPlaceholder = data?.plugin?.api_key_set
    ? t("settings.plugins.uptimekuma.apiKeyPlaceholderSet")
    : t("settings.plugins.uptimekuma.apiKeyPlaceholder");

  return (
    <PluginSectionCard
      title="UptimeKuma"
      description={t("settings.plugins.uptimekuma.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/uptime-kuma.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.uptimekuma.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://uptime.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.uptimekuma.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPlaceholder}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
```

- [ ] **Step 2: Re-export from plugin section barrel**

In `apps/web/src/pages/settings/_component/plugins/index.ts`, append:

```ts
export { UptimekumaPluginSection } from "@/pages/settings/_component/plugins/UptimekumaPluginSection";
```

- [ ] **Step 3: Wire into PluginsTab**

In `apps/web/src/pages/settings/_component/PluginsTab.tsx`:

1. Add `UptimekumaPluginSection` to the import from `@/pages/settings/_component/plugins` (keep alphabetical).
2. Inside the `{t("settings.plugins.groups.infrastructure")}` group, append `<UptimekumaPluginSection />` after `<AdguardPluginSection />`.

- [ ] **Step 4: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Visit `http://localhost:5173/settings` → Plugins tab → Infrastructure group. Verify the UptimeKuma card appears. Enable it, enter production URL + API key, save. Confirm:

- Toast "Settings saved" fires.
- After refresh the URL is preserved, the API key field is empty (not re-echoed), and `api_key_set` is true (placeholder is the "key already set" variant).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/settings/_component/plugins/UptimekumaPluginSection.tsx \
        apps/web/src/pages/settings/_component/plugins/index.ts \
        apps/web/src/pages/settings/_component/PluginsTab.tsx
git commit -m "feat(web): add UptimeKuma plugin settings section"
```

---

## Task 10: Homepage panel (`UptimeKumaPanel`) — via frontend-design skill

Follow the visual pattern from `apps/web/src/pages/_component/WeatherPanel.tsx` and `SystemPanel.tsx` for card weight / spacing. The panel:

- Hides entirely (returns `null`) when the query errors with a 400 (plugin disabled/unconfigured) — same "hide when not configured" semantic as other plugin panels.
- Shows a loading skeleton while fetching.
- Renders a summary row + conditional unhealthy list + a "View all monitors" button.

**Files:**

- Create: `apps/web/src/pages/_component/UptimeKumaPanel.tsx`

- [ ] **Step 1: Invoke the frontend-design skill**

Before writing the panel, invoke `frontend-design:frontend-design` with the following brief:

> Build a compact dashboard panel `UptimeKumaPanel` in Tailwind (dark-mode aware) to match the existing weight of `WeatherPanel` / `SystemPanel`. Data comes from `useUptimekumaMonitors()` → `UptimekumaMonitorsResponse`. Layout requirements:
>
> 1. Header: `Activity` icon (lucide-react) + title "UptimeKuma", with a right-aligned summary chip showing `{up}/{total} up`. Chip background is green-tinted when all up, amber when any pending (and none down), red when any down.
> 2. If **any** monitors are down or pending, render an inline list beneath the header — one row per offending monitor (capped at 5 visible, with `+N more` affordance when overflow). Each row: status dot (red/amber), monitor name, muted type secondary text.
> 3. Footer: a subtle `View all monitors` button (full width, outline/ghost style) that opens `UptimeKumaMonitorsModal`.
> 4. Loading: compact skeleton matching the panel height.
> 5. When the query errors with HTTP 400 (plugin disabled / unconfigured), return `null` (mirrors how other plugin panels self-hide). On other errors render a small inline error with retry.
>
> Keep the file focused — just the panel + a tiny `StatusDot` sub-component. The modal is a separate file.

Use the skill's output to write `apps/web/src/pages/_component/UptimeKumaPanel.tsx`. The hook import is:

```ts
import { useUptimekumaMonitors } from "@/pages/_component/useUptimekumaMonitors";
import { UptimeKumaMonitorsModal } from "@/pages/_component/UptimeKumaMonitorsModal";
```

The modal is created in the next task — for this task, stub a local `useState` boolean and pass `open` / `onOpenChange` through so the modal can be wired in Task 11 without re-editing the panel.

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: one error about the missing `UptimeKumaMonitorsModal` import — acceptable, fixed in Task 11. If any other errors, fix before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/_component/UptimeKumaPanel.tsx
git commit -m "feat(web): add UptimeKumaPanel dashboard widget"
```

---

## Task 11: Monitors modal (`UptimeKumaMonitorsModal`) — via frontend-design skill

**Files:**

- Create: `apps/web/src/pages/_component/UptimeKumaMonitorsModal.tsx`

- [ ] **Step 1: Invoke the frontend-design skill**

> Build a modal `UptimeKumaMonitorsModal` using the existing Radix-based Dialog primitives under `@/components/ui/dialog`. Use the `WeatherForecastModal` as a reference for dialog structure and styling.
>
> Accepts `{ open: boolean; onOpenChange: (open: boolean) => void }`. Reads from `useUptimekumaMonitors()` — no extra fetch.
>
> Layout:
>
> 1. Title row: "All monitors" + muted subtitle "Updated Xs ago" derived from `fetched_at`.
> 2. Four sections rendered in order — **Down** (red), **Pending** (amber), **Maintenance** (blue), **Up** (green). Each section header shows the count; sections with zero entries are hidden.
> 3. Each row: colored status dot + monitor name (bold) + two lines of muted metadata (type on one line, URL on the next when present).
> 4. Empty state (e.g. if `monitors` is empty) shows a centred "No monitors configured" placeholder.
> 5. Mobile-friendly — section lists become scrollable if content exceeds the viewport.
> 6. All strings i18n-ed via `t("dashboard.uptimekuma.*")` (strings are created in Task 14).

- [ ] **Step 2: Wire panel → modal**

In the `UptimeKumaPanel.tsx` created in Task 10, replace the stub and render:

```tsx
<UptimeKumaMonitorsModal open={isOpen} onOpenChange={setIsOpen} />
```

- [ ] **Step 3: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/_component/UptimeKumaMonitorsModal.tsx \
        apps/web/src/pages/_component/UptimeKumaPanel.tsx
git commit -m "feat(web): add UptimeKumaMonitorsModal + wire panel"
```

---

## Task 12: Wire panel into the homepage

**Files:**

- Modify: `apps/web/src/pages/_component/HomePage.tsx`

- [ ] **Step 1: Import and render**

In `apps/web/src/pages/_component/HomePage.tsx`, add the import alongside the other `_component/*Panel` imports:

```tsx
import { UptimeKumaPanel } from "@/pages/_component/UptimeKumaPanel";
```

Inside the right column (between `<SystemPanel />` and `<DownloadsPanel />`), insert:

```tsx
<motion.div variants={panelVariants}>
  <CardErrorBoundary>
    <UptimeKumaPanel />
  </CardErrorBoundary>
</motion.div>
```

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/_component/HomePage.tsx
git commit -m "feat(web): mount UptimeKumaPanel on the homepage"
```

---

## Task 13: i18n strings (en + fr)

**Files:**

- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Add settings strings**

Under `settings.plugins.*` in both `en/common.json` and `fr/common.json` (next to the existing `adguard` block), add:

English (`en/common.json`):

```json
"uptimekuma": {
  "help": "Connect UptimeKuma to display monitor health on your homepage.",
  "websiteUrl": "UptimeKuma URL",
  "apiKey": "API key",
  "apiKeyPlaceholder": "uk1_...",
  "apiKeyPlaceholderSet": "Leave blank to keep existing key"
}
```

French (`fr/common.json`):

```json
"uptimekuma": {
  "help": "Connectez UptimeKuma pour afficher l'état des moniteurs sur votre page d'accueil.",
  "websiteUrl": "URL UptimeKuma",
  "apiKey": "Clé API",
  "apiKeyPlaceholder": "uk1_...",
  "apiKeyPlaceholderSet": "Laisser vide pour conserver la clé actuelle"
}
```

- [ ] **Step 2: Add dashboard strings**

Under `dashboard.*` in both locales, add:

English:

```json
"uptimekuma": {
  "title": "UptimeKuma",
  "summary": "{{up}} / {{total}} up",
  "allHealthy": "All monitors are up",
  "viewAll": "View all monitors",
  "plusMore": "+{{count}} more",
  "updatedAgo": "Updated {{relative}}",
  "sections": {
    "down": "Down",
    "pending": "Pending",
    "maintenance": "Maintenance",
    "up": "Up"
  },
  "empty": "No monitors configured",
  "errors": {
    "loadFailed": "Failed to load monitors"
  }
}
```

French:

```json
"uptimekuma": {
  "title": "UptimeKuma",
  "summary": "{{up}} / {{total}} actifs",
  "allHealthy": "Tous les moniteurs sont actifs",
  "viewAll": "Voir tous les moniteurs",
  "plusMore": "+{{count}} autres",
  "updatedAgo": "Mis à jour {{relative}}",
  "sections": {
    "down": "Hors service",
    "pending": "En attente",
    "maintenance": "Maintenance",
    "up": "Actifs"
  },
  "empty": "Aucun moniteur configuré",
  "errors": {
    "loadFailed": "Échec du chargement des moniteurs"
  }
}
```

- [ ] **Step 3: Typecheck web** (ensures any TypeScript-validated i18n keys resolve):

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "i18n: add UptimeKuma plugin strings (en, fr)"
```

---

## Task 14: End-to-end verification against production UptimeKuma

This task is manual and runs against the user's production UptimeKuma at
`https://uptime.samlo.cloud` using the API key already configured in
Task 8 (step 5).

- [ ] **Step 1: Full typecheck, lint, test**

```bash
make typecheck
make lint
make test
```

Expected: all pass. Parser tests from Task 1 must show green.

- [ ] **Step 2: Verify the homepage widget**

1. Visit the homepage — confirm panel appears below `SystemPanel`.
2. All-green state: verify header shows `19 / 19 up` (or current total) with a green dot.
3. Click "View all monitors" — modal opens with one "Up" section listing every monitor (name + type + URL).

- [ ] **Step 3: Verify webhook invalidation**

1. In UptimeKuma, temporarily pause a low-risk monitor (e.g. your own dev service). UptimeKuma will fire a `MonitorDown` webhook to `/api/webhooks/uptimekuma`.
2. In the Hously UI, either refocus the window or wait up to 60 s → the panel should re-render with red dot + the down monitor's name visible inline.
3. Modal should now show a "Down" section.
4. Unpause → `MonitorUp` fires → panel returns to all-green within the next refetch cycle.

- [ ] **Step 4: Verify caching behaviour**

```bash
docker compose exec redis redis-cli GET plugin:uptimekuma:monitors | head -c 400
```

Expected: a JSON blob containing `summary` and `monitors`. After firing a webhook it should be deleted (key disappears).

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/uptimekuma-plugin
gh pr create --title "feat: UptimeKuma plugin + homepage widget" --body "$(cat <<'EOF'
## Summary
- New admin-configured UptimeKuma plugin (URL + encrypted API key)
- Cached backend endpoint `/api/plugins/uptimekuma/monitors` parsing Prometheus `monitor_status`
- Homepage widget showing `X / Y up` with red/amber highlighting for down/pending monitors
- "View all monitors" modal grouping by status
- UptimeKuma webhook (MonitorUp/MonitorDown) invalidates the Redis cache so the widget refreshes on the next poll

Spec: `docs/superpowers/specs/2026-04-15-uptimekuma-widget-design.md`

## Test plan
- [x] Parser unit tests (`apps/api/src/__tests__/uptimekumaMetrics.test.ts`)
- [x] Manual: widget renders 19/19 up against production UptimeKuma
- [x] Manual: pause → MonitorDown webhook → widget shows monitor in red within one refetch
- [x] Manual: Redis key deleted on webhook arrival
EOF
)"
```

---

## Self-review

**Spec coverage**

- Data source (Prometheus `/metrics`, Basic auth, status mapping): Task 1, Task 5.
- Config storage (encrypted key, admin routes): Task 2, Task 5.
- Cached monitors endpoint (60 s TTL, JSON shape): Task 5.
- Webhook invalidation: Task 6.
- Shared types: Task 3.
- Frontend endpoints + query keys: Task 4.
- Frontend hooks (config + monitors): Task 7, Task 8.
- Settings section: Task 9.
- Panel (+ view-more modal) via frontend-design skill: Task 10, Task 11.
- Homepage wiring: Task 12.
- i18n: Task 13.
- E2E verification: Task 14.

**Placeholder scan:** no TBDs, all code is concrete, no "add appropriate…". Panel / modal tasks delegate UI to `frontend-design` skill with an exact brief; the wiring (imports, state prop shape) is fully specified.

**Type consistency:** `UptimekumaMonitor` defined identically in `apps/api/src/utils/plugins/uptimekuma.ts` and `apps/shared/src/types/plugins.ts`. API types are internal to `parseMonitorStatus`; shared types are what the response returns. Status literal unions match. Query keys `plugins.uptimekuma()` and `plugins.uptimekumaMonitors()` match between `queryKeys.ts` (Task 4) and all consuming hooks (Tasks 7, 8). Endpoint names `UPTIMEKUMA` / `UPTIMEKUMA_MONITORS` match in endpoint constants (Task 4) and route paths (`/uptimekuma`, `/uptimekuma/monitors`, Task 5). Mutation request body (`website_url`, `api_key`, `enabled`) matches between hook (Task 7) and Elysia `t.Object` validator (Task 5).
