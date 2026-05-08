# Tracker Availability Notifications — Design

**Status:** Spec, pending implementation
**Date:** 2026-05-06
**Scope:** API only. No web UI changes.

## Problem

When the cron job at `apps/api/src/workers/fetchTrackerStats.ts` fails to refresh a tracker's stats, the failure is logged via `logActivity({ type: "cron_job_ended", success: false, ... })` but no human is notified. A tracker can be unreachable for hours before anyone notices that the dashboard tile is stale.

## Goal

Notify admins (Web Push + external webhook) when a tracker becomes unavailable, and again when it recovers — but only for failures that originate at the tracker itself, not at our local proxy.

## Non-goals

- UI for tracker health status (dashboard tiles, integrations page badge, etc.)
- Per-user opt-in/opt-out of these alerts
- Configurable thresholds (e.g. "alert after N consecutive failures")
- FlareSolverr availability alerts (tracked as a separate follow-up issue)

## Trigger conditions

A failed cron run fires a "down" notification only if it's classified as a tracker-side failure:

| Condition                                                                 | Class              | Alert? |
| ------------------------------------------------------------------------- | ------------------ | ------ |
| Tracker returns non-2xx HTTP status                                       | `TrackerHttpError` | yes    |
| Tracker returns 2xx but scraper can't authenticate / parse logged-in page | `TrackerAuthError` | yes    |
| FlareSolverr unreachable, 5xx, or invalid JSON                            | generic `Error`    | no     |
| Network errors (ENOTFOUND, ETIMEDOUT) before reaching tracker             | generic `Error`    | no     |
| Config invalid / missing / encryption errors                              | generic `Error`    | no     |

Rationale for excluding FlareSolverr / network: if our local proxy is broken, we don't actually know the tracker's state, so we shouldn't claim it's "down."

## State machine

State stored in Redis at key `tracker:health:<trackerType>`:

```ts
type TrackerHealthState =
  | { state: "up"; since: string /* ISO */ }
  | {
      state: "down";
      since: string;
      last_failure: {
        kind: "http" | "auth";
        status?: number; // present for http
        message: string;
      };
    };
```

No TTL — this is durable state, not cache.

| Transition                                     | Action                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| absent → up (first success ever)               | Write `{state: "up"}`. **Silent.**                        |
| absent → down (first run is alertable failure) | Write `{state: "down", ...}`. **Fire down notification.** |
| up → up                                        | No write. Silent.                                         |
| up → down (alertable)                          | Write `{state: "down", ...}`. **Fire down notification.** |
| up → down (non-alertable)                      | No write. Silent.                                         |
| down → down (alertable)                        | No write. Silent.                                         |
| down → down (non-alertable)                    | No write. Silent.                                         |
| down → up (success after outage)               | Write `{state: "up"}`. **Fire recovery notification.**    |

Manual triggers (`trigger: "manual"`) follow the same state machine — re-trying a broken tracker and seeing it work _should_ fire recovery.

If Redis is unreachable, the health module logs and returns; the cron job itself is unaffected.

## Notification content

**Recipients:** users where `User.isAdmin = true` (Prisma boolean column already exists). Web Push via the existing `createAndQueueNotification`. External webhook via `sendExternalNotification("hously", "TrackerDown" | "TrackerUp", ...)`, parity with the `AppUpdate` pattern in `versionService.ts`.

**Tracker labels** (new constant `TRACKER_LABELS` in `apps/api/src/services/trackers/index.ts` or new `labels.ts`):

```ts
{ "c411": "C411", "torr9": "Torr9", "la-cale": "La Cale" }
```

The existing `trackerName(type)` uppercaser is kept for log lines but isn't used in user-facing strings.

**HTTP status dictionary** (new constant alongside the labels):

```ts
{
  401: "Authentication required",
  403: "Access forbidden (Cloudflare challenge or IP banned)",
  404: "Tracker page not found",
  429: "Rate limited by tracker",
  500: "Tracker internal error",
  502: "Tracker bad gateway",
  503: "Tracker unavailable (maintenance)",
  504: "Tracker timeout",
}
```

Values are sentence-cased so they can be used directly as notification body text. Lookup with fallback: `STATUS_MESSAGES[status] ?? \`HTTP ${status} from tracker\``.

**Down notification payload:**

| Field       | Value                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| title       | `"Tracker {label} unavailable"` (e.g. `"Tracker La Cale unavailable"`)                                                  |
| body (http) | Looked-up message, capitalized (e.g. `"Tracker unavailable (maintenance)"`)                                             |
| body (auth) | `"Authentication or page parsing failed"` (no internal reason exposed in user-facing copy; full reason goes in payload) |
| kind        | `"tracker-down"`                                                                                                        |
| link        | none                                                                                                                    |
| payload     | `{ tracker, kind: "http"\|"auth", status?, since }`                                                                     |

**Recovery notification payload:**

| Field   | Value                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| title   | `"Tracker {label} back online"`                                                            |
| body    | `"Stats refreshed after {humanized downtime}"` (e.g. `"Stats refreshed after 12 minutes"`) |
| kind    | `"tracker-up"`                                                                             |
| link    | none                                                                                       |
| payload | `{ tracker, recovered_at, downtime_ms }`                                                   |

## File changes

**New:**

- `apps/api/src/services/trackers/errors.ts` — `TrackerHttpError`, `TrackerAuthError` classes.
- `apps/api/src/services/trackers/labels.ts` — `TRACKER_LABELS` and `STATUS_MESSAGES` dictionaries.
- `apps/api/src/services/trackerHealth.ts` — `recordSuccess(trackerType)`, `recordFailure(trackerType, error)`. Owns the state machine and notification dispatch.
- `apps/api/src/utils/admins.ts` — `getAdminUserIds()`.
- `apps/api/src/services/trackerHealth.test.ts` — state-machine tests.
- `apps/api/src/services/trackers/errors.test.ts` — error-class tests.

**Modified:**

- `apps/api/src/services/trackers/httpC411.ts` — throw `TrackerHttpError` on tracker non-2xx; throw `TrackerAuthError` on login/parse failure (replace existing generic `Error`s at those specific sites only).
- `apps/api/src/services/trackers/httpTorr9.ts` — same.
- `apps/api/src/services/trackers/httpLaCale.ts` — same (direct fetch, simpler).
- `apps/api/src/workers/fetchTrackerStats.ts` — call `trackerHealth.recordSuccess(...)` after successful scrape and before the existing `endLog(true)`; call `trackerHealth.recordFailure(trackerType, error)` inside the existing `catch`. No changes to caching or activity-log behavior.

## Architecture notes

- The scraper modules don't need to know about the state machine. They just throw richer errors. The worker calls into `trackerHealth`, which is the single place that owns Redis state and notification dispatch. This keeps the scrapers focused on HTTP/parsing and the worker focused on orchestration.
- `trackerHealth` depends on the cache module, the notification service, and the admin utility. It does not depend on Prisma directly except via that admin utility.
- The error classes live next to the scrapers so that the scrapers can throw them without circular imports between `services/trackerHealth.ts` and `services/trackers/*`.

## Testing

Unit tests with Bun's test runner, mocking the Redis cache and notification dispatch:

- `trackerHealth.recordSuccess` — absent → up (silent), up → up (silent), down → up (fires recovery, payload has correct downtime).
- `trackerHealth.recordFailure` — absent + alertable → down (fires down), up + alertable → down (fires down), down + alertable → down (silent), up + non-alertable `Error` → no state change, no fire, absent + non-alertable → no state change, no fire.
- `errors.ts` — instances carry `trackerType`, `status`/`reason` fields.

No integration tests for the scrapers themselves — too FlareSolverr-dependent. Covered by manual smoke after deploy.

## Rollout

1. Land the change behind no flag — risk is low (the worker already tolerates exceptions).
2. After deploy, manually trigger one tracker via the existing manual-trigger path while it's healthy → confirm no notification, state lands `up` in Redis.
3. Temporarily break credentials for one tracker → confirm down notification fires once.
4. Restore credentials → confirm recovery notification fires once.
5. Open follow-up issue for FlareSolverr availability alerts.
