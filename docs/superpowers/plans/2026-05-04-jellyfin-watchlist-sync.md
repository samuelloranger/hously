# Jellyfin Watchlist Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-way sync between the Hously watchlist and a Jellyfin "What's Next" collection — items added/removed in Hously push to Jellyfin in real-time; items marked played in Jellyfin are removed from the Hously watchlist.

**Architecture:** A new Hously API route group (`/api/sync/jellyfin`) serves watchlist data to the plugin via sync-token auth. The Jellyfin plugin (C# .NET 9, `apps/jellyfin-plugin/`) runs a background service that maintains per-user "What's Next" collections, handles a webhook from Hously for event-driven updates, and fires DELETE requests to Hously when a user marks something played. Watchlist mutations in Hously fire non-blocking HTTP pushes to the Jellyfin plugin webhook.

**Tech Stack:** Elysia (Bun) for API routes, React + TanStack Query for settings UI, .NET 9 / C# for the Jellyfin plugin, GitHub Actions for CI/CD.

---

## File Map

**New files:**

- `apps/api/src/routes/sync/jellyfin.ts` — sync endpoints (GET watchlist, DELETE item, POST trigger)
- `apps/api/src/routes/sync/jellyfin.test.ts` — unit tests for sync routes
- `apps/api/src/services/jellyfinSyncNotifier.ts` — non-blocking push to plugin after watchlist mutations
- `apps/api/src/services/jellyfinSyncNotifier.test.ts` — unit tests for notifier
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist.sln`
- `apps/jellyfin-plugin/Directory.Build.props`
- `apps/jellyfin-plugin/build.yaml`
- `apps/jellyfin-plugin/manifest.json`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Jellyfin.Plugin.HouslyWatchlist.csproj`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Plugin.cs`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginServiceRegistrator.cs`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginConfiguration.cs`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Configuration/configPage.html`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/HouslyApiClient.cs`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/WatchlistSyncService.cs`
- `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/HouslyWebhookMiddleware.cs`
- `.github/workflows/jellyfin-plugin.yml`

**Modified files:**

- `apps/api/src/utils/integrations/types.ts` — extend `JellyfinIntegrationConfig`, add `JellyfinSyncConfig`, `JellyfinUserMapping`
- `apps/api/src/utils/integrations/normalizers.ts` — add `normalizeJellyfinSyncConfig`
- `apps/api/src/routes/integrations/jellyfin/index.ts` — extend PUT body (user_mappings), add POST /sync-token
- `apps/api/src/routes/medias/watchlist/index.ts` — fire notifier after POST and DELETE
- `apps/api/src/index.ts` — register `jellyfinSyncRoutes`
- `apps/web/src/pages/settings/_component/integrations/JellyfinIntegrationSection.tsx` — add Watchlist Sync subsection

---

## Task 1: Extend Jellyfin config types and normalizer

**Files:**

- Modify: `apps/api/src/utils/integrations/types.ts`
- Modify: `apps/api/src/utils/integrations/normalizers.ts`
- Create: `apps/api/src/utils/integrations/normalizers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/utils/integrations/normalizers.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { normalizeJellyfinSyncConfig } from "./normalizers";

describe("normalizeJellyfinSyncConfig", () => {
  it("returns null when config is null", () => {
    expect(normalizeJellyfinSyncConfig(null)).toBeNull();
  });

  it("returns null when sync_token is missing", () => {
    expect(
      normalizeJellyfinSyncConfig({ website_url: "http://jf.local" }),
    ).toBeNull();
  });

  it("returns config with decrypted sync_token and parsed user_mappings", () => {
    const result = normalizeJellyfinSyncConfig({
      website_url: "http://jf.local/",
      sync_token: "abc123",
      user_mappings: [
        { jellyfin_user_id: "jf-user-1", hously_user_id: 42 },
        { jellyfin_user_id: "", hously_user_id: 0 }, // filtered out
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.sync_token).toBe("abc123");
    expect(result!.website_url).toBe("http://jf.local"); // trailing slash stripped
    expect(result!.user_mappings).toHaveLength(1);
    expect(result!.user_mappings[0]).toEqual({
      jellyfin_user_id: "jf-user-1",
      hously_user_id: 42,
    });
  });

  it("works without user_mappings", () => {
    const result = normalizeJellyfinSyncConfig({
      sync_token: "abc123",
      website_url: "http://jf.local",
    });
    expect(result).not.toBeNull();
    expect(result!.user_mappings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && bun test src/utils/integrations/normalizers.test.ts
```

Expected: FAIL — `normalizeJellyfinSyncConfig is not a function`

- [ ] **Step 3: Extend types**

In `apps/api/src/utils/integrations/types.ts`, add after the `JellyfinIntegrationConfig` interface:

```typescript
export interface JellyfinUserMapping {
  jellyfin_user_id: string;
  hously_user_id: number;
}

export interface JellyfinSyncConfig {
  sync_token: string;
  website_url: string;
  user_mappings: JellyfinUserMapping[];
}
```

- [ ] **Step 4: Add normalizeJellyfinSyncConfig to normalizers**

In `apps/api/src/utils/integrations/normalizers.ts`, add this import at the top (alongside existing imports):

```typescript
import type { ..., JellyfinSyncConfig } from "./types";
```

Then add this function after `normalizeJellyfinConfig`:

```typescript
export const normalizeJellyfinSyncConfig = (
  config: unknown,
): JellyfinSyncConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const syncToken = normalizeSecret(cfg.sync_token);
  if (!syncToken) return null;

  const websiteUrl =
    typeof cfg.website_url === "string"
      ? cfg.website_url.trim().replace(/\/+$/, "")
      : "";

  const rawMappings = Array.isArray(cfg.user_mappings) ? cfg.user_mappings : [];
  const userMappings = rawMappings
    .filter(
      (m): m is Record<string, unknown> =>
        typeof m === "object" && m !== null && !Array.isArray(m),
    )
    .map((m) => ({
      jellyfin_user_id:
        typeof m.jellyfin_user_id === "string" ? m.jellyfin_user_id.trim() : "",
      hously_user_id:
        typeof m.hously_user_id === "number" ? m.hously_user_id : 0,
    }))
    .filter((m) => m.jellyfin_user_id.length > 0 && m.hously_user_id > 0);

  return {
    sync_token: syncToken,
    website_url: websiteUrl,
    user_mappings: userMappings,
  };
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && bun test src/utils/integrations/normalizers.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/utils/integrations/types.ts \
        apps/api/src/utils/integrations/normalizers.ts \
        apps/api/src/utils/integrations/normalizers.test.ts
git commit -m "feat(api): extend Jellyfin config types with sync fields"
```

---

## Task 2: Extend Jellyfin integration route (user_mappings + sync-token endpoint)

**Files:**

- Modify: `apps/api/src/routes/integrations/jellyfin/index.ts`

- [ ] **Step 1: Extend the PUT body schema to accept user_mappings**

In `apps/api/src/routes/integrations/jellyfin/index.ts`, replace the existing `body: t.Object(...)` for the PUT handler:

```typescript
body: t.Object({
  website_url: t.String(),
  api_key: t.String(),
  enabled: t.Optional(t.Boolean()),
  user_mappings: t.Optional(
    t.Array(
      t.Object({
        jellyfin_user_id: t.String(),
        hously_user_id: t.Number(),
      }),
    ),
  ),
}),
```

Then inside the PUT handler, before the `prisma.integration.upsert` call, extract user_mappings:

```typescript
const userMappings = (body.user_mappings ?? [])
  .filter((m) => m.jellyfin_user_id.trim().length > 0 && m.hously_user_id > 0)
  .map((m) => ({
    jellyfin_user_id: m.jellyfin_user_id.trim(),
    hously_user_id: m.hously_user_id,
  }));
```

In the `upsert` `update` and `create` `config` objects, add:

```typescript
config: {
  website_url: websiteUrl,
  api_key: encrypt(apiKey),
  // preserve existing sync_token if present
  ...(existingConfig ? { sync_token: (existingIntegration?.config as Record<string, unknown>)?.sync_token } : {}),
  user_mappings: userMappings,
},
```

- [ ] **Step 2: Add the POST /sync-token endpoint**

At the end of the `jellyfinIntegrationRoutes` chain (before the final semicolon), add:

```typescript
.post("/jellyfin/sync-token", async ({ user, set }) => {
  try {
    const { randomBytes } = await import("node:crypto");
    const newToken = randomBytes(32).toString("hex");

    const existing = await prisma.integration.findFirst({
      where: { type: "jellyfin" },
    });
    if (!existing) {
      return badRequest(set, "Jellyfin integration not configured");
    }

    const existingCfg =
      (existing.config as Record<string, unknown>) ?? {};

    await prisma.integration.update({
      where: { type: "jellyfin" },
      data: {
        config: {
          ...existingCfg,
          sync_token: encrypt(newToken),
        },
        updatedAt: nowUtc(),
      },
    });

    await logActivity({
      type: "integration_updated",
      userId: user!.id,
      payload: { integration_type: "jellyfin", action: "sync_token_regenerated" },
    });

    return { sync_token: newToken };
  } catch (error) {
    console.error("Error regenerating Jellyfin sync token:", error);
    return serverError(set, "Failed to regenerate sync token");
  }
})
```

Also update the existing GET `/jellyfin` handler to return the masked sync token presence:

```typescript
// In the GET handler return object, add:
has_sync_token: !!(normalizeJellyfinSyncConfig(integration?.config)?.sync_token),
user_mappings: normalizeJellyfinSyncConfig(integration?.config)?.user_mappings ?? [],
```

Add the import at the top of the file:

```typescript
import { normalizeJellyfinSyncConfig } from "@hously/api/utils/integrations/normalizers";
```

- [ ] **Step 3: Verify the API compiles**

```bash
cd apps/api && bun run typecheck 2>&1 | head -30
```

Expected: No TypeScript errors in `routes/integrations/jellyfin/index.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/integrations/jellyfin/index.ts
git commit -m "feat(api): extend Jellyfin integration with user_mappings and sync-token endpoint"
```

---

## Task 3: Sync data routes (plugin-facing + admin trigger)

**Files:**

- Create: `apps/api/src/routes/sync/jellyfin.ts`
- Create: `apps/api/src/routes/sync/jellyfin.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/routes/sync/jellyfin.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { resolveSyncUser, validateSyncToken } from "./jellyfin";

describe("resolveSyncUser", () => {
  it("returns hously_user_id for a matching jellyfin_user_id", () => {
    const mappings = [
      { jellyfin_user_id: "jf-123", hously_user_id: 7 },
      { jellyfin_user_id: "jf-456", hously_user_id: 9 },
    ];
    expect(resolveSyncUser("jf-123", mappings)).toBe(7);
  });

  it("returns null when no match", () => {
    expect(resolveSyncUser("jf-999", [])).toBeNull();
  });
});

describe("validateSyncToken", () => {
  it("returns true when token matches", () => {
    expect(validateSyncToken("Bearer abc123", "abc123")).toBe(true);
  });

  it("returns false when token does not match", () => {
    expect(validateSyncToken("Bearer wrong", "abc123")).toBe(false);
  });

  it("returns false when header is missing", () => {
    expect(validateSyncToken(undefined, "abc123")).toBe(false);
  });

  it("returns false when header has wrong prefix", () => {
    expect(validateSyncToken("Token abc123", "abc123")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && bun test src/routes/sync/jellyfin.test.ts
```

Expected: FAIL — `resolveSyncUser is not a function`

- [ ] **Step 3: Create the sync routes file**

Create `apps/api/src/routes/sync/jellyfin.ts`:

```typescript
import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireAdmin } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import { normalizeJellyfinSyncConfig } from "@hously/api/utils/integrations/normalizers";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

export function resolveSyncUser(
  jellyfinUserId: string,
  mappings: JellyfinUserMapping[],
): number | null {
  return (
    mappings.find((m) => m.jellyfin_user_id === jellyfinUserId)
      ?.hously_user_id ?? null
  );
}

export function validateSyncToken(
  authHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === expectedToken;
}

const syncTokenMiddleware = new Elysia().derive(
  { as: "scoped" },
  async ({ headers, set }) => {
    const integration = await getIntegrationConfigRecord("jellyfin");
    const syncConfig = normalizeJellyfinSyncConfig(integration?.config);

    if (
      !syncConfig ||
      !validateSyncToken(headers["authorization"], syncConfig.sync_token)
    ) {
      set.status = 401;
      throw new Error("Unauthorized");
    }

    return { syncConfig };
  },
);

const pluginRoutes = new Elysia()
  .use(syncTokenMiddleware)

  // GET /api/sync/jellyfin/watchlist/:jellyfinUserId
  .get("/watchlist/:jellyfinUserId", async ({ params, syncConfig, set }) => {
    const houslyUserId = resolveSyncUser(
      params.jellyfinUserId,
      syncConfig.user_mappings,
    );
    if (!houslyUserId) return badRequest(set, "Unknown Jellyfin user");

    try {
      const items = await prisma.watchlistItem.findMany({
        where: { userId: houslyUserId },
        select: {
          tmdbId: true,
          mediaType: true,
          title: true,
        },
      });
      return {
        items: items.map((i) => ({
          tmdb_id: i.tmdbId,
          media_type: i.mediaType,
          title: i.title,
        })),
      };
    } catch {
      return serverError(set, "Failed to fetch watchlist");
    }
  })

  // DELETE /api/sync/jellyfin/watchlist/:jellyfinUserId/item/:tmdbId?type=movie|tv
  .delete(
    "/watchlist/:jellyfinUserId/item/:tmdbId",
    async ({ params, query, syncConfig, set }) => {
      const houslyUserId = resolveSyncUser(
        params.jellyfinUserId,
        syncConfig.user_mappings,
      );
      if (!houslyUserId) return badRequest(set, "Unknown Jellyfin user");

      const tmdbId = parseInt(params.tmdbId, 10);
      if (isNaN(tmdbId)) return badRequest(set, "Invalid tmdbId");
      if (!query.type) return badRequest(set, "Missing type query param");

      try {
        await prisma.watchlistItem.deleteMany({
          where: { userId: houslyUserId, tmdbId, mediaType: query.type },
        });
        return { success: true };
      } catch {
        return serverError(set, "Failed to remove from watchlist");
      }
    },
    { query: t.Object({ type: t.Optional(t.String()) }) },
  );

const adminRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)

  // POST /api/sync/jellyfin/trigger — push sync to Jellyfin plugin
  .post(
    "/trigger",
    async ({ body, set }) => {
      const integration = await getIntegrationConfigRecord("jellyfin");
      const syncConfig = normalizeJellyfinSyncConfig(integration?.config);

      if (!syncConfig?.website_url || !syncConfig.sync_token) {
        return badRequest(set, "Jellyfin sync not configured");
      }

      try {
        await fetch(`${syncConfig.website_url}/hously/webhook/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${syncConfig.sync_token}`,
          },
          body: JSON.stringify({
            jellyfin_user_id: body?.jellyfin_user_id ?? null,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        return { success: true };
      } catch (e) {
        console.error("[jellyfinSyncTrigger] Failed to push sync:", e);
        return serverError(set, "Failed to reach Jellyfin plugin");
      }
    },
    {
      body: t.Optional(
        t.Object({
          jellyfin_user_id: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      ),
    },
  );

export const jellyfinSyncRoutes = new Elysia({ prefix: "/api/sync/jellyfin" })
  .use(pluginRoutes)
  .use(adminRoutes);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && bun test src/routes/sync/jellyfin.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Register in index.ts**

In `apps/api/src/index.ts`, add the import alongside the other route imports:

```typescript
import { jellyfinSyncRoutes } from "./routes/sync/jellyfin";
```

Add `.use(jellyfinSyncRoutes)` after the `.use(mediasRoutes)` line:

```typescript
.use(mediasRoutes)
.use(jellyfinSyncRoutes)
```

- [ ] **Step 6: Verify typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/sync/ apps/api/src/index.ts
git commit -m "feat(api): add Jellyfin sync data routes"
```

---

## Task 4: Jellyfin sync notifier service

**Files:**

- Create: `apps/api/src/services/jellyfinSyncNotifier.ts`
- Create: `apps/api/src/services/jellyfinSyncNotifier.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/src/services/jellyfinSyncNotifier.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { buildSyncPayload } from "./jellyfinSyncNotifier";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

describe("buildSyncPayload", () => {
  const mappings: JellyfinUserMapping[] = [
    { jellyfin_user_id: "jf-abc", hously_user_id: 3 },
  ];

  it("returns payload when hously user is mapped", () => {
    const result = buildSyncPayload(
      { houslyUserId: 3, tmdbId: 100, mediaType: "movie", action: "added" },
      mappings,
    );
    expect(result).toEqual({
      jellyfin_user_id: "jf-abc",
      tmdb_id: 100,
      media_type: "movie",
      action: "added",
    });
  });

  it("returns null when hously user has no mapping", () => {
    const result = buildSyncPayload(
      { houslyUserId: 99, tmdbId: 100, mediaType: "movie", action: "added" },
      mappings,
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && bun test src/services/jellyfinSyncNotifier.test.ts
```

Expected: FAIL — `buildSyncPayload is not a function`

- [ ] **Step 3: Create the notifier service**

Create `apps/api/src/services/jellyfinSyncNotifier.ts`:

```typescript
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeJellyfinSyncConfig } from "@hously/api/utils/integrations/normalizers";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

interface SyncParams {
  houslyUserId: number;
  tmdbId: number;
  mediaType: string;
  action: "added" | "removed";
}

interface SyncPayload {
  jellyfin_user_id: string;
  tmdb_id: number;
  media_type: string;
  action: "added" | "removed";
}

export function buildSyncPayload(
  params: SyncParams,
  mappings: JellyfinUserMapping[],
): SyncPayload | null {
  const mapping = mappings.find(
    (m) => m.hously_user_id === params.houslyUserId,
  );
  if (!mapping) return null;
  return {
    jellyfin_user_id: mapping.jellyfin_user_id,
    tmdb_id: params.tmdbId,
    media_type: params.mediaType,
    action: params.action,
  };
}

export async function notifyJellyfinWatchlistChange(
  params: SyncParams,
): Promise<void> {
  try {
    const integration = await getIntegrationConfigRecord("jellyfin");
    if (!integration?.enabled) return;

    const syncConfig = normalizeJellyfinSyncConfig(integration.config);
    if (!syncConfig?.website_url || !syncConfig.sync_token) return;

    const payload = buildSyncPayload(params, syncConfig.user_mappings);
    if (!payload) return;

    await fetch(`${syncConfig.website_url}/hously/webhook/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${syncConfig.sync_token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    console.warn("[jellyfinSyncNotifier] Failed to notify:", e);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && bun test src/services/jellyfinSyncNotifier.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/jellyfinSyncNotifier.ts \
        apps/api/src/services/jellyfinSyncNotifier.test.ts
git commit -m "feat(api): add Jellyfin sync notifier service"
```

---

## Task 5: Wire notifier into watchlist routes

**Files:**

- Modify: `apps/api/src/routes/medias/watchlist/index.ts`

- [ ] **Step 1: Add import**

At the top of `apps/api/src/routes/medias/watchlist/index.ts`, add:

```typescript
import { notifyJellyfinWatchlistChange } from "@hously/api/services/jellyfinSyncNotifier";
```

- [ ] **Step 2: Fire notifier after successful POST (add)**

In the POST handler, after the `return { id: item.id, added: true };` line and before the closing `}`, fire the notifier non-blocking:

```typescript
const result = { id: item.id, added: true };

// Fire-and-forget: non-blocking, does not affect response
notifyJellyfinWatchlistChange({
  houslyUserId: user!.id,
  tmdbId: body.tmdb_id,
  mediaType: body.media_type,
  action: "added",
}).catch(() => {});

return result;
```

- [ ] **Step 3: Fire notifier after successful DELETE (remove)**

In the DELETE handler, replace `return { success: true };` with:

```typescript
notifyJellyfinWatchlistChange({
  houslyUserId: user!.id,
  tmdbId,
  mediaType: query.type as string,
  action: "removed",
}).catch(() => {});

return { success: true };
```

- [ ] **Step 4: Verify typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep "watchlist" | head -10
```

Expected: No errors in watchlist file

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/medias/watchlist/index.ts
git commit -m "feat(api): notify Jellyfin plugin on watchlist add/remove"
```

---

## Task 6: Hously Settings UI — Watchlist Sync subsection

**Files:**

- Modify: `apps/web/src/pages/settings/_component/integrations/JellyfinIntegrationSection.tsx`

- [ ] **Step 1: Read the existing component**

Open `apps/web/src/pages/settings/_component/integrations/JellyfinIntegrationSection.tsx` and understand its current query/mutation structure before editing.

- [ ] **Step 2: Add query key and hook support**

In `apps/shared/src/queryKeys.ts`, verify `integrations.jellyfin` exists or add it. The existing Jellyfin integration GET already returns `has_sync_token` and `user_mappings` after Task 2, so no new endpoint query key is needed — extend the existing one.

- [ ] **Step 3: Add user listing query**

In the settings component, add a query to fetch existing Hously users for the dropdown (use the existing users query if available, or add a call to `/api/users`):

```tsx
const { data: usersData } = useQuery({
  queryKey: queryKeys.users.list(),
  queryFn: () =>
    fetcher<{ users: Array<{ id: number; email: string; name: string }> }>(
      "/api/users",
    ),
});
```

- [ ] **Step 4: Add local state for user mappings**

Inside the component, add:

```tsx
const [userMappings, setUserMappings] = useState<
  Array<{ jellyfin_user_id: string; hously_user_id: number }>
>(jellyfinData?.integration?.user_mappings ?? []);

// sync from server data when loaded
useEffect(() => {
  if (jellyfinData?.integration?.user_mappings) {
    setUserMappings(jellyfinData.integration.user_mappings);
  }
}, [jellyfinData]);
```

- [ ] **Step 5: Add mutation for sync-token regeneration**

```tsx
const regenerateSyncToken = useMutation({
  mutationFn: () =>
    fetcher<{ sync_token: string }>("/api/integrations/jellyfin/sync-token", {
      method: "POST",
    }),
  onSuccess: (data) => {
    setDisplayedToken(data.sync_token);
    queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.jellyfin(),
    });
  },
});
```

- [ ] **Step 6: Add mutation for manual sync trigger**

```tsx
const triggerSync = useMutation({
  mutationFn: (jellyfinUserId?: string) =>
    fetcher("/api/sync/jellyfin/trigger", {
      method: "POST",
      body: jellyfinUserId ? { jellyfin_user_id: jellyfinUserId } : {},
    }),
});
```

- [ ] **Step 7: Render the Watchlist Sync subsection**

Add this section inside the component's JSX, below the existing Jellyfin form fields:

```tsx
<div className="mt-6 space-y-4 border-t pt-4">
  <h3 className="text-sm font-semibold">
    {t("settings.jellyfin.watchlistSync")}
  </h3>

  {/* Sync token */}
  <div className="space-y-1">
    <Label>{t("settings.jellyfin.syncToken")}</Label>
    <div className="flex gap-2">
      <Input
        type="text"
        readOnly
        value={
          displayedToken
            ? displayedToken
            : jellyfinData?.integration?.has_sync_token
              ? "••••••••••••••••"
              : t("settings.jellyfin.noSyncToken")
        }
        className="font-mono text-xs"
      />
      {displayedToken && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(displayedToken);
            setDisplayedToken(null);
          }}
        >
          {t("common.copy")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => regenerateSyncToken.mutate()}
        disabled={regenerateSyncToken.isPending}
      >
        {t("settings.jellyfin.regenerate")}
      </Button>
    </div>
  </div>

  {/* User mappings */}
  <div className="space-y-2">
    <Label>{t("settings.jellyfin.userMappings")}</Label>
    {userMappings.map((mapping, idx) => (
      <div key={idx} className="flex gap-2 items-center">
        <Input
          placeholder={t("settings.jellyfin.jellyfinUserId")}
          value={mapping.jellyfin_user_id}
          onChange={(e) => {
            const updated = [...userMappings];
            updated[idx] = {
              ...updated[idx],
              jellyfin_user_id: e.target.value,
            };
            setUserMappings(updated);
          }}
          className="font-mono text-xs"
        />
        <Select
          value={String(mapping.hously_user_id)}
          onValueChange={(val) => {
            const updated = [...userMappings];
            updated[idx] = { ...updated[idx], hously_user_id: Number(val) };
            setUserMappings(updated);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {usersData?.users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name ?? u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => triggerSync.mutate(mapping.jellyfin_user_id)}
          title={t("settings.jellyfin.syncUser")}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setUserMappings(userMappings.filter((_, i) => i !== idx))
          }
        >
          <X className="size-4" />
        </Button>
      </div>
    ))}
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        setUserMappings([
          ...userMappings,
          { jellyfin_user_id: "", hously_user_id: 0 },
        ])
      }
    >
      {t("settings.jellyfin.addMapping")}
    </Button>
  </div>

  {/* Sync All button */}
  <Button
    variant="outline"
    onClick={() => triggerSync.mutate(undefined)}
    disabled={triggerSync.isPending}
  >
    <RefreshCw className="size-4 mr-2" />
    {t("settings.jellyfin.syncAll")}
  </Button>
</div>
```

- [ ] **Step 8: Ensure user_mappings are saved on PUT**

In the existing form submit handler, add `user_mappings: userMappings` to the PUT body.

- [ ] **Step 9: Add i18n keys**

In `apps/web/src/locales/en.json` (and any other locale files), add under the `settings.jellyfin` key:

```json
"watchlistSync": "Watchlist Sync",
"syncToken": "Sync Token",
"noSyncToken": "Not configured",
"regenerate": "Regenerate",
"userMappings": "User Mappings",
"jellyfinUserId": "Jellyfin User ID",
"syncUser": "Sync this user",
"addMapping": "Add mapping",
"syncAll": "Sync All"
```

- [ ] **Step 10: Start dev server and test manually**

```bash
make dev-api   # Terminal 1
make dev-web   # Terminal 2
```

Navigate to Settings → Integrations → Jellyfin. Verify:

- "Watchlist Sync" section appears below the existing fields
- "Regenerate" button calls the API and reveals the token (copy it to use in the plugin)
- Adding a user mapping row shows Jellyfin User ID input + Hously user dropdown
- Per-row sync button is visible
- "Sync All" button is visible
- Saving the form persists user_mappings

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/pages/settings/_component/integrations/JellyfinIntegrationSection.tsx \
        apps/web/src/locales/
git commit -m "feat(web): add Jellyfin watchlist sync settings UI"
```

---

## Task 7: Jellyfin plugin scaffold

**Files:**

- Create: `apps/jellyfin-plugin/` (all scaffold files)

- [ ] **Step 1: Create the solution and project files**

```bash
mkdir -p apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services
mkdir -p apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Configuration
```

Create `apps/jellyfin-plugin/Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <Version>1.0.0.0</Version>
    <AssemblyVersion>$(Version)</AssemblyVersion>
    <FileVersion>$(Version)</FileVersion>
  </PropertyGroup>
</Project>
```

Create `apps/jellyfin-plugin/build.yaml`:

```yaml
---
version: 1.0.0.0
```

Create `apps/jellyfin-plugin/manifest.json`:

```json
[
  {
    "category": "General",
    "guid": "a3f4e2c1-8d6b-4f9a-b2e7-1c5d9f3a7e2b",
    "imageUrl": "",
    "name": "Hously Watchlist",
    "description": "Syncs your Hously watchlist with a Jellyfin collection.",
    "overview": "Maintains a per-user What's Next collection from your Hously watchlist.",
    "owner": "Hously",
    "targetAbi": "10.11.7.0",
    "timestamp": "2026-05-04T00:00:00Z",
    "versions": []
  }
]
```

- [ ] **Step 2: Create the .csproj**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Jellyfin.Plugin.HouslyWatchlist.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <AssemblyName>Jellyfin.Plugin.HouslyWatchlist</AssemblyName>
    <RootNamespace>Jellyfin.Plugin.HouslyWatchlist</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Jellyfin.Controller" Version="10.11.7" ExcludeAssets="runtime" />
    <PackageReference Include="Jellyfin.Model" Version="10.11.7" ExcludeAssets="runtime" />
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>

  <ItemGroup>
    <EmbeddedResource Include="Configuration\configPage.html" />
  </ItemGroup>

</Project>
```

- [ ] **Step 3: Create the solution file**

```bash
cd apps/jellyfin-plugin
dotnet new sln -n Jellyfin.Plugin.HouslyWatchlist
dotnet sln add Jellyfin.Plugin.HouslyWatchlist/Jellyfin.Plugin.HouslyWatchlist.csproj
```

- [ ] **Step 4: Create PluginConfiguration.cs**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginConfiguration.cs`:

```csharp
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class UserMapping
{
    public string JellyfinUserId { get; set; } = string.Empty;
    public int HouslyUserId { get; set; }
}

public class PluginConfiguration : BasePluginConfiguration
{
    public string HouslyBaseUrl { get; set; } = string.Empty;
    public string AdminToken { get; set; } = string.Empty;
    public int SyncIntervalMinutes { get; set; } = 15;
    public List<UserMapping> UserMappings { get; set; } = [];
}
```

- [ ] **Step 5: Create Plugin.cs**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Plugin.cs`:

```csharp
using System.Reflection;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static Plugin? Instance { get; private set; }

    public Plugin(IApplicationPaths appPaths, IXmlSerializer xmlSerializer)
        : base(appPaths, xmlSerializer)
    {
        Instance = this;
    }

    public override string Name => "Hously Watchlist";

    public override Guid Id => Guid.Parse("a3f4e2c1-8d6b-4f9a-b2e7-1c5d9f3a7e2b");

    public override string Description => "Syncs your Hously watchlist with a Jellyfin What's Next collection.";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html",
        };
    }
}
```

- [ ] **Step 6: Create PluginServiceRegistrator.cs**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginServiceRegistrator.cs`:

```csharp
using Jellyfin.Plugin.HouslyWatchlist.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<HouslyApiClient>();
        serviceCollection.AddSingleton<WatchlistSyncService>();
        serviceCollection.AddHostedService(sp => sp.GetRequiredService<WatchlistSyncService>());
    }
}
```

- [ ] **Step 7: Create a placeholder configPage.html**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Configuration/configPage.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Hously Watchlist</title>
</head>
<body>
  <div id="HouslyWatchlistConfigPage" data-role="page" class="page type-interior pluginConfigurationPage">
    <div data-role="content">
      <div class="content-primary">
        <form id="HouslyWatchlistConfigForm">
          <div class="inputContainer">
            <label class="inputLabel" for="houslyBaseUrl">Hously Base URL</label>
            <input id="houslyBaseUrl" name="HouslyBaseUrl" type="url" />
          </div>
          <div class="inputContainer">
            <label class="inputLabel" for="adminToken">Sync Token</label>
            <input id="adminToken" name="AdminToken" type="password" />
          </div>
          <div class="inputContainer">
            <label class="inputLabel" for="syncIntervalMinutes">Sync Interval (minutes)</label>
            <input id="syncIntervalMinutes" name="SyncIntervalMinutes" type="number" min="5" max="1440" />
          </div>
          <div>
            <button is="emby-button" type="submit" class="raised block emby-button">Save</button>
            <button is="emby-button" type="button" id="syncNowBtn" class="raised block emby-button">Sync Now</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <script type="text/javascript">
    var HouslyWatchlistConfig = {
      pluginUniqueId: 'a3f4e2c1-8d6b-4f9a-b2e7-1c5d9f3a7e2b'
    };
    document.querySelector('#HouslyWatchlistConfigPage').addEventListener('pageshow', function() {
      ApiClient.getPluginConfiguration(HouslyWatchlistConfig.pluginUniqueId).then(function(config) {
        document.querySelector('#houslyBaseUrl').value = config.HouslyBaseUrl || '';
        document.querySelector('#adminToken').value = '';
        document.querySelector('#syncIntervalMinutes').value = config.SyncIntervalMinutes || 15;
      });
    });
    document.querySelector('#HouslyWatchlistConfigForm').addEventListener('submit', function(e) {
      e.preventDefault();
      ApiClient.getPluginConfiguration(HouslyWatchlistConfig.pluginUniqueId).then(function(config) {
        config.HouslyBaseUrl = document.querySelector('#houslyBaseUrl').value;
        var token = document.querySelector('#adminToken').value;
        if (token) config.AdminToken = token;
        config.SyncIntervalMinutes = parseInt(document.querySelector('#syncIntervalMinutes').value, 10);
        ApiClient.updatePluginConfiguration(HouslyWatchlistConfig.pluginUniqueId, config).then(function() {
          Dashboard.processPluginConfigurationUpdateResult();
        });
      });
    });
    document.querySelector('#syncNowBtn').addEventListener('click', function() {
      var baseUrl = document.querySelector('#houslyBaseUrl').value;
      var token = Plugin.Instance?.Configuration?.AdminToken;
      if (!baseUrl || !token) { alert('Save config first.'); return; }
      fetch(baseUrl + '/hously/webhook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ jellyfin_user_id: null })
      }).then(function() { alert('Sync triggered.'); });
    });
  </script>
</html>
```

- [ ] **Step 8: Verify the project builds**

```bash
cd apps/jellyfin-plugin
dotnet build --configuration Release 2>&1 | tail -10
```

Expected: `Build succeeded.` (Plugin.cs and PluginServiceRegistrator.cs reference Services classes that don't exist yet — that's expected to fail here. Create stubs for HouslyApiClient and WatchlistSyncService first.)

Create stub `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/HouslyApiClient.cs`:

```csharp
namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public class HouslyApiClient
{
    public HouslyApiClient(HttpClient httpClient) { }
}
```

Create stub `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/WatchlistSyncService.cs`:

```csharp
using Microsoft.Extensions.Hosting;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public class WatchlistSyncService : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
```

```bash
dotnet build --configuration Release 2>&1 | tail -5
```

Expected: `Build succeeded.`

- [ ] **Step 9: Commit**

```bash
cd /home/samuelloranger/sites/hously
git add apps/jellyfin-plugin/
git commit -m "feat(plugin): scaffold Jellyfin HouslyWatchlist plugin"
```

---

## Task 8: HouslyApiClient

**Files:**

- Modify: `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/HouslyApiClient.cs`

- [ ] **Step 1: Implement HouslyApiClient**

Replace the stub in `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/HouslyApiClient.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public record WatchlistItem(
    [property: JsonPropertyName("tmdb_id")] int TmdbId,
    [property: JsonPropertyName("media_type")] string MediaType,
    [property: JsonPropertyName("title")] string Title
);

public record WatchlistResponse(
    [property: JsonPropertyName("items")] List<WatchlistItem> Items
);

public class HouslyApiClient
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public HouslyApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string url, object? body = null)
    {
        var config = Plugin.Instance?.Configuration;
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", config?.AdminToken ?? "");
        if (body is not null)
            req.Content = JsonContent.Create(body);
        return req;
    }

    public async Task<List<WatchlistItem>> GetWatchlistAsync(
        string jellyfinUserId,
        CancellationToken cancellationToken = default)
    {
        var config = Plugin.Instance?.Configuration;
        if (string.IsNullOrEmpty(config?.HouslyBaseUrl)) return [];

        var url = $"{config.HouslyBaseUrl}/api/sync/jellyfin/watchlist/{Uri.EscapeDataString(jellyfinUserId)}";
        using var req = BuildRequest(HttpMethod.Get, url);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(10));

        var resp = await _httpClient.SendAsync(req, cts.Token).ConfigureAwait(false);
        if (!resp.IsSuccessStatusCode) return [];

        var result = await resp.Content.ReadFromJsonAsync<WatchlistResponse>(_jsonOptions, cts.Token)
            .ConfigureAwait(false);
        return result?.Items ?? [];
    }

    public async Task RemoveWatchlistItemAsync(
        string jellyfinUserId,
        int tmdbId,
        string mediaType,
        CancellationToken cancellationToken = default)
    {
        var config = Plugin.Instance?.Configuration;
        if (string.IsNullOrEmpty(config?.HouslyBaseUrl)) return;

        var url = $"{config.HouslyBaseUrl}/api/sync/jellyfin/watchlist/{Uri.EscapeDataString(jellyfinUserId)}/item/{tmdbId}?type={Uri.EscapeDataString(mediaType)}";
        using var req = BuildRequest(HttpMethod.Delete, url);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(10));

        await _httpClient.SendAsync(req, cts.Token).ConfigureAwait(false);
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd apps/jellyfin-plugin && dotnet build --configuration Release 2>&1 | tail -5
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
cd /home/samuelloranger/sites/hously
git add apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/HouslyApiClient.cs
git commit -m "feat(plugin): implement HouslyApiClient"
```

---

## Task 9: WatchlistSyncService — timer + collection sync

**Files:**

- Modify: `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/WatchlistSyncService.cs`

- [ ] **Step 1: Implement the full WatchlistSyncService**

Replace the stub with the full implementation:

```csharp
using MediaBrowser.Controller.Collections;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public class WatchlistSyncService : IHostedService, IDisposable
{
    private readonly ILibraryManager _libraryManager;
    private readonly ICollectionManager _collectionManager;
    private readonly IUserDataManager _userDataManager;
    private readonly HouslyApiClient _apiClient;
    private readonly ILogger<WatchlistSyncService> _logger;
    private Timer? _timer;

    public WatchlistSyncService(
        ILibraryManager libraryManager,
        ICollectionManager collectionManager,
        IUserDataManager userDataManager,
        HouslyApiClient apiClient,
        ILogger<WatchlistSyncService> logger)
    {
        _libraryManager = libraryManager;
        _collectionManager = collectionManager;
        _userDataManager = userDataManager;
        _apiClient = apiClient;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _userDataManager.UserDataSaved += OnUserDataSaved;

        var intervalMinutes = Plugin.Instance?.Configuration.SyncIntervalMinutes ?? 15;
        _timer = new Timer(
            _ => _ = SyncAllUsersAsync(CancellationToken.None),
            null,
            TimeSpan.FromMinutes(1),        // initial delay: 1 min after startup
            TimeSpan.FromMinutes(intervalMinutes));

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public async Task SyncAllUsersAsync(CancellationToken cancellationToken)
    {
        var mappings = Plugin.Instance?.Configuration.UserMappings ?? [];
        foreach (var mapping in mappings)
        {
            await SyncUserAsync(mapping.JellyfinUserId, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SyncUserAsync(string jellyfinUserId, CancellationToken cancellationToken)
    {
        try
        {
            var watchlistItems = await _apiClient.GetWatchlistAsync(jellyfinUserId, cancellationToken)
                .ConfigureAwait(false);

            // Match watchlist TMDB IDs against Jellyfin library items
            var matchedItemIds = new List<Guid>();
            foreach (var wItem in watchlistItems)
            {
                var libraryItems = _libraryManager.GetItemList(new InternalItemsQuery
                {
                    IncludeItemTypes = wItem.MediaType == "movie"
                        ? [BaseItemKind.Movie]
                        : [BaseItemKind.Series],
                    IsVirtualItem = false,
                });

                var matched = libraryItems.FirstOrDefault(i =>
                    i.ProviderIds.TryGetValue(MetadataProvider.Tmdb.ToString(), out var id)
                    && id == wItem.TmdbId.ToString());

                if (matched is not null)
                    matchedItemIds.Add(matched.Id);
            }

            await UpsertCollectionAsync(jellyfinUserId, matchedItemIds, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HouslyWatchlist] Sync failed for Jellyfin user {UserId}", jellyfinUserId);
        }
    }

    private async Task UpsertCollectionAsync(
        string jellyfinUserId,
        List<Guid> itemIds,
        CancellationToken cancellationToken)
    {
        var collectionName = $"What's Next — {jellyfinUserId}";

        // Find existing collection
        var existing = _libraryManager.GetItemList(new InternalItemsQuery
        {
            IncludeItemTypes = [BaseItemKind.BoxSet],
            Name = collectionName,
        }).FirstOrDefault();

        if (existing is BoxSet existingCollection)
        {
            // Remove all current items and add the new set
            var currentChildren = existingCollection.GetChildren(null, true)
                .Select(c => c.Id).ToList();

            if (currentChildren.Any())
                await _collectionManager.RemoveFromCollectionAsync(existingCollection.Id, currentChildren)
                    .ConfigureAwait(false);

            if (itemIds.Any())
                await _collectionManager.AddToCollectionAsync(existingCollection.Id, itemIds)
                    .ConfigureAwait(false);
        }
        else if (itemIds.Any())
        {
            await _collectionManager.CreateCollectionAsync(new CollectionCreationOptions
            {
                Name = collectionName,
                ItemIdList = itemIds.Select(id => id.ToString()).ToArray(),
                IsLocked = false,
            }).ConfigureAwait(false);
        }
    }

    private async void OnUserDataSaved(object? sender, UserDataSaveEventArgs e)
    {
        if (!e.UserData.Played) return;
        if (e.Item is not (Movie or Series)) return;
        if (!e.Item.ProviderIds.TryGetValue(MetadataProvider.Tmdb.ToString(), out var tmdbIdStr)) return;
        if (!int.TryParse(tmdbIdStr, out var tmdbId)) return;

        var jellyfinUserId = e.UserId.ToString("N");
        var mappings = Plugin.Instance?.Configuration.UserMappings ?? [];
        var mapping = mappings.FirstOrDefault(m => m.JellyfinUserId == jellyfinUserId);
        if (mapping is null) return;

        var mediaType = e.Item is Movie ? "movie" : "tv";

        try
        {
            await _apiClient.RemoveWatchlistItemAsync(jellyfinUserId, tmdbId, mediaType)
                .ConfigureAwait(false);

            // Update local collection
            await SyncUserAsync(jellyfinUserId, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HouslyWatchlist] Failed to remove watched item {TmdbId}", tmdbId);
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        GC.SuppressFinalize(this);
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd apps/jellyfin-plugin && dotnet build --configuration Release 2>&1 | tail -10
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
cd /home/samuelloranger/sites/hously
git add apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/Services/WatchlistSyncService.cs
git commit -m "feat(plugin): implement WatchlistSyncService with timer and collection sync"
```

---

## Task 10: Webhook middleware (POST /hously/webhook/sync)

**Files:**

- Create: `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/HouslyWebhookMiddleware.cs`
- Modify: `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginServiceRegistrator.cs`

- [ ] **Step 1: Create the middleware**

Create `apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/HouslyWebhookMiddleware.cs`:

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using Jellyfin.Plugin.HouslyWatchlist.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HouslyWatchlist;

public record WebhookPayload(
    [property: JsonPropertyName("jellyfin_user_id")] string? JellyfinUserId,
    [property: JsonPropertyName("tmdb_id")] int? TmdbId,
    [property: JsonPropertyName("media_type")] string? MediaType,
    [property: JsonPropertyName("action")] string? Action
);

public class HouslyWebhookMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<HouslyWebhookMiddleware> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public HouslyWebhookMiddleware(RequestDelegate next, ILogger<HouslyWebhookMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, WatchlistSyncService syncService)
    {
        if (context.Request.Method != HttpMethods.Post ||
            !context.Request.Path.StartsWithSegments("/hously/webhook/sync"))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        // Validate Bearer token
        var expectedToken = Plugin.Instance?.Configuration.AdminToken;
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(expectedToken) ||
            authHeader != $"Bearer {expectedToken}")
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        WebhookPayload? payload;
        try
        {
            payload = await JsonSerializer.DeserializeAsync<WebhookPayload>(
                context.Request.Body, _jsonOptions, context.RequestAborted)
                .ConfigureAwait(false);
        }
        catch
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        // Full sync (no specific user) or per-user sync
        _ = Task.Run(async () =>
        {
            try
            {
                if (string.IsNullOrEmpty(payload?.JellyfinUserId))
                    await syncService.SyncAllUsersAsync(CancellationToken.None).ConfigureAwait(false);
                else
                    await syncService.SyncUserAsync(payload.JellyfinUserId, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[HouslyWatchlist] Webhook sync failed");
            }
        });

        context.Response.StatusCode = StatusCodes.Status202Accepted;
    }
}
```

- [ ] **Step 2: Register middleware in PluginServiceRegistrator**

In `PluginServiceRegistrator.cs`, add a second registrar that injects the middleware. Add a new class to the file:

```csharp
using Jellyfin.Plugin.HouslyWatchlist.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<HouslyApiClient>();
        serviceCollection.AddSingleton<WatchlistSyncService>();
        serviceCollection.AddHostedService(sp => sp.GetRequiredService<WatchlistSyncService>());
    }
}

public class HouslyStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.UseMiddleware<HouslyWebhookMiddleware>();
            next(app);
        };
    }
}
```

Also register the startup filter in `PluginServiceRegistrator.RegisterServices`:

```csharp
serviceCollection.AddSingleton<IStartupFilter, HouslyStartupFilter>();
```

- [ ] **Step 3: Add missing using**

At the top of `PluginServiceRegistrator.cs`, ensure this using is present:

```csharp
using Microsoft.AspNetCore.Hosting;
```

- [ ] **Step 4: Build to verify**

```bash
cd apps/jellyfin-plugin && dotnet build --configuration Release 2>&1 | tail -10
```

Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```bash
cd /home/samuelloranger/sites/hously
git add apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/HouslyWebhookMiddleware.cs \
        apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/PluginServiceRegistrator.cs
git commit -m "feat(plugin): add webhook middleware for event-driven sync"
```

---

## Task 11: CI/CD workflow

**Files:**

- Create: `.github/workflows/jellyfin-plugin.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/jellyfin-plugin.yml`:

```yaml
name: Build Jellyfin Plugin

on:
  release:
    types: [published]

jobs:
  build-jellyfin-plugin:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for plugin changes since last release
        id: changes
        run: |
          CURRENT_TAG="${{ github.event.release.tag_name }}"
          PREV_TAG=$(git tag --sort=-version:refname | grep -v "^${CURRENT_TAG}$" | head -1)
          if [ -z "$PREV_TAG" ]; then
            echo "No previous tag found, treating as changed"
            echo "changed=1" >> "$GITHUB_OUTPUT"
          else
            COUNT=$(git diff --name-only "$PREV_TAG" HEAD -- apps/jellyfin-plugin/ | wc -l)
            echo "changed=$COUNT" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup .NET 9
        if: steps.changes.outputs.changed != '0'
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "9.0.x"

      - name: Build plugin
        if: steps.changes.outputs.changed != '0'
        run: |
          cd apps/jellyfin-plugin
          dotnet build --configuration Release

      - name: Package plugin
        if: steps.changes.outputs.changed != '0'
        id: package
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          DLL="apps/jellyfin-plugin/Jellyfin.Plugin.HouslyWatchlist/bin/Release/net9.0/Jellyfin.Plugin.HouslyWatchlist.dll"
          ZIP="Jellyfin.Plugin.HouslyWatchlist_${VERSION}.zip"
          zip "$ZIP" "$DLL"
          MD5=$(md5sum "$ZIP" | awk '{print $1}')
          echo "zip=$ZIP" >> "$GITHUB_OUTPUT"
          echo "md5=$MD5" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

      - name: Update manifest.json
        if: steps.changes.outputs.changed != '0'
        run: |
          python3 - <<'EOF'
          import json, datetime, sys

          with open('apps/jellyfin-plugin/manifest.json') as f:
              manifest = json.load(f)

          version = "${{ steps.package.outputs.version }}".lstrip('v')
          checksum = "${{ steps.package.outputs.md5 }}"
          zip_name = "${{ steps.package.outputs.zip }}"
          repo = "${{ github.repository }}"
          release_tag = "${{ github.event.release.tag_name }}"

          new_entry = {
              "version": version,
              "changelog": "${{ github.event.release.body }}",
              "targetAbi": "10.11.7.0",
              "sourceUrl": f"https://github.com/{repo}/releases/download/{release_tag}/{zip_name}",
              "checksum": checksum,
              "timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
          }

          manifest[0]["versions"].insert(0, new_entry)

          with open('apps/jellyfin-plugin/manifest.json', 'w') as f:
              json.dump(manifest, f, indent=2)
          EOF

      - name: Commit manifest update
        if: steps.changes.outputs.changed != '0'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add apps/jellyfin-plugin/manifest.json
          git commit -m "chore(plugin): update manifest for ${{ github.event.release.tag_name }}" || true
          git push origin HEAD:main

      - name: Upload plugin to release
        if: steps.changes.outputs.changed != '0'
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.package.outputs.zip }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/jellyfin-plugin.yml
git commit -m "ci: add Jellyfin plugin build workflow on release"
```

---

## Task 12: Manual end-to-end verification

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api && bun test 2>&1 | tail -20
```

Expected: All tests pass, no regressions.

- [ ] **Step 2: Verify API typecheck**

```bash
make typecheck 2>&1 | tail -10
```

Expected: No TypeScript errors.

- [ ] **Step 3: Verify plugin builds clean**

```bash
cd apps/jellyfin-plugin && dotnet build --configuration Release 2>&1 | tail -5
```

Expected: `Build succeeded. 0 Error(s).`

- [ ] **Step 4: Test Hously → Jellyfin push**

Start the dev stack (`make dev-api`, `make dev-web`). In Hously:

1. Configure Jellyfin integration with a real Jellyfin URL + API key.
2. Generate a sync token — copy it.
3. Install the built plugin in Jellyfin, configure the Hously base URL and paste the sync token.
4. Add a user mapping (Jellyfin user ID → Hously user).
5. Add a movie to the Hously watchlist.
6. Verify a "What's Next" collection appears in Jellyfin with that movie (if it's in the library).

- [ ] **Step 5: Test Jellyfin → Hously removal**

In Jellyfin, mark a movie from the watchlist as played. Verify the item is removed from the Hously watchlist.

- [ ] **Step 6: Test manual sync buttons**

In Hously settings, click per-user Sync and verify the collection updates. Click Sync All and verify all mapped users' collections update.
