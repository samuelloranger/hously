# Dashboard

The homepage. Composes smart tiles and widgets for system health, downloads, trackers, weather, upcoming media, activity, Jellyfin, Home Assistant, Minecraft, Docker, RSS, and quick links.

Last verified: 2026-06-11

## Locations

| Layer | Path                                                                |
| ----- | ------------------------------------------------------------------- |
| Web   | `apps/web/src/pages/index.tsx` + `apps/web/src/features/` (widgets) |
| API   | `apps/api/src/routes/dashboard/`                                    |

## API Surface

`apps/api/src/routes/dashboard/index.ts` composes per-widget sub-plugins under prefix `/api/dashboard`:

- `activities`, `weather`, `upcoming`, `jellyfin`, `trackers`, `scrutiny`, `system`, `adguard`, `docker`, `downloads`, `minecraft`, `quick-links`, `favicon`.

Each is a thin orchestrator that reads from `Integration` config + cached service responses. Most widgets return on a 30s–5min cache; SSE is used only for `downloads` (torrent speed needs sub-second refresh).

## Widget Visibility

`AppSettings.dashboardWidgetVisibility` stores per-widget visibility, while `dashboardWidgetLayout` stores the three-column order. The canonical widget catalog is `apps/shared/src/constants/widgets.ts`; removed IDs are discarded when stored layouts are reconciled.

Smart tiles use the separate catalog in `apps/shared/src/constants/tiles.ts` and persist order in `AppSettings.dashboardTileLayout`. The current tile set is latest media, active downloads, library alerts, weather, and system. The next-event tile and Ready-to-watch widget were removed in v4.0.1.

## Quick Links

`AppSettings.quickLinks` is a JSON array of user-defined shortcuts shown in the dashboard. `apps/api/src/routes/dashboard/quick-links/` serves them; `apps/api/src/routes/dashboard/favicon/` proxies third-party favicons (with caching) so the dashboard doesn't expose internal URLs to the browser.

## Activity Feed

Backed by `ActivityLog`. Filterable by `service` and `type`. Each library grab, integration test, cron run, etc. writes one row via `logActivity()` (`apps/api/src/utils/activityLogs.ts`).

## Upcoming Media Widget

The `REFRESH_UPCOMING` cron (every 12h at :30) pre-renders the upcoming-releases snapshot keyed by `AppSettings.countryCode` + `upcomingWindowMonths` + `upcomingLanguages`. The widget reads the cached snapshot rather than hitting TMDB on every page load. Worker: `apps/api/src/workers/refreshUpcoming.ts`.

## System Panel

Recently refactored (see commit `d9b8e086 refactor(dashboard): split SystemPanel into system/ subfolder`). Pulls server health from Beszel + Netdata-style metrics.

## Web Query Keys

All dashboard widgets use `queryKeys.dashboard.*` from `apps/web/src/lib/queryKeys.ts`. Mutations elsewhere (e.g. grabbing media) should invalidate the dashboard slice they affect — at minimum `queryKeys.dashboard.activities` and `queryKeys.dashboard.activityFeed`.

## Changelog

- 2026-06-11 — Updated route, widget, and tile catalogs after the v4 removals.
