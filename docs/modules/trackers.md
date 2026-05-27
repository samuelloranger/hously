# Trackers (Private Tracker Stats)

Stats scrapers for private torrent trackers: C411, Torr9, La Cale, YggReborn. Surfaces upload/download ratios, bonus points, and seeding counts to the dashboard.

Last verified: 2026-05-25

## Locations

| Layer        | Path                                                          |
| ------------ | ------------------------------------------------------------- |
| Web (dashboard) | `apps/web/src/features/` tracker widgets + dashboard hooks |
| API routes   | `apps/api/src/routes/integrations/trackers/`, `apps/api/src/routes/dashboard/trackers/` |
| Services     | `apps/api/src/services/trackers/` (`c411`, `torr9`, `g3mini`, `http*`, `parseUtils`, `labels`) |
| Health check | `apps/api/src/services/trackerHealth.ts`                      |
| Workers      | `apps/api/src/workers/fetchTrackerStats.ts`                   |

## How It Works

Each tracker is a separate scraper module (`apps/api/src/services/trackers/c411.ts`, `torr9.ts`, etc.) that logs in with stored credentials and parses HTML stats pages. Shared HTTP helpers and parsing utilities live next to them (`httpScraper.ts`, `parseUtils.ts`, plus per-tracker `httpC411.ts`, `httpTorr9.ts`, etc.).

## Crons (Staggered)

Trackers are scraped hourly, staggered by 5 min to spread load. From `apps/api/src/services/queueService.ts`:

| Job                          | Pattern        |
| ---------------------------- | -------------- |
| `FETCH_C411_STATS`           | `0 * * * *`    |
| `FETCH_TORR9_STATS`          | `5 * * * *`    |
| `FETCH_LA_CALE_STATS`        | `10 * * * *`   |
| `FETCH_YGG_REBORN_STATS`     | `15 * * * *`   |

Why staggered: hitting four private trackers in the same minute can trip rate limits or look bot-like; offsetting the schedule keeps each scraper's request rate independent.

## Health Detection

`apps/api/src/services/trackerHealth.ts` (tested at `trackerHealth.test.ts`) classifies scrape failures into actionable states (e.g. `auth_expired`, `unreachable`, `parse_error`, `cloudflare_challenge`). The dashboard tracker card surfaces these states so the user knows whether to re-login vs. wait it out.

## Web Hooks

`apps/web/src/pages/settings/_trackerIntegration.ts` plus per-tracker hooks like `useC411Integration`, `useTorr9Integration`, `useLaCaleIntegration`, `useYggRebornIntegration`. Dashboard widgets read via `useDashboardC411Stats`, `useDashboardTorr9Stats`, etc.

Recent UI: tracker cards were redesigned in commit `a56f3ee9 feat(dashboard): redesign tracker cards`.
