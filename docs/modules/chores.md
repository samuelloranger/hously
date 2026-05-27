# Chores

Household chore tracker with assignment, recurrence, completion history, and reminders.

Last verified: 2026-05-25

## Locations

| Layer  | Path                                          |
| ------ | --------------------------------------------- |
| Web    | `apps/web/src/pages/chores/`                  |
| API    | `apps/api/src/routes/chores/`                 |
| Schema | `Chore`, `Reminder`, `TaskCompletion`         |
| Worker | `apps/api/src/workers/checkReminders.ts`      |

## API Surface

`apps/api/src/routes/chores/index.ts` composes three sub-plugins under prefix `/api/chores`:

- `choreCrudRoutes` — `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, image upload, reorder.
- `choreCompletionRoutes` — `POST /:id/complete`, `POST /:id/uncomplete`, `POST /clear-completed`.
- `choreStatsRoutes` — per-user counts and recent completions for the dashboard.

All sub-plugins `.use(requireUser)` at the top.

## Recurrence

Recurrence lives on the `Chore` row itself: `recurrenceType` (`daily | weekly | every_n_days | …`), `recurrenceIntervalDays`, `recurrenceWeekday`, plus `recurrenceParentId` linking the auto-generated next occurrence back to the original. On completion, `choreCompletionRoutes` clones the chore with the next due date computed from the recurrence rule.

`recurrenceOriginalCreatedAt` preserves the original creation timestamp across re-creations, which the UI uses for "added X days ago" displays.

## Reminders

Each `Reminder` belongs to one `Chore` and one `User`. The `check-reminders` cron (every 15 min) scans `Reminder.active = true` rows, fires a push notification via `apps/api/src/workers/checkReminders.ts`, and marks `lastNotificationSent`. Deactivation happens automatically when the chore is completed (`deactivateRemindersForChore` in `choreMappers.ts`).

Why a separate `Reminder` table instead of a `reminderAt` column: a chore can have multiple future reminders (e.g. "remind me 1 day and 1 hour before"), and the cron query needs to be a flat scan over active rows.

## Web Hooks

`apps/web/src/pages/chores/` colocates hooks with the page:

- `useChores`, `useCreateChore`, `useUpdateChore`, `useDeleteChore`
- `useToggleChore`, `useClearAllCompletedChores`, `useReorderChores`
- `useRemoveRecurrence`, `useUploadChoreImage`

Query key: `queryKeys.chores.list()` (factory at `apps/web/src/lib/queryKeys.ts`). Mutations invalidate `queryKeys.chores.all`.

## Activity Logging

Each completion writes to `ActivityLog` via `logActivity()` (`apps/api/src/utils/activityLogs.ts`) and to `TaskCompletion` so the dashboard "recent activity" feed and per-user stats can both query a clean source.
