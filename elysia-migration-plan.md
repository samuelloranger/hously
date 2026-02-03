# Elysia Migration Plan

This document outlines the strategy and checklist for migrating the Hously backend from Python FLask to Elysia (Bun).

## Migration Strategy

The migration will follow a strangler fig pattern to allow for incremental updates without downtime or massive "big bang" rewrites.

### Phase 1: Preparation & Setup
1.  **Environment Setup**: Ensure `apps/server` (Elysia) is fully configured with Database access (Drizzle) matching the current schema.
2.  **Shared Resources**: Identify shared assets (images, static files) and how they will be accessed.
3.  **Proxy/Gateway (Optional)**: Decide if a reverse proxy is needed, or if the Frontend will handle the routing logic (pointing to different ports/URLs). *Plan assumes Frontend logic update.*

### Phase 2: Legacy API Versioning (The "/v1" Step)
To enable a clean separation, we will enable the Python API to serve under a specific version prefix, while identifying it as "legacy".
1.  **Prefix Python Routes**: Update the Flask application to serve all existing blueprints under `/api/v2`.
2.  **Update Frontend**: specific environment variables or API clients in the Frontend to point to the new `/v1` Python endpoints.
    -   *Goal*: Frontend continues to work 100% on Python backend, but requests now go to `http://localhost:5000/api/v1/...` (or similar).
3.  **Elysia Claim**: Elysia will eventually take over the clean root identifiers or a new `/api/v2` prefix.

### Phase 3: Incremental Feature Migration
For each feature (e.g., "Recipes"):
1.  **Model Migration**: Port the SQLAlchemy model to Drizzle ORM in `apps/server`.
2.  **Endpoint Implementation**: Re-implement the endpoints in Elysia in `apps/server/src/routes/...`.
3.  **Verification**: Test the new endpoints using the same inputs as the Python version.
4.  **Frontend Switch**: Update the Frontend API client for that specific feature to point to the Elysia backend URL.
5.  **Deprecation**: Mark the Python endpoint as deprecated.

### Phase 4: Cleanup
1.  **Remove Python Code**: Once a feature is 100% migrated and stable, remove the corresponding Python route and service code.
2.  **Decommission**: eventually shut down the Python service entirely.

---

## Migration Checklist

### Core Infrastructure
- [x] **Database Setup**
    - [x] Configure Drizzle to match existing Postgres schema
    - [x] Ensure migrations are compatible or managed
- [x] **Authentication**
    - [x] Port `auth` Login/Signup logic (Login done)
    - [x] Port JWT handling (ensure tokens are compatible or implement new issuer)
    - [x] Port Rate Limiting logic
- [x] **Legacy API Versioning**
    - [x] Move Python `api_bp` prefix to include `/v1`
    - [x] Update Frontend base URL for legacy requests

### Feature Migration Status

#### 1. Authentication (`routes/auth.py`)
- [x] POST /auth/login
- [x] POST /auth/signup
- [x] POST /auth/logout
- [ ] POST /auth/refresh (not needed - using JWT with cookie)
- [x] POST /auth/forgot-password
- [x] POST /auth/reset-password

#### 2. Users (`routes/users.py`)
- [x] GET /users/me
- [x] PUT /users/me
- [x] POST /users/me/password
- [x] POST /users/me/avatar

#### 3. Dashboard (`routes/dashboard.py`)
- [x] GET /dashboard/stats
- [x] GET /dashboard/activities

#### 4. Calendar (`routes/calendar.py`)
- [x] GET /calendar (aggregates chores, reminders, custom events)

#### 5. Chores (`routes/chores.py`)
- [x] GET /chores
- [x] POST /chores
- [x] PUT /chores/:id
- [x] DELETE /chores/:id
- [x] POST /chores/:id/toggle
- [x] PUT /chores/:id/remove-recurrence
- [x] POST /chores/clear-completed
- [x] POST /chores/upload-image
- [x] GET /chores/image/:filename
- [x] GET /chores/thumbnail/:filename
- [x] POST /chores/reorder

#### 6. Shopping Lists (`routes/shopping.py`)
- [x] GET /shopping
- [x] POST /shopping
- [x] PUT /shopping/:id
- [x] DELETE /shopping/:id
- [x] POST /shopping/:id/toggle
- [x] POST /shopping/clear-completed
- [x] POST /shopping/delete-bulk
- [x] POST /shopping/reorder

#### 7. Meal Plans (`routes/meal_plans.py`)
- [x] GET /meal-plans
- [x] POST /meal-plans
- [x] PUT /meal-plans/:id
- [x] DELETE /meal-plans/:id
- [x] POST /meal-plans/:id/add-to-shopping

#### 8. Recipes (`routes/recipes.py`)
- [x] GET /recipes
- [x] POST /recipes
- [x] PUT /recipes/:id
- [x] DELETE /recipes/:id
- [x] GET /recipes/:id
- [x] POST /recipes/:id/toggle-favorite
- [x] POST /recipes/upload-image
- [x] GET /recipes/image/:filename

#### 9. Reminders (`routes/reminders.py`)
- [x] POST /reminders
- [x] GET /reminders/chore/:choreId
- [x] DELETE /reminders/:id

#### 10. Notifications (`routes/notifications.py`, `external_notifications.py`)
- [x] GET /notifications
- [x] GET /notifications/unread-count
- [x] PUT /notifications/:id/read
- [x] PUT /notifications/read-all
- [x] DELETE /notifications/:id
- [x] GET /notifications/devices
- [x] DELETE /notifications/devices/:id
- [x] GET /notifications/vapid-public-key
- [x] POST /notifications/subscribe
- [x] POST /notifications/unsubscribe
- [x] POST /notifications/test
- [x] GET /external-notifications/services
- [x] POST /external-notifications/services/:id/enable
- [x] POST /external-notifications/services/:id/disable
- [x] POST /external-notifications/services/:id/regenerate-token
- [x] POST /external-notifications/services/:id/notify-admins-only
- [x] GET /external-notifications/services/logs
- [x] GET /external-notifications/templates
- [x] PUT /external-notifications/templates/:id

#### 11. Custom Events (`routes/custom_events.py`)
- [x] GET /custom-events
- [x] POST /custom-events
- [x] PUT /custom-events/:id
- [x] DELETE /custom-events/:id

#### 12. Admin (`routes/admin.py`)
- [x] GET /admin/users
- [x] POST /admin/users
- [x] DELETE /admin/users/:id
- [x] GET /admin/export
- [x] POST /admin/import

#### 13. System/Misc
- [x] POST /webhooks/:serviceName (`routes/webhooks.py`) - Radarr, Sonarr, Prowlarr, Jellyfin, Plex, Duplicati, Uptime Kuma

#### 14. Analytics (`routes/analytics.py`)
- [x] GET /analytics/weekly-summary
- [x] GET /analytics/summary
- [x] GET /analytics/personal-insights
- [x] GET /analytics/shopping
- [x] GET /analytics/productivity

## Next Steps
1.  ~~Execute **Legacy API Versioning** (Move Python to `/v1`).~~ **DONE**
2.  ~~Begin **Database Setup** in Elysia.~~ **DONE**
3.  ~~Complete **Authentication** migration.~~ **DONE**
4.  ~~Begin **Phase 3: Incremental Feature Migration** - Users endpoints (/users/me, etc.).~~ **DONE**
5.  ~~Continue **Phase 3** - Migrate remaining features (Dashboard, Calendar, Chores, Recipes, etc.).~~ **DONE**
6.  Implement **Cron Jobs / Background Tasks** migration.
7.  Delete python api and rename apps/server to apps/api.
---

## Cron Jobs / Background Tasks Migration

The Python API currently uses APScheduler to run periodic background tasks. These need to be migrated to the Elysia server.

### Current Python Cron Jobs
Located in `apps/api/services/scheduler.py`:

1. **Reminder Notifications** - Runs every 15 minutes
   - Function: `check_and_send_reminders()`
   - Checks for upcoming reminders and sends push notifications

2. **All-Day Event Notifications** - Runs daily at 8:00 PM
   - Function: `check_and_send_all_day_custom_event_notifications()`
   - Sends notifications for all-day custom events

3. **Cleanup Old Notifications** - Runs daily at midnight
   - Function: `cleanup_old_notifications()`
   - Removes old notifications from the database

### Migration Strategy

Use the official **Elysia Cron plugin** (`@elysiajs/cron`) for scheduling background tasks.

#### Implementation Example
```typescript
import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';

const app = new Elysia()
  .use(
    cron({
      name: 'reminder-notifications',
      pattern: '*/15 * * * *', // Every 15 minutes
      run() {
        checkAndSendReminders();
      }
    })
  )
  .use(
    cron({
      name: 'all-day-event-notifications',
      pattern: '0 20 * * *', // Daily at 8:00 PM
      timezone: 'America/New_York', // Use TZ env var
      run() {
        checkAllDayEvents();
      }
    })
  )
  .use(
    cron({
      name: 'cleanup-old-notifications',
      pattern: '0 0 * * *', // Daily at midnight
      timezone: 'America/New_York',
      run() {
        cleanupOldNotifications();
      }
    })
  );
```

**Pros**: 
- Official Elysia plugin
- Cron syntax support
- Timezone support
- Integrates seamlessly with Elysia lifecycle
- Type-safe

**Cons**: 
- None (recommended approach)

### Implementation Checklist
- [ ] Install `@elysiajs/cron` in `apps/server`
- [ ] Create cron job handlers in `apps/server/src/jobs/`
- [ ] Port `check_and_send_reminders()` logic
- [ ] Port `check_and_send_all_day_custom_event_notifications()` logic
- [ ] Port `cleanup_old_notifications()` logic
- [ ] Add timezone configuration (use `TZ` env var)
- [ ] Register cron jobs in `apps/server/src/index.ts` using `.use(cron(...))`
- [ ] Test cron jobs in development
- [ ] Add logging for cron job execution
- [ ] Update docker-compose to ensure scheduler starts with server
- [ ] Document cron jobs in README

