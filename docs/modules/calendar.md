# Calendar

Shared multi-user calendar with custom events, holiday subscriptions, iCal feed export, and day-of notifications.

Last verified: 2026-05-25

## Locations

| Layer  | Path                                                     |
| ------ | -------------------------------------------------------- |
| Web    | `apps/web/src/pages/calendar/`                           |
| API    | `apps/api/src/routes/calendar/` (`events`, `countries`, `ical`) |
| Schema | `CustomEvent`, plus virtual holiday/release events       |
| Worker | `apps/api/src/workers/checkAllDayEvents.ts`              |
| Service| `apps/api/src/services/holidayCalendar.ts`               |

## API Surface

`apps/api/src/routes/calendar/index.ts` composes:

- `events.ts` — `GET /api/calendar/events?from=&to=`, `POST /api/calendar/events`, `PATCH /api/calendar/events/:id`, `DELETE /api/calendar/events/:id`. Returns a merged stream of `CustomEvent` rows + holidays from the configured country + library release dates within range.
- `countries.ts` — country/subdivision picker for `AppSettings.countryCode` / `calendarSubdivisionCode`. Holidays come from a static dataset in `holidayCalendar.ts`.
- `ical.ts` — `GET /api/calendar/ical/:token` returns an iCal feed. The token is `User.calendarToken` (unique random opaque token), so users can subscribe in Apple Calendar / Google Calendar without exposing credentials.

## Holidays

`apps/api/src/services/holidayCalendar.ts` resolves holidays by country code (e.g. `US`, `CA`) and optional subdivision (e.g. `CA-QC`). Configured per-instance via `AppSettings`, not per-user.

Why instance-wide: most homelab deployments are family-scale and a single household has one set of statutory holidays.

## Custom Events

`CustomEvent` carries `startDatetime`, `endDatetime`, `allDay`, plus optional recurrence (`recurrenceType`, `recurrenceIntervalDays`, `recurrenceOriginalCreatedAt`). Events are scoped to `userId` — currently each user sees only their own custom events plus instance-wide holidays/releases.

## All-Day Event Notifications

The `check-all-day-events` cron (daily at 20:00 — see `queueService.ts`) scans tomorrow's all-day events and pushes a day-before reminder. The `checkAllDayEvents` worker handles both `CustomEvent` and (where opted-in) calendar-visible chores.

## Web Hooks

`apps/web/src/pages/calendar/useCalendar.ts` is the main read hook; mutation hooks live in `_hooks/`. The calendar page lazy-loads its grid components via `_component/`.
