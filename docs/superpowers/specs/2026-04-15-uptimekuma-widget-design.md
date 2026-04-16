# UptimeKuma plugin + homepage widget — design

Status: ready for implementation planning
Date: 2026-04-15

## Goal

Add a compact UptimeKuma panel to the Hously homepage that summarises monitor
health. It shows `X / Y up` when everything is healthy and highlights down /
pending monitors in red / yellow when something is wrong. A "View all monitors"
action opens a modal listing every monitor grouped by status.

When Hously receives an UptimeKuma webhook (`MonitorUp` / `MonitorDown`), the
backend-cached monitor snapshot is invalidated so the next frontend fetch
returns fresh data from UptimeKuma.

## Non-goals

- No SSE / WebSocket push to the browser. The existing
  refetch-on-focus + 60 s polling behaviour of TanStack Query is sufficient
  given that Redis is invalidated by the webhook.
- No historical uptime ratio, response-time graphs, or certificate-expiry data.
  Only _current status_ is surfaced. These can be added later.
- No configuration of monitors from Hously. UptimeKuma remains the source of
  truth.

## Data source

UptimeKuma's Prometheus endpoint `GET ${baseUrl}/metrics`, authenticated with
HTTP Basic (empty username, API key as password). Verified against the user's
production UptimeKuma — returns a `monitor_status` gauge per monitor with the
labels we need:

```
monitor_status{monitor_id="21",monitor_name="Hously",monitor_type="http",monitor_url="http://hously:3000",monitor_hostname="null",monitor_port="null"} 1
```

Status values: `0 = DOWN`, `1 = UP`, `2 = PENDING`, `3 = MAINTENANCE`.

## Backend

### Plugin config

New plugin type `uptimekuma` stored in the existing `plugin` table, mirroring
`adguard`:

```json
{
  "website_url": "https://uptime.samlo.cloud",
  "api_key": "<encrypt()-ed string>"
}
```

- `apps/api/src/utils/plugins/normalizers.ts` — add
  `normalizeUptimekumaConfig()` returning `{ website_url, api_key } | null` and
  decrypting `api_key` when read.

### Routes — `apps/api/src/routes/plugins/uptimekuma/index.ts`

Registered in `apps/api/src/routes/plugins/index.ts` alongside the other
plugin routes.

| Method | Path                               | Auth  | Purpose                                                    |
| ------ | ---------------------------------- | ----- | ---------------------------------------------------------- |
| GET    | `/api/plugins/uptimekuma`          | admin | Return `{ type, enabled, website_url, api_key_set }`       |
| PUT    | `/api/plugins/uptimekuma`          | admin | Save config; `api_key` is encrypted; logs `plugin_updated` |
| GET    | `/api/plugins/uptimekuma/monitors` | user  | Return current monitor snapshot (cached)                   |

The config endpoints follow the exact shape of `adguard` (validation via
`normalizeUrl` + `isValidHttpUrl`; keeps existing encrypted key if the request
omits `api_key`; calls `invalidatePluginConfigCache("uptimekuma")` on save).

### `GET /monitors` response

```ts
type UptimekumaMonitorStatus = "up" | "down" | "pending" | "maintenance";

type UptimekumaMonitor = {
  id: string;
  name: string;
  status: UptimekumaMonitorStatus;
  type: string; // "http" | "docker" | ...
  url: string | null; // empty/placeholder strings normalised to null
};

type UptimekumaMonitorsResponse = {
  summary: {
    total: number;
    up: number;
    down: number;
    pending: number;
    maintenance: number;
  };
  monitors: UptimekumaMonitor[];
  fetched_at: string; // ISO timestamp of when the snapshot was fetched
};
```

### Caching and webhook invalidation

- Redis key: `plugin:uptimekuma:monitors`. Value: JSON-stringified
  `UptimekumaMonitorsResponse`. TTL: **60 s**.
- On cache miss: fetch `/metrics`, parse `monitor_status` lines into the
  response shape, cache, return.
- On cache hit: return cached JSON.
- On UptimeKuma fetch error: return `badGateway` with a clear message; do not
  cache error states.

**Webhook invalidation** — in `apps/api/src/routes/webhooks/index.ts`, after
the handler result is computed but before the notification fan-out returns,
add:

```ts
if (
  serviceName.toLowerCase() === "uptimekuma" &&
  (eventType === "MonitorUp" || eventType === "MonitorDown")
) {
  await redis.del("plugin:uptimekuma:monitors");
}
```

This keeps the pure handler (`handleUptimekumaWebhook`) free of side effects
and contains the Redis dependency at the route boundary, consistent with how
other side effects (notification logging, template rendering) are layered
there.

### Metrics parser

Small module `apps/api/src/utils/plugins/uptimekuma.ts` with a pure function
`parseMonitorStatus(metricsText: string): UptimekumaMonitor[]` and a
`summariseMonitors(monitors): Summary` helper. Covered by a unit test file
`apps/api/src/__tests__/uptimekumaMetrics.test.ts` asserting:

- Parses `monitor_status{...} N` lines ignoring comments and other metrics.
- Maps status codes to the four string statuses; unknown codes → `pending`.
- Normalises placeholder URLs like `https://` or `null` to `null`.
- Returns empty array cleanly when no monitors exist.

## Shared package

- `apps/shared/src/types/uptimekuma.ts` — types listed above; exported from
  `apps/shared/src/index.ts`.
- `apps/shared/src/endpoints/uptimekuma.ts`:
  ```ts
  export const UPTIMEKUMA_ENDPOINTS = {
    CONFIG: "/api/plugins/uptimekuma",
    MONITORS: "/api/plugins/uptimekuma/monitors",
  } as const;
  ```
- `apps/shared/src/queryKeys.ts` — add:
  ```ts
  uptimekuma: {
    all: ["uptimekuma"] as const,
    monitors: () => [...queryKeys.uptimekuma.all, "monitors"] as const,
    config:   () => [...queryKeys.uptimekuma.all, "config"]   as const,
  },
  ```

## Frontend

### Hook — `apps/web/src/hooks/uptimekuma/useUptimekumaMonitors.ts`

```ts
export function useUptimekumaMonitors() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.uptimekuma.monitors(),
    queryFn: () =>
      fetcher<UptimekumaMonitorsResponse>(UPTIMEKUMA_ENDPOINTS.MONITORS),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
```

The admin-only config page uses a separate `useUptimekumaConfig` /
`useUpdateUptimekumaConfig` hook pair in the same folder; both live in the web
app (not shared) because no other app needs them.

### `UptimeKumaPanel` — `apps/web/src/pages/_component/UptimeKumaPanel.tsx`

Compact card matching `WeatherPanel` / `SystemPanel` visual weight. Shown on
the homepage right column between `SystemPanel` and `DownloadsPanel`.

Render rules:

1. **Unconfigured / disabled plugin** → panel renders nothing (returns `null`).
   Consistent with how other plugin panels hide themselves when disabled.
2. **Loading** → skeleton matching the panel height.
3. **Error** → compact error state with retry affordance (`CardErrorBoundary`
   wraps the panel on the homepage already, but we still handle query error
   inline for graceful UX).
4. **All healthy** → headline row only: green dot + `N / N up` +
   "View all monitors" button.
5. **Any unhealthy** → headline `N / M up` with red dot (or yellow if only
   pending), then inline rows for each **down / pending** monitor (status dot
   - name). Cap at 5 visible inline; if more, show `+K more` affordance that
     opens the modal.

Icons: `lucide-react` (`Activity` for header, `CircleDot` or a small coloured
dot for status).

### `UptimeKumaMonitorsModal` — `apps/web/src/pages/_component/UptimeKumaMonitorsModal.tsx`

Triggered by the "View all monitors" button. Uses the same
`useUptimekumaMonitors` query (no extra fetch). Layout:

- Three sections in order: **Down** (red), **Pending** (yellow),
  **Up** (green). Maintenance monitors appear as a fourth section when
  present.
- Each row: status dot, monitor name (bold), muted type + url underneath.
- Sections with zero entries are hidden.
- Footer shows `fetched_at` relative time ("Updated 12 s ago") so the user
  knows the snapshot freshness.

Uses the existing dialog primitives from `components/ui/` to stay consistent
with `WeatherForecastModal`.

### Settings — `apps/web/src/pages/settings/_component/plugins/UptimekumaPluginSection.tsx`

Mirrors `AdguardPluginSection`:

- Enabled toggle.
- `website_url` input (validated via the existing `PluginUrlInput`).
- `api_key` input (password-type; placeholder "Leave blank to keep existing
  key" when `api_key_set` is true).
- Save button.
- Inline help text linking to UptimeKuma's Settings → API Keys docs.

Wired into the plugins list in `ExternalNotificationsTab.tsx` /
`settings/index.tsx` alongside the others.

### HomePage wiring — `apps/web/src/pages/_component/HomePage.tsx`

Insert into the right column, between `SystemPanel` and `DownloadsPanel`:

```tsx
<motion.div variants={panelVariants}>
  <CardErrorBoundary>
    <UptimeKumaPanel />
  </CardErrorBoundary>
</motion.div>
```

## i18n

Add `settings.plugins.uptimekuma.*` and `dashboard.uptimekuma.*` namespaces to
both `en/common.json` and `fr/common.json`:

- `title`, `configure`, `website_url`, `api_key`, `api_key_placeholder`,
  `enabled`, `save`, `saved`, `error`, etc. for the settings section.
- `dashboard.uptimekuma.header`, `all_healthy`, `n_of_m_up`,
  `view_all_monitors`, `sections.{down,pending,up,maintenance}`, `none`,
  `updated_ago`.

## Testing

- `apps/api/src/__tests__/uptimekumaMetrics.test.ts` — parser unit tests.
- Manual verification against production UptimeKuma:
  1. Configure plugin with production URL + API key → expect panel to render
     with 19 monitors, all up.
  2. Stop one of the monitored services (e.g. a dev container) long enough for
     UptimeKuma to fire `MonitorDown` webhook → expect Hously homepage to show
     red dot + monitor name within the next refetch cycle (≤ 60 s or on focus).
  3. Restart the service → `MonitorUp` arrives → panel returns to all-healthy.

## Open risks / notes

- Prometheus text format is stable across UptimeKuma versions, but the parser
  should be defensive (skip malformed lines, don't throw on unknown label
  orders).
- The `monitor_url` label in the production export is sometimes just `https://`
  or `null`. Normalise these to `null` so the UI doesn't display meaningless
  strings.
- The Hously API container must have network access to the configured
  UptimeKuma URL. For the user's production deploy this is an external HTTPS
  host (`uptime.samlo.cloud`) and should "just work", but list this as a
  prerequisite in the docs.
- API keys are stored encrypted (`encrypt()`), same as existing plugins. The
  `api_key` is never returned from the API — only `api_key_set: boolean`.
