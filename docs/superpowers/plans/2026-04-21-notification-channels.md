# Notification Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-configurable outbound notification channels so any Hously notification can be delivered outside the app. **Initial scope: ntfy only** (the only provider the user can currently test). Architecture is provider-agnostic so additional providers (Telegram, Discord, Pushover, Gotify, etc.) can be added later by plugging into the existing dispatcher switch.

**Architecture:** A new `NotificationChannel` DB model stores per-user channel configs as typed JSON. The `type` column holds the provider key (currently only `"ntfy"`). The existing `notificationWorker.ts` gains a third dispatch loop after Web Push and APNs that iterates enabled channels and calls a single `dispatchToChannel` orchestrator. The orchestrator is a `switch` on `channel.type` — adding a new provider later means: (1) add a new config interface + union member, (2) implement one `dispatchX` function, (3) add a `case` to the switch, (4) add a `case` to the UI's `emptyConfig` + `ConfigFields` helpers, (5) add an entry to `CHANNEL_TYPES`. No schema change, no worker change, no route change.

**Tech Stack:** Elysia (API routes), Prisma + PostgreSQL (schema/data), BullMQ (worker), TanStack Query (frontend hooks), React 19 + Tailwind CSS 4 (settings UI), bun:test (unit tests)

---

## File Map

**Create:**

- `apps/api/src/utils/notifications/channelDispatchers.ts` — `dispatchNtfy` + `dispatchToChannel` orchestrator (switch-based, ready to extend)
- `apps/api/src/utils/notifications/channelDispatchers.test.ts` — Unit tests with mocked fetch (ntfy + orchestrator)
- `apps/api/src/routes/notifications/channels.ts` — CRUD + test-send route (`/api/notifications/channels`)
- `apps/shared/src/types/notificationChannel.ts` — Shared TypeScript interfaces (discriminated-union shape)
- `apps/web/src/lib/notifications/useNotificationChannels.ts` — Five TanStack Query hooks
- `apps/web/src/pages/settings/_component/NotificationChannelsSection.tsx` — Settings UI card

**Modify:**

- `apps/api/prisma/schema.prisma` — Add `NotificationChannel` model + `User.notificationChannels` relation
- `apps/api/src/routes/notifications/index.ts` — Mount `notificationChannelsRoutes`
- `apps/api/src/services/jobs/notificationWorker.ts` — Add channel dispatch loop in `processRegularNotificationJob`
- `apps/shared/src/index.ts` — Re-export new types
- `apps/web/src/lib/endpoints/notifications.ts` — Add `CHANNELS`, `CHANNEL`, `CHANNEL_TEST` constants
- `apps/web/src/lib/queryKeys.ts` — Add `notifications.channels()` query key
- `apps/web/src/pages/settings/_component/NotificationsTab.tsx` — Render `<NotificationChannelsSection />`

---

## Extending to a new provider (future reference)

Once this plan is complete, adding e.g. Telegram is:

1. `apps/shared/src/types/notificationChannel.ts` — add `TelegramChannelConfig`, add `"telegram"` to `NotificationChannelType`, add `TelegramChannelConfig` to the `NotificationChannelConfig` union.
2. `apps/api/src/utils/notifications/channelDispatchers.ts` — add `dispatchTelegram()`, add `case "telegram":` to `dispatchToChannel`.
3. `apps/api/src/utils/notifications/channelDispatchers.test.ts` — add tests for the new dispatcher.
4. `apps/api/src/routes/notifications/channels.ts` — add `"telegram"` to `VALID_TYPES`.
5. `apps/web/src/pages/settings/_component/NotificationChannelsSection.tsx` — add `"telegram"` to `CHANNEL_TYPES`, add a `case` in `emptyConfig`, add a `case` in `ConfigFields`.

No DB migration or worker change is needed — the model's `config` is `Json`, and the worker just iterates channels.

---

## Task 1: Prisma schema — NotificationChannel model

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Add the following block to `apps/api/prisma/schema.prisma` after the `PushToken` model (search for `@@map("push_tokens")`):

```prisma
model NotificationChannel {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   @db.VarChar(20)
  label     String   @db.VarChar(100)
  config    Json
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "ix_notification_channels_user_id")
  @@map("notification_channels")
}
```

Add to the `User` model's relations block (after `pushTokens PushToken[]`):

```prisma
  notificationChannels   NotificationChannel[]
```

Note: `type` is a `VarChar(20)` string (not an enum) so new providers can be added without a migration.

- [ ] **Step 2: Create and apply the migration**

Run from the repo root:

```bash
make migrate-dev
# When prompted for a migration name, enter: add_notification_channels
```

Expected output contains: `Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(notifications): add NotificationChannel model"
```

---

## Task 2: Shared types

**Files:**

- Create: `apps/shared/src/types/notificationChannel.ts`
- Modify: `apps/shared/src/index.ts`

- [ ] **Step 1: Create the types file**

Create `apps/shared/src/types/notificationChannel.ts`:

```typescript
// Provider key. Add new members when implementing a new provider.
export type NotificationChannelType = "ntfy";

export interface NtfyChannelConfig {
  url: string;
  topic: string;
  token?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
}

// Discriminated union of all supported provider configs. When adding a new
// provider, add its *ChannelConfig interface to this union.
export type NotificationChannelConfig = NtfyChannelConfig;

export interface NotificationChannel {
  id: number;
  type: NotificationChannelType;
  label: string;
  config: NotificationChannelConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelsResponse {
  channels: NotificationChannel[];
}
```

- [ ] **Step 2: Re-export from shared index**

In `apps/shared/src/index.ts`, add alongside the other type exports:

```typescript
export type {
  NotificationChannelType,
  NtfyChannelConfig,
  NotificationChannelConfig,
  NotificationChannel,
  NotificationChannelsResponse,
} from "./types/notificationChannel";
```

- [ ] **Step 3: Commit**

```bash
git add apps/shared/src/types/notificationChannel.ts apps/shared/src/index.ts
git commit -m "feat(notifications): add NotificationChannel shared types"
```

---

## Task 3: Channel dispatcher functions + tests

**Files:**

- Create: `apps/api/src/utils/notifications/channelDispatchers.test.ts`
- Create: `apps/api/src/utils/notifications/channelDispatchers.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/utils/notifications/channelDispatchers.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { dispatchNtfy, dispatchToChannel } from "./channelDispatchers";
import type { NtfyChannelConfig, NotificationChannel } from "@hously/shared";

const payload = {
  title: "Test Title",
  body: "Test body",
  url: "https://example.com",
};

const mockFetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
);

// @ts-ignore
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockClear());

describe("dispatchNtfy", () => {
  const config: NtfyChannelConfig = {
    url: "https://ntfy.example.com",
    topic: "hously",
  };

  it("POSTs to {url}/{topic} with Title, Priority, and Click headers", async () => {
    await dispatchNtfy(config, payload);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ntfy.example.com/hously");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("Test body");
    const headers = init.headers as Record<string, string>;
    expect(headers["Title"]).toBe("Test Title");
    expect(headers["Priority"]).toBe("3");
    expect(headers["Click"]).toBe("https://example.com");
  });

  it("adds Authorization header when token is set", async () => {
    await dispatchNtfy({ ...config, token: "mytoken" }, payload);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer mytoken",
    );
  });

  it("respects custom priority", async () => {
    await dispatchNtfy({ ...config, priority: 5 }, payload);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Priority"]).toBe("5");
  });

  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Bad Request", { status: 400 }),
    );
    await expect(dispatchNtfy(config, payload)).rejects.toThrow("ntfy 400");
  });
});

describe("dispatchToChannel", () => {
  it("routes to ntfy dispatcher based on channel type", async () => {
    const channel: NotificationChannel = {
      id: 1,
      type: "ntfy",
      label: "My Phone",
      config: { url: "https://ntfy.example.com", topic: "hously" },
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dispatchToChannel(channel, payload);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ntfy.example.com/hously");
  });

  it("throws on unknown channel type", async () => {
    const channel = {
      id: 1,
      type: "unknown",
      label: "Bad",
      config: {},
      enabled: true,
      created_at: "",
      updated_at: "",
    } as unknown as NotificationChannel;
    await expect(dispatchToChannel(channel, payload)).rejects.toThrow(
      "Unknown notification channel type: unknown",
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && bun test src/utils/notifications/channelDispatchers.test.ts
```

Expected: FAIL — `Cannot find module './channelDispatchers'`

- [ ] **Step 3: Implement the dispatchers**

Create `apps/api/src/utils/notifications/channelDispatchers.ts`:

```typescript
import type {
  NotificationChannel,
  NotificationChannelType,
  NtfyChannelConfig,
} from "@hously/shared";

export interface DispatchPayload {
  title: string;
  body: string;
  url?: string;
}

export async function dispatchNtfy(
  config: NtfyChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const headers: Record<string, string> = {
    Title: title,
    Priority: String(config.priority ?? 3),
    "Content-Type": "text/plain",
  };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (url) headers["Click"] = url;

  const res = await fetch(`${config.url}/${config.topic}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${await res.text()}`);
}

// Orchestrator: routes a channel to its provider-specific dispatcher.
// To add a new provider: add a `case` here that calls the new dispatcher.
// The `never` assignment in the default branch makes TypeScript complain
// when a new NotificationChannelType member is added without a case.
export async function dispatchToChannel(
  channel: NotificationChannel,
  payload: DispatchPayload,
): Promise<void> {
  const type: NotificationChannelType = channel.type;
  switch (type) {
    case "ntfy":
      return dispatchNtfy(channel.config as NtfyChannelConfig, payload);
    default: {
      const _exhaustive: never = type;
      throw new Error(
        `Unknown notification channel type: ${(_exhaustive as string) ?? channel.type}`,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/api && bun test src/utils/notifications/channelDispatchers.test.ts
```

Expected: 6 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/notifications/
git commit -m "feat(notifications): add channel dispatcher functions with tests"
```

---

## Task 4: API routes — channel CRUD + test-send

**Files:**

- Create: `apps/api/src/routes/notifications/channels.ts`
- Modify: `apps/api/src/routes/notifications/index.ts`

- [ ] **Step 1: Create the channels route**

Create `apps/api/src/routes/notifications/channels.ts`:

```typescript
import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { dispatchToChannel } from "@hously/api/utils/notifications/channelDispatchers";
import type { NotificationChannel } from "@hously/shared";

// Add new provider keys here when implementing them.
const VALID_TYPES = ["ntfy"] as const;

function mapChannel(row: {
  id: number;
  type: string;
  label: string;
  config: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NotificationChannel {
  return {
    id: row.id,
    type: row.type as NotificationChannel["type"],
    label: row.label,
    config: row.config as NotificationChannel["config"],
    enabled: row.enabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const notificationChannelsRoutes = new Elysia({ prefix: "/channels" })
  .use(auth)
  .use(requireUser)

  // GET /api/notifications/channels
  .get("/", async ({ user, set }) => {
    try {
      const channels = await prisma.notificationChannel.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: "asc" },
      });
      return { channels: channels.map(mapChannel) };
    } catch {
      return serverError(set, "Failed to fetch notification channels");
    }
  })

  // POST /api/notifications/channels
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])) {
        return badRequest(
          set,
          `type must be one of: ${VALID_TYPES.join(", ")}`,
        );
      }
      try {
        const channel = await prisma.notificationChannel.create({
          data: {
            userId: user!.id,
            type: body.type,
            label: body.label,
            config: body.config as object,
            enabled: true,
          },
        });
        return { channel: mapChannel(channel) };
      } catch {
        return serverError(set, "Failed to create notification channel");
      }
    },
    {
      body: t.Object({
        type: t.String(),
        label: t.String({ maxLength: 100 }),
        config: t.Any(),
      }),
    },
  )

  // PATCH /api/notifications/channels/:id
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const existing = await prisma.notificationChannel.findFirst({
          where: { id, userId: user!.id },
        });
        if (!existing) return notFound(set, "Channel not found");

        const channel = await prisma.notificationChannel.update({
          where: { id },
          data: {
            ...(body.label !== undefined ? { label: body.label } : {}),
            ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
            ...(body.config !== undefined
              ? { config: body.config as object }
              : {}),
          },
        });
        return { channel: mapChannel(channel) };
      } catch {
        return serverError(set, "Failed to update notification channel");
      }
    },
    {
      body: t.Object({
        label: t.Optional(t.String({ maxLength: 100 })),
        enabled: t.Optional(t.Boolean()),
        config: t.Optional(t.Any()),
      }),
    },
  )

  // DELETE /api/notifications/channels/:id
  .delete("/:id", async ({ user, params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const existing = await prisma.notificationChannel.findFirst({
        where: { id, userId: user!.id },
      });
      if (!existing) return notFound(set, "Channel not found");
      await prisma.notificationChannel.delete({ where: { id } });
      return { success: true };
    } catch {
      return serverError(set, "Failed to delete notification channel");
    }
  })

  // POST /api/notifications/channels/:id/test
  .post("/:id/test", async ({ user, params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const channel = await prisma.notificationChannel.findFirst({
        where: { id, userId: user!.id },
      });
      if (!channel) return notFound(set, "Channel not found");

      await dispatchToChannel(mapChannel(channel), {
        title: "Hously test notification",
        body: "If you see this, your notification channel is working.",
      });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dispatch failed";
      return badRequest(set, msg);
    }
  });
```

- [ ] **Step 2: Mount the channels route in the notifications index**

In `apps/api/src/routes/notifications/index.ts`, add this import at the top with the other imports:

```typescript
import { notificationChannelsRoutes } from "./channels";
```

At the end of the `notificationsRoutes` Elysia chain (before the final semicolon), add:

```typescript
  .use(notificationChannelsRoutes)
```

- [ ] **Step 3: Verify the API compiles**

```bash
cd apps/api && bun run typecheck
```

Expected: exit code 0

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/notifications/channels.ts \
        apps/api/src/routes/notifications/index.ts
git commit -m "feat(notifications): add channel CRUD and test-send API routes"
```

---

## Task 5: Wire channels into notificationWorker

**Files:**

- Modify: `apps/api/src/services/jobs/notificationWorker.ts`

- [ ] **Step 1: Add the import**

In `apps/api/src/services/jobs/notificationWorker.ts`, add these two imports alongside the existing ones at the top:

```typescript
import { dispatchToChannel } from "@hously/api/utils/notifications/channelDispatchers";
import type { NotificationChannel } from "@hously/shared";
```

- [ ] **Step 2: Add the channel dispatch loop**

In `processRegularNotificationJob`, find the closing `}` of the `if (pushTokens.length > 0)` block. Directly after it, add:

```typescript
// Dispatch to user-configured channels (provider-agnostic — routed by dispatchToChannel)
const channels = await prisma.notificationChannel.findMany({
  where: { userId, enabled: true },
});
for (const channel of channels) {
  try {
    await dispatchToChannel(
      {
        id: channel.id,
        type: channel.type as NotificationChannel["type"],
        label: channel.label,
        config: channel.config as NotificationChannel["config"],
        enabled: channel.enabled,
        created_at: channel.createdAt.toISOString(),
        updated_at: channel.updatedAt.toISOString(),
      },
      { title, body, url },
    );
  } catch (err) {
    console.error(
      `[NotificationWorker] Channel ${channel.id} (${channel.type}) failed:`,
      err,
    );
  }
}
```

- [ ] **Step 3: Run the full test suite**

```bash
make test
```

Expected: all tests pass (original count + 6 new dispatcher tests, 0 fail)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/jobs/notificationWorker.ts
git commit -m "feat(notifications): dispatch to user channels in notification worker"
```

---

## Task 6: Frontend endpoints, query keys, and hooks

**Files:**

- Modify: `apps/web/src/lib/endpoints/notifications.ts`
- Modify: `apps/web/src/lib/queryKeys.ts`
- Create: `apps/web/src/lib/notifications/useNotificationChannels.ts`

- [ ] **Step 1: Add endpoint constants**

In `apps/web/src/lib/endpoints/notifications.ts`, add to the `NOTIFICATION_ENDPOINTS` object:

```typescript
  CHANNELS: "/api/notifications/channels",
  CHANNEL: (id: number) => `/api/notifications/channels/${id}`,
  CHANNEL_TEST: (id: number) => `/api/notifications/channels/${id}/test`,
```

- [ ] **Step 2: Add the query key**

In `apps/web/src/lib/queryKeys.ts`, find the `notifications` section and add inside it:

```typescript
    channels: () => [...queryKeys.notifications.all, "channels"] as const,
```

- [ ] **Step 3: Create the hooks file**

Create `apps/web/src/lib/notifications/useNotificationChannels.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { NOTIFICATION_ENDPOINTS } from "@/lib/endpoints";
import type {
  NotificationChannel,
  NotificationChannelsResponse,
  NotificationChannelType,
  NotificationChannelConfig,
} from "@hously/shared";

export function useNotificationChannels() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.notifications.channels(),
    queryFn: () =>
      fetcher<NotificationChannelsResponse>(NOTIFICATION_ENDPOINTS.CHANNELS),
  });
}

export function useCreateNotificationChannel() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: NotificationChannelType;
      label: string;
      config: NotificationChannelConfig;
    }) =>
      fetcher<{ channel: NotificationChannel }>(
        NOTIFICATION_ENDPOINTS.CHANNELS,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels(),
      });
    },
  });
}

export function useUpdateNotificationChannel() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      label?: string;
      enabled?: boolean;
      config?: NotificationChannelConfig;
    }) =>
      fetcher<{ channel: NotificationChannel }>(
        NOTIFICATION_ENDPOINTS.CHANNEL(id),
        { method: "PATCH", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels(),
      });
    },
  });
}

export function useDeleteNotificationChannel() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<{ success: boolean }>(NOTIFICATION_ENDPOINTS.CHANNEL(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels(),
      });
    },
  });
}

export function useTestNotificationChannel() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<{ success: boolean }>(NOTIFICATION_ENDPOINTS.CHANNEL_TEST(id), {
        method: "POST",
      }),
  });
}
```

- [ ] **Step 4: Verify types compile**

```bash
make typecheck
```

Expected: all workspaces exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/endpoints/notifications.ts \
        apps/web/src/lib/queryKeys.ts \
        apps/web/src/lib/notifications/useNotificationChannels.ts
git commit -m "feat(notifications): add channel hooks and query keys"
```

---

## Task 7: Settings UI — NotificationChannelsSection

**Files:**

- Create: `apps/web/src/pages/settings/_component/NotificationChannelsSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/NotificationsTab.tsx`

- [ ] **Step 1: Create the section component**

Create `apps/web/src/pages/settings/_component/NotificationChannelsSection.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Send, Plus, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotificationChannels,
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useUpdateNotificationChannel,
  useTestNotificationChannel,
} from "@/lib/notifications/useNotificationChannels";
import type {
  NotificationChannelType,
  NotificationChannelConfig,
  NtfyChannelConfig,
} from "@hously/shared";

// Add new providers here to expose them in the type selector.
const CHANNEL_TYPES: { value: NotificationChannelType; label: string }[] = [
  { value: "ntfy", label: "ntfy" },
];

// Returns an empty config shape for a given provider. Add a `case` when
// introducing a new provider.
function emptyConfig(type: NotificationChannelType): NotificationChannelConfig {
  switch (type) {
    case "ntfy":
      return { url: "", topic: "", token: "", priority: 3 };
    default: {
      const _exhaustive: never = type;
      throw new Error(`emptyConfig: unsupported type ${_exhaustive}`);
    }
  }
}

// Renders the provider-specific config form. Add a `case` when introducing
// a new provider.
function ConfigFields({
  type,
  config,
  onChange,
}: {
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  onChange: (c: NotificationChannelConfig) => void;
}) {
  const patch = (k: string, v: string | number) =>
    onChange({ ...config, [k]: v } as NotificationChannelConfig);

  switch (type) {
    case "ntfy": {
      const c = config as NtfyChannelConfig;
      return (
        <div className="space-y-2">
          <div>
            <Label>Server URL</Label>
            <Input
              value={c.url}
              onChange={(e) => patch("url", e.target.value)}
              placeholder="https://ntfy.sh"
            />
          </div>
          <div>
            <Label>Topic</Label>
            <Input
              value={c.topic}
              onChange={(e) => patch("topic", e.target.value)}
              placeholder="my-hously-alerts"
            />
          </div>
          <div>
            <Label>Access token (optional)</Label>
            <Input
              value={c.token ?? ""}
              onChange={(e) => patch("token", e.target.value)}
              placeholder="Bearer token for private topics"
            />
          </div>
        </div>
      );
    }
    default: {
      const _exhaustive: never = type;
      return null;
    }
  }
}

export function NotificationChannelsSection() {
  const { data, isLoading } = useNotificationChannels();
  const createMutation = useCreateNotificationChannel();
  const deleteMutation = useDeleteNotificationChannel();
  const updateMutation = useUpdateNotificationChannel();
  const testMutation = useTestNotificationChannel();

  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<NotificationChannelType>("ntfy");
  const [newLabel, setNewLabel] = useState("");
  const [newConfig, setNewConfig] = useState<NotificationChannelConfig>(
    emptyConfig("ntfy"),
  );

  const channels = data?.channels ?? [];

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    try {
      await createMutation.mutateAsync({
        type: newType,
        label: newLabel,
        config: newConfig,
      });
      toast.success("Channel added");
      setAdding(false);
      setNewLabel("");
      setNewType("ntfy");
      setNewConfig(emptyConfig("ntfy"));
    } catch {
      toast.error("Failed to add channel");
    }
  };

  const handleTest = async (id: number) => {
    try {
      await testMutation.mutateAsync(id);
      toast.success("Test notification sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Channel removed");
    } catch {
      toast.error("Failed to remove channel");
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, enabled });
    } catch {
      toast.error("Failed to update channel");
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Notification Channels
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
            Deliver notifications to external services. Currently supports ntfy.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? (
            <ChevronUp className="w-4 h-4 mr-1" />
          ) : (
            <Plus className="w-4 h-4 mr-1" />
          )}
          Add
        </Button>
      </div>

      {adding && (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={newType}
                onValueChange={(v) => {
                  const t = v as NotificationChannelType;
                  setNewType(t);
                  setNewConfig(emptyConfig(t));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="My Phone"
              />
            </div>
          </div>
          <ConfigFields
            type={newType}
            config={newConfig}
            onChange={setNewConfig}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add Channel"}
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-neutral-500">Loading channels...</p>
      )}

      {!isLoading && channels.length === 0 && !adding && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No channels configured.
        </p>
      )}

      <div className="space-y-2">
        {channels.map((ch) => (
          <div
            key={ch.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={ch.enabled}
                onCheckedChange={(v) => handleToggle(ch.id, v)}
              />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {ch.label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {ch.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Send test notification"
                disabled={testMutation.isPending}
                onClick={() => handleTest(ch.id)}
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Remove channel"
                disabled={deleteMutation.isPending}
                onClick={() => handleDelete(ch.id)}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the section to NotificationsTab**

In `apps/web/src/pages/settings/_component/NotificationsTab.tsx`, add this import at the top with the other imports:

```typescript
import { NotificationChannelsSection } from "@/pages/settings/_component/NotificationChannelsSection";
```

Find the end of the JSX returned by `NotificationsTab` — just before the last closing `</div>` — and append:

```tsx
<NotificationChannelsSection />
```

- [ ] **Step 3: Full typecheck and test suite**

```bash
make typecheck && make test
```

Expected: all workspaces pass typecheck, all tests pass (0 fail)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/settings/_component/NotificationChannelsSection.tsx \
        apps/web/src/pages/settings/_component/NotificationsTab.tsx
git commit -m "feat(notifications): add notification channels settings UI"
```
