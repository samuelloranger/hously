# Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Hously's custom JWT auth with better-auth — getting maintained security, immediate session revocation, and Authentik OIDC. Includes a full `Int → String` UUID migration of `users.id` and all 17 foreign key tables. No bridge columns. No hacks.

**Architecture:** `users.id` becomes a UUID string (`gen_random_uuid()`). All FK columns across every referencing table change to `TEXT` in one atomic SQL migration. better-auth session/account tables use this string ID natively. Application code uses `string` user IDs throughout. The invitation system stays as a custom Elysia route. `/api/auth/me`, `/api/auth/change-password`, and `/api/auth/avatar` remain custom routes. Everything else — login, logout, password reset, passkeys — is handled by better-auth plugins.

**Tech Stack:** better-auth v1.3+, `@better-auth/passkey`, Prisma adapter (postgresql), Elysia, Bun, PostgreSQL `gen_random_uuid()`.

---

## File Map

| File                                                                        | Action                  | Responsibility                                                                                                                      |
| --------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                             | Rewrite affected models | `id String` on User; all `userId Int` → `String`; add better-auth tables; remove old auth tables                                    |
| `apps/api/prisma/migrations/YYYYMMDD_convert_user_id_to_uuid/migration.sql` | Create                  | Raw SQL: drops FKs, adds string cols, migrates data, swaps PK, recreates FKs                                                        |
| `apps/api/src/lib/auth.ts`                                                  | Create                  | better-auth instance — email+password (custom hash/verify), passkey; Authentik config loaded from DB at startup via top-level await |
| `apps/api/src/routes/integrations/authentik/index.ts`                       | Create                  | Admin GET/PUT for Authentik OIDC config — stored in `integrations` table, same pattern as AdGuard/Jellyfin                          |
| `apps/api/src/routes/integrations/index.ts`                                 | Modify                  | Register `authentikIntegrationRoutes`                                                                                               |
| `apps/api/src/auth.ts`                                                      | Rewrite                 | Exports `publicAuthRoutes` (invitation — no auth) and `protectedAuthRoutes` (me, change-password, avatar — requireUser)             |
| `apps/api/src/middleware/auth.ts`                                           | Rewrite                 | Use `auth.api.getSession()` + `prisma.user.findUnique({ where: { id } })`                                                           |
| `apps/api/src/index.ts`                                                     | Modify                  | Mount better-auth handler; remove passkeyRoutes                                                                                     |
| `apps/api/src/routes/passkey.ts`                                            | Delete                  | better-auth passkey plugin owns `/api/auth/passkey/*`                                                                               |
| `apps/api/src/utils/mappers.ts`                                             | Modify                  | `id: number` → `id: string`; `Map<number,…>` → `Map<string,…>`                                                                      |
| `apps/api/src/utils/session.ts`                                             | Delete                  | Replaced by better-auth                                                                                                             |
| `apps/shared/src/types/user.ts`                                             | Modify                  | `id: number` → `id: string`                                                                                                         |
| `apps/web/src/lib/auth/betterAuthClient.ts`                                 | Create                  | better-auth browser client                                                                                                          |
| `apps/web/src/lib/auth/useAuth.ts`                                          | Modify                  | Update endpoints and remove refresh token logic                                                                                     |
| `apps/web/src/lib/auth/usePasskey.ts`                                       | Rewrite                 | Use better-auth client instead of @simplewebauthn/browser                                                                           |
| `apps/web/src/lib/endpoints.ts`                                             | Modify                  | Update AUTH_ENDPOINTS to better-auth paths                                                                                          |

---

## Task 1: Install better-auth

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install in the API**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bun add better-auth @better-auth/passkey
```

- [ ] **Step 2: Install client in the web app**

```bash
cd /home/samuelloranger/sites/hously/apps/web
bun add better-auth
```

- [ ] **Step 3: Verify**

```bash
grep '"better-auth"' /home/samuelloranger/sites/hously/apps/api/package.json \
                     /home/samuelloranger/sites/hously/apps/web/package.json
```

Expected: both files show `"better-auth": "^1.x.x"`

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/bun.lockb apps/web/package.json
git commit -m "chore: install better-auth"
```

---

## Task 2: Full `Int → String` UUID migration — users.id and all FK columns

**Files:**

- Create: `apps/api/prisma/migrations/20260504_convert_user_id_to_uuid/migration.sql`
- Rewrite affected models in: `apps/api/prisma/schema.prisma`

This is the core migration. 17 tables reference `users.id` as an integer. The SQL atomically:

1. Adds a `_new_id TEXT` column to `users`, populates with `gen_random_uuid()`
2. Adds a temporary string column per FK, populates via JOIN
3. Drops all FK constraints
4. Drops all old integer columns
5. Renames new columns into place
6. Swaps `users.id` to be the string PK
7. Recreates all FK constraints and indexes

- [ ] **Step 1: Create the migration directory and SQL file**

```bash
mkdir -p /home/samuelloranger/sites/hously/apps/api/prisma/migrations/20260504_convert_user_id_to_uuid
```

Create `/home/samuelloranger/sites/hously/apps/api/prisma/migrations/20260504_convert_user_id_to_uuid/migration.sql`:

```sql
BEGIN;

-- Drop all FK constraints referencing users.id
ALTER TABLE board_tasks           DROP CONSTRAINT IF EXISTS board_tasks_assignee_id_fkey;
ALTER TABLE board_tasks           DROP CONSTRAINT IF EXISTS board_tasks_created_by_fkey;
ALTER TABLE board_time_logs       DROP CONSTRAINT IF EXISTS board_time_logs_user_id_fkey;
ALTER TABLE board_task_activities DROP CONSTRAINT IF EXISTS board_task_activities_user_id_fkey;
ALTER TABLE notifications         DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE custom_events         DROP CONSTRAINT IF EXISTS custom_events_user_id_fkey;
ALTER TABLE reminders             DROP CONSTRAINT IF EXISTS reminders_user_id_fkey;
ALTER TABLE user_subscriptions    DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;
ALTER TABLE task_completions      DROP CONSTRAINT IF EXISTS task_completions_user_id_fkey;
ALTER TABLE activity_logs         DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE chores                DROP CONSTRAINT IF EXISTS chores_added_by_fkey;
ALTER TABLE chores                DROP CONSTRAINT IF EXISTS chores_assigned_to_fkey;
ALTER TABLE chores                DROP CONSTRAINT IF EXISTS chores_completed_by_fkey;
ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey;
ALTER TABLE refresh_tokens        DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_fkey;
ALTER TABLE webauthn_credentials  DROP CONSTRAINT IF EXISTS webauthn_credentials_user_id_fkey;
ALTER TABLE invitations           DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;
ALTER TABLE notification_channels DROP CONSTRAINT IF EXISTS notification_channels_user_id_fkey;
ALTER TABLE habits                DROP CONSTRAINT IF EXISTS habits_user_id_fkey;
ALTER TABLE watchlist_items       DROP CONSTRAINT IF EXISTS watchlist_items_user_id_fkey;

-- Also drop unique index on users.email (will be recreated)
DROP INDEX IF EXISTS ix_users_email;

-- Add new UUID column to users
ALTER TABLE users ADD COLUMN _new_id TEXT;
UPDATE users SET _new_id = gen_random_uuid()::text;
ALTER TABLE users ALTER COLUMN _new_id SET NOT NULL;

-- Add temporary string FK columns to all child tables
ALTER TABLE board_tasks           ADD COLUMN _new_assignee_id TEXT;
ALTER TABLE board_tasks           ADD COLUMN _new_created_by  TEXT;
ALTER TABLE board_time_logs       ADD COLUMN _new_user_id     TEXT;
ALTER TABLE board_task_activities ADD COLUMN _new_user_id     TEXT;
ALTER TABLE notifications         ADD COLUMN _new_user_id     TEXT;
ALTER TABLE custom_events         ADD COLUMN _new_user_id     TEXT;
ALTER TABLE reminders             ADD COLUMN _new_user_id     TEXT;
ALTER TABLE user_subscriptions    ADD COLUMN _new_user_id     TEXT;
ALTER TABLE task_completions      ADD COLUMN _new_user_id     TEXT;
ALTER TABLE activity_logs         ADD COLUMN _new_user_id     TEXT;
ALTER TABLE chores                ADD COLUMN _new_added_by    TEXT;
ALTER TABLE chores                ADD COLUMN _new_assigned_to TEXT;
ALTER TABLE chores                ADD COLUMN _new_completed_by TEXT;
ALTER TABLE password_reset_tokens ADD COLUMN _new_user_id     TEXT;
ALTER TABLE refresh_tokens        ADD COLUMN _new_user_id     TEXT;
ALTER TABLE webauthn_credentials  ADD COLUMN _new_user_id     TEXT;
ALTER TABLE invitations           ADD COLUMN _new_invited_by  TEXT;
ALTER TABLE notification_channels ADD COLUMN _new_user_id     TEXT;
ALTER TABLE habits                ADD COLUMN _new_user_id     TEXT;
ALTER TABLE watchlist_items       ADD COLUMN _new_user_id     TEXT;

-- Populate new FK columns by joining on the old integer ID
UPDATE board_tasks           t SET _new_assignee_id  = u._new_id FROM users u WHERE u.id = t.assignee_id;
UPDATE board_tasks           t SET _new_created_by   = u._new_id FROM users u WHERE u.id = t.created_by;
UPDATE board_time_logs       t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE board_task_activities t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE notifications         t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE custom_events         t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE reminders             t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE user_subscriptions    t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE task_completions      t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE activity_logs         t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id AND   t.user_id IS NOT NULL;
UPDATE chores                t SET _new_added_by     = u._new_id FROM users u WHERE u.id = t.added_by;
UPDATE chores                t SET _new_assigned_to  = u._new_id FROM users u WHERE u.id = t.assigned_to  AND t.assigned_to  IS NOT NULL;
UPDATE chores                t SET _new_completed_by = u._new_id FROM users u WHERE u.id = t.completed_by AND t.completed_by IS NOT NULL;
UPDATE password_reset_tokens t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE refresh_tokens        t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE webauthn_credentials  t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE invitations           t SET _new_invited_by   = u._new_id FROM users u WHERE u.id = t.invited_by;
UPDATE notification_channels t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE habits                t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;
UPDATE watchlist_items       t SET _new_user_id      = u._new_id FROM users u WHERE u.id = t.user_id;

-- Set NOT NULL on required (non-nullable) new columns
ALTER TABLE board_tasks           ALTER COLUMN _new_created_by   SET NOT NULL;
ALTER TABLE board_time_logs       ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE board_task_activities ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE notifications         ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE custom_events         ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE reminders             ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE user_subscriptions    ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE task_completions      ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE chores                ALTER COLUMN _new_added_by     SET NOT NULL;
ALTER TABLE password_reset_tokens ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE refresh_tokens        ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE webauthn_credentials  ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE invitations           ALTER COLUMN _new_invited_by   SET NOT NULL;
ALTER TABLE notification_channels ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE habits                ALTER COLUMN _new_user_id      SET NOT NULL;
ALTER TABLE watchlist_items       ALTER COLUMN _new_user_id      SET NOT NULL;

-- Drop old integer FK columns
ALTER TABLE board_tasks           DROP COLUMN assignee_id;
ALTER TABLE board_tasks           DROP COLUMN created_by;
ALTER TABLE board_time_logs       DROP COLUMN user_id;
ALTER TABLE board_task_activities DROP COLUMN user_id;
ALTER TABLE notifications         DROP COLUMN user_id;
ALTER TABLE custom_events         DROP COLUMN user_id;
ALTER TABLE reminders             DROP COLUMN user_id;
ALTER TABLE user_subscriptions    DROP COLUMN user_id;
ALTER TABLE task_completions      DROP COLUMN user_id;
ALTER TABLE activity_logs         DROP COLUMN user_id;
ALTER TABLE chores                DROP COLUMN added_by;
ALTER TABLE chores                DROP COLUMN assigned_to;
ALTER TABLE chores                DROP COLUMN completed_by;
ALTER TABLE password_reset_tokens DROP COLUMN user_id;
ALTER TABLE refresh_tokens        DROP COLUMN user_id;
ALTER TABLE webauthn_credentials  DROP COLUMN user_id;
ALTER TABLE invitations           DROP COLUMN invited_by;
ALTER TABLE notification_channels DROP COLUMN user_id;
ALTER TABLE habits                DROP COLUMN user_id;
ALTER TABLE watchlist_items       DROP COLUMN user_id;

-- Rename new columns to final names
ALTER TABLE board_tasks           RENAME COLUMN _new_assignee_id  TO assignee_id;
ALTER TABLE board_tasks           RENAME COLUMN _new_created_by   TO created_by;
ALTER TABLE board_time_logs       RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE board_task_activities RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE notifications         RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE custom_events         RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE reminders             RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE user_subscriptions    RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE task_completions      RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE activity_logs         RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE chores                RENAME COLUMN _new_added_by     TO added_by;
ALTER TABLE chores                RENAME COLUMN _new_assigned_to  TO assigned_to;
ALTER TABLE chores                RENAME COLUMN _new_completed_by TO completed_by;
ALTER TABLE password_reset_tokens RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE refresh_tokens        RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE webauthn_credentials  RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE invitations           RENAME COLUMN _new_invited_by   TO invited_by;
ALTER TABLE notification_channels RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE habits                RENAME COLUMN _new_user_id      TO user_id;
ALTER TABLE watchlist_items       RENAME COLUMN _new_user_id      TO user_id;

-- Swap users primary key: drop Int id, promote _new_id to id
ALTER TABLE users DROP CONSTRAINT users_pkey;
ALTER TABLE users DROP COLUMN id;
ALTER TABLE users RENAME COLUMN _new_id TO id;
ALTER TABLE users ADD PRIMARY KEY (id);

-- Recreate FK constraints
ALTER TABLE board_tasks ADD CONSTRAINT board_tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE board_tasks ADD CONSTRAINT board_tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE board_time_logs ADD CONSTRAINT board_time_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE board_task_activities ADD CONSTRAINT board_task_activities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE custom_events ADD CONSTRAINT custom_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE reminders ADD CONSTRAINT reminders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE task_completions ADD CONSTRAINT task_completions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chores ADD CONSTRAINT chores_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES users(id);
ALTER TABLE chores ADD CONSTRAINT chores_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id);
ALTER TABLE chores ADD CONSTRAINT chores_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE webauthn_credentials ADD CONSTRAINT webauthn_credentials_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE invitations ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_channels ADD CONSTRAINT notification_channels_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE habits ADD CONSTRAINT habits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE watchlist_items ADD CONSTRAINT watchlist_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);

-- Recreate indexes
CREATE UNIQUE INDEX ix_users_email ON users(email);
CREATE INDEX ix_refresh_tokens_user_id        ON refresh_tokens(user_id);
CREATE INDEX ix_webauthn_credentials_user_id  ON webauthn_credentials(user_id);
CREATE INDEX ix_notifications_user_id         ON notifications(user_id);
CREATE INDEX ix_user_subscriptions_user_id    ON user_subscriptions(user_id);
CREATE INDEX ix_activity_logs_user_id         ON activity_logs(user_id);
CREATE INDEX ix_habits_user_id                ON habits(user_id);
CREATE INDEX ix_notification_channels_user_id ON notification_channels(user_id);
CREATE UNIQUE INDEX uq_watchlist_user_tmdb_type ON watchlist_items(user_id, tmdb_id, media_type);
CREATE INDEX ix_watchlist_user_added_at        ON watchlist_items(user_id, added_at);

COMMIT;
```

- [ ] **Step 2: Update `schema.prisma` — User model**

Replace the `User` model's `id` field and update every `userId`/FK field type from `Int` to `String`. The full updated User model:

```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique(map: "ix_users_email")
  passwordHash    String?   @map("password_hash")
  authVersion     Int       @default(1) @map("auth_version")
  isAdmin         Boolean?  @map("is_admin")
  lastLogin       DateTime? @map("last_login")
  createdAt       DateTime? @map("created_at")
  lastActivity    DateTime? @map("last_activity")
  firstName       String?   @map("first_name")
  lastName        String?   @map("last_name")
  locale          String?
  countryCode              String?   @map("country_code") @db.VarChar(2)
  calendarSubdivisionCode  String?   @map("calendar_subdivision_code") @db.VarChar(16)
  avatarUrl       String?   @map("avatar_url")
  dashboardConfig Json?     @map("dashboard_config")
  calendarToken   String?   @unique(map: "ix_users_calendar_token") @map("calendar_token")

  notifications          Notification[]
  customEvents           CustomEvent[]
  reminders              Reminder[]
  userSubscriptions      UserSubscription[]
  taskCompletions        TaskCompletion[]
  activityLogs           ActivityLog[]
  choresAdded            Chore[]              @relation("ChoreAddedBy")
  choresAssigned         Chore[]              @relation("ChoreAssignedTo")
  choresCompleted        Chore[]              @relation("ChoreCompletedBy")
  passwordResetTokens    PasswordResetToken[]
  refreshTokens          RefreshToken[]
  passkeyCredentials     WebAuthnCredential[]
  notificationChannels   NotificationChannel[]
  habits                 Habit[]
  invitationsSent        Invitation[]         @relation("InvitationInviter")
  watchlistItems         WatchlistItem[]
  createdBoardTasks      BoardTask[]          @relation("BoardTaskCreatedBy")
  assignedBoardTasks     BoardTask[]          @relation("BoardTaskAssignee")
  boardTaskActivities    BoardTaskActivity[]
  boardTimeLogs          BoardTimeLog[]

  @@map("users")
}
```

For every child model, change the FK field type. Examples:

```prisma
// BoardTask
  assigneeId       String?           @map("assignee_id")
  createdBy        String            @map("created_by")

// BoardTimeLog
  userId   String   @map("user_id")

// Notification
  userId   String   @map("user_id")

// ActivityLog
  userId   String?  @map("user_id")

// Chore
  assignedTo  String?  @map("assigned_to")
  addedBy     String   @map("added_by")
  completedBy String?  @map("completed_by")

// Invitation
  invitedBy  String   @map("invited_by")

// RefreshToken / PasswordResetToken / WebAuthnCredential / etc.
  userId  String  @map("user_id")
```

Apply the same `Int → String` change to every model listed in the File Map.

- [ ] **Step 3: Apply the migration**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bunx prisma migrate resolve --applied 20260504_convert_user_id_to_uuid
bunx prisma migrate deploy
```

If this is a development environment, use instead:

```bash
bunx prisma db execute --file prisma/migrations/20260504_convert_user_id_to_uuid/migration.sql --schema prisma/schema.prisma
bunx prisma generate
```

- [ ] **Step 4: Verify — query the users table**

```bash
bunx prisma studio &
# Or directly:
psql $DATABASE_URL -c "SELECT id, email FROM users LIMIT 3;"
```

Expected: `id` column now contains UUID strings like `019xxx-...`, not integers.

- [ ] **Step 5: Verify FK integrity**

```bash
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM notifications n
LEFT JOIN users u ON u.id = n.user_id
WHERE u.id IS NULL;
"
```

Expected: `0` — no orphaned FK rows.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): convert users.id and all FK columns from Int to String UUID"
```

---

## Task 3: Update TypeScript types for String user IDs

**Files:**

- Modify: `apps/shared/src/types/user.ts`
- Modify: `apps/api/src/utils/mappers.ts`

After `prisma generate`, Prisma types already reflect `id: string`. But the application-level types and mappers need manual updates.

- [ ] **Step 1: Update the shared `User` interface**

In `apps/shared/src/types/user.ts`, change:

```typescript
export interface User {
  id: string; // was: number
  email: string;
  // ... rest unchanged
}
```

- [ ] **Step 2: Update `mapUser` in `apps/api/src/utils/mappers.ts`**

The `user` parameter type changes from `id: number` to `id: string`. Update the function signature:

```typescript
export const mapUser = (
  user: {
    id: string; // was: number
    email: string;
    firstName: string | null;
    lastName: string | null;
    isAdmin: boolean | null;
    locale: string | null;
    countryCode?: string | null;
    calendarSubdivisionCode?: string | null;
    lastLogin: Date | null;
    createdAt: Date | null;
    lastActivity: Date | null;
    avatarUrl: string | null;
  },
  options?: { hasPasskey?: boolean },
) => ({
  id: user.id, // now a string — no change needed in the return body
  // ... rest unchanged
});
```

- [ ] **Step 3: Update `buildUserMap` and `getUserDisplayName`**

```typescript
export function buildUserMap(
  users: Array<{ id: string; firstName: string | null; email: string }>,
): Map<string, UserLookup> {
  const map = new Map<string, UserLookup>();
  for (const u of users) {
    map.set(u.id, { firstName: u.firstName, email: u.email });
  }
  return map;
}

export function getUserDisplayName(
  userId: string | null | undefined,
  map: Map<string, UserLookup>,
): string | null {
  if (!userId) return null;
  const user = map.get(userId);
  return user?.firstName || user?.email || null;
}
```

- [ ] **Step 4: Find and fix remaining type errors from the ID change**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bunx tsc --noEmit 2>&1 | grep -v node_modules | grep "error TS"
```

For each error: the fix is always replacing `number` with `string` for user ID fields, or removing `parseInt`/`Number()` casts around `user.id`. Fix all errors before continuing.

Repeat for the web app:

```bash
cd /home/samuelloranger/sites/hously/apps/web
bunx tsc --noEmit 2>&1 | grep -v node_modules | grep "error TS"
```

- [ ] **Step 5: Commit**

```bash
git add apps/shared/src/types/user.ts apps/api/src/utils/mappers.ts
git commit -m "feat(types): update User.id from number to string throughout"
```

---

## Task 4: Create the better-auth instance

**Files:**

- Create: `apps/api/src/lib/auth.ts`

Re-uses `hashPassword`/`verifyPassword` from `utils/password.ts` so all existing hashes (Argon2id, legacy pbkdf2, scrypt) keep working without any data migration.

- [ ] **Step 1: Create `apps/api/src/lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { passkey } from "@better-auth/passkey";
import { genericOAuth } from "better-auth/plugins";
import { prisma } from "@hously/api/db";
import { hashPassword, verifyPassword } from "@hously/api/utils/password";
import { decrypt } from "@hously/api/services/crypto";

type AuthentikOAuthConfig = {
  providerId: "authentik";
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  scopes: string[];
  mapProfileToUser: (profile: Record<string, unknown>) => {
    firstName: string;
    lastName: string;
  };
};

async function loadAuthentikOAuthConfig(): Promise<AuthentikOAuthConfig | null> {
  const row = await prisma.integration.findFirst({
    where: { type: "authentik", enabled: true },
    select: { config: true },
  });
  if (
    !row?.config ||
    typeof row.config !== "object" ||
    Array.isArray(row.config)
  )
    return null;
  const cfg = row.config as Record<string, unknown>;
  const issuer_url = typeof cfg.issuer_url === "string" ? cfg.issuer_url : "";
  const client_id = typeof cfg.client_id === "string" ? cfg.client_id : "";
  const client_secret =
    typeof cfg.client_secret === "string" ? decrypt(cfg.client_secret) : "";
  if (!issuer_url || !client_id || !client_secret) return null;
  return {
    providerId: "authentik",
    clientId: client_id,
    clientSecret: client_secret,
    discoveryUrl: `${issuer_url}/.well-known/openid-configuration`,
    scopes: ["openid", "email", "profile"],
    mapProfileToUser: (profile) => ({
      firstName:
        typeof profile.given_name === "string"
          ? profile.given_name
          : typeof profile.name === "string"
            ? profile.name.split(" ")[0]
            : "",
      lastName:
        typeof profile.family_name === "string"
          ? profile.family_name
          : typeof profile.name === "string"
            ? profile.name.split(" ").slice(1).join(" ")
            : "",
    }),
  };
}

// Top-level await: reads Authentik config from the integrations table once at
// startup. Config changes via the admin UI require a server restart to take effect.
const authentikConfig = await loadAuthentikOAuthConfig();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
    schema: {
      session: { modelName: "BaSession" },
      account: { modelName: "BaAccount" },
      verification: { modelName: "BaVerification" },
    },
  }),

  advanced: {
    generateId: () => crypto.randomUUID(),
  },

  user: {
    modelName: "User",
    fields: {
      id: "id",
      email: "email",
      name: false,
      emailVerified: false,
      image: "avatarUrl",
      createdAt: "createdAt",
      updatedAt: false,
    },
    additionalFields: {
      firstName: { type: "string", fieldName: "firstName" },
      lastName: { type: "string", fieldName: "lastName" },
    },
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } =
        await import("@hously/api/services/emailService");
      await sendPasswordResetEmail(user.email, url, "en");
    },
    resetPasswordTokenExpiresIn: 3600,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }: { hash: string; password: string }) =>
        verifyPassword(password, hash),
    },
  },

  plugins: [
    passkey({
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      rpName: process.env.WEBAUTHN_RP_NAME || "Hously",
      origin: process.env.BASE_URL || "http://localhost:3000",
      schema: {
        passkey: { modelName: "BaPasskey" },
      },
    }),
    ...(authentikConfig ? [genericOAuth({ config: [authentikConfig] })] : []),
  ],

  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5173"],

  session: {
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});
```

- [ ] **Step 2: Add better-auth schema tables to `schema.prisma`**

Append these models at the end of the file:

```prisma
// ── better-auth tables ─────────────────────────────────────────────
model BaSession {
  id        String   @id
  expiresAt DateTime @map("expires_at")
  token     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt     @map("updated_at")
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  userId    String   @map("user_id")
  @@map("ba_sessions")
}

model BaAccount {
  id                    String    @id
  accountId             String    @map("account_id")
  providerId            String    @map("provider_id")
  userId                String    @map("user_id")
  accessToken           String?   @map("access_token")           @db.Text
  refreshToken          String?   @map("refresh_token")          @db.Text
  idToken               String?   @map("id_token")               @db.Text
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
  scope                 String?
  password              String?   @db.Text
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt      @map("updated_at")
  @@map("ba_accounts")
}

model BaVerification {
  id         String   @id
  identifier String
  value      String   @db.Text
  expiresAt  DateTime @map("expires_at")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt      @map("updated_at")
  @@map("ba_verifications")
}

model BaPasskey {
  id             String    @id
  name           String?
  publicKey      String    @map("public_key") @db.Text
  userId         String    @map("user_id")
  webauthnUserId String    @map("webauthn_user_id")
  counter        BigInt    @default(0)
  deviceType     String    @map("device_type")
  backedUp       Boolean   @default(false) @map("backed_up")
  transports     String?
  createdAt      DateTime? @default(now()) @map("created_at")
  @@map("ba_passkeys")
}
```

- [ ] **Step 3: Run the migration for better-auth tables**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bunx prisma migrate dev --name add_better_auth_tables
bunx prisma generate
```

- [ ] **Step 4: TypeScript check**

```bash
bunx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: No errors in `src/lib/auth.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/auth.ts apps/api/prisma/
git commit -m "feat(auth): create better-auth instance with email+password and passkey plugins"
```

---

## Task 5: Replace session middleware

**Files:**

- Rewrite: `apps/api/src/middleware/auth.ts`

With string IDs, the middleware is now trivially simple: get the session, look up the user by `id` (the UUID string that's now both better-auth's user ID and our PK).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/middleware/auth.test.ts`:

```typescript
import { describe, it, expect, mock } from "bun:test";
import { Elysia } from "elysia";

const mockGetSession = mock(async () => null);
mock.module("../../lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

const mockFindUnique = mock(async () => null);
mock.module("../../db", () => ({
  prisma: { user: { findUnique: mockFindUnique } },
}));

const { requireUser } = await import("../../middleware/auth");

const fakeUser = {
  id: "uuid-123",
  email: "a@b.com",
  firstName: "Sam",
  lastName: null,
  isAdmin: false,
  locale: "en",
  countryCode: null,
  calendarSubdivisionCode: null,
  avatarUrl: null,
  calendarToken: null,
  dashboardConfig: null,
  lastLogin: null,
  lastActivity: null,
  authVersion: 1,
  passwordHash: "hashed",
  createdAt: new Date(),
};

describe("requireUser", () => {
  it("returns 401 with no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const app = new Elysia().use(requireUser).get("/t", () => "ok");
    const res = await app.handle(new Request("http://localhost/t"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user not found in DB", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "uuid-123" } });
    mockFindUnique.mockResolvedValueOnce(null);
    const app = new Elysia().use(requireUser).get("/t", () => "ok");
    const res = await app.handle(new Request("http://localhost/t"));
    expect(res.status).toBe(401);
  });

  it("injects string user.id when session is valid", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "uuid-123" } });
    mockFindUnique.mockResolvedValueOnce(fakeUser);
    const app = new Elysia()
      .use(requireUser)
      .get("/t", ({ user }) => ({ id: user?.id }));
    const res = await app.handle(new Request("http://localhost/t"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("uuid-123");
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bun test src/__tests__/middleware/auth.test.ts 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: Rewrite `apps/api/src/middleware/auth.ts`**

```typescript
import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { prisma } from "../db";
import { mapUser } from "../utils/mappers";

const resolveUser = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  return user ? mapUser(user) : null;
};

export const requireUser = new Elysia({ name: "middleware/requireUser" })
  .derive(async ({ request }) => ({ user: await resolveUser(request) }))
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

export const requireAdmin = new Elysia({ name: "middleware/requireAdmin" })
  .derive(async ({ request }) => ({ user: await resolveUser(request) }))
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (!user.is_admin) {
      set.status = 403;
      return { error: "Forbidden" };
    }
  });
```

- [ ] **Step 4: Run — confirm PASS**

```bash
bun test src/__tests__/middleware/auth.test.ts 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/__tests__/middleware/auth.test.ts
git commit -m "feat(auth): replace JWT middleware with better-auth session lookup"
```

---

## Task 6: Mount better-auth handler + rewrite auth.ts custom routes

**Files:**

- Modify: `apps/api/src/index.ts`
- Rewrite: `apps/api/src/auth.ts`

better-auth handles `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/forget-password`, `/api/auth/reset-password`, and all passkey routes. We keep three custom routes: `/api/auth/me`, `/api/auth/change-password`, `/api/auth/avatar`, plus the invitation flow.

- [ ] **Step 1: Update `apps/api/src/index.ts`**

Add these imports at the top of the file:

```typescript
import { auth as betterAuthInstance } from "@hously/api/lib/auth";
import { publicAuthRoutes, protectedAuthRoutes } from "@hously/api/auth";
```

Register custom auth routes **before** the better-auth catch-all. Elysia matches in registration order — specific routes must come first or the wildcard wins:

```typescript
  .use(publicAuthRoutes)
  .use(protectedAuthRoutes)
  .all("/api/auth/*", (context) => {
    if (["GET", "POST"].includes(context.request.method)) {
      return betterAuthInstance.handler(context.request);
    }
    context.error(405);
  })
```

Remove the old `auth` function import from `./auth`, the `passkeyRoutes` import, and both their `.use()` calls.

- [ ] **Step 2: Rewrite `apps/api/src/auth.ts`**

```typescript
import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { hashPassword, verifyPassword } from "@hously/api/utils/password";
import { validatePassword } from "@hously/api/utils/validation";
import { opaqueTokenCandidates } from "@hously/api/utils/tokens";
import { mapUser } from "@hously/api/utils/mappers";
import { auth as betterAuth } from "@hously/api/lib/auth";
import {
  updateUserAvatarFromUpload,
  updateUserProfile,
} from "@hously/api/services/userProfileService";
import { requireUser } from "@hously/api/middleware/auth";

// ── Public routes — no authentication required ────────────────────────────

export const publicAuthRoutes = new Elysia()

  .get(
    "/api/auth/accept-invitation",
    async ({ query, set }) => {
      const { token } = query;
      if (!token) {
        set.status = 400;
        return { valid: false, error: "Token is required" };
      }
      const invitation = await prisma.invitation.findFirst({
        where: {
          token: { in: opaqueTokenCandidates(token) },
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });
      if (!invitation)
        return { valid: false, error: "Invalid or expired invitation" };
      return { valid: true, email: invitation.email };
    },
    { query: t.Object({ token: t.String() }) },
  )

  .post(
    "/api/auth/accept-invitation",
    async ({ body, set, request }) => {
      const { token, password, first_name, last_name } = body;

      const [isValid, passwordError] = validatePassword(password);
      if (!isValid) {
        set.status = 400;
        return { error: passwordError };
      }

      const invitation = await prisma.invitation.findFirst({
        where: {
          token: { in: opaqueTokenCandidates(token) },
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });
      if (!invitation) {
        set.status = 400;
        return { error: "Invalid or expired invitation" };
      }

      const existingUser = await prisma.user.findFirst({
        where: { email: invitation.email },
      });
      if (existingUser) {
        set.status = 400;
        return { error: "An account with this email already exists" };
      }

      const passwordHash = await hashPassword(password);

      // Create user, the better-auth credential account, and mark the
      // invitation accepted — all in one atomic transaction.
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName: first_name || null,
            lastName: last_name || null,
            isAdmin: invitation.isAdmin,
            locale: invitation.locale || "en",
            createdAt: new Date(),
          },
        });

        // Required: without this ba_accounts entry betterAuth.api.signInEmail
        // fails because it looks up the credential account to verify the password.
        await tx.baAccount.create({
          data: {
            id: crypto.randomUUID(),
            accountId: invitation.email,
            providerId: "credential",
            userId: user.id,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "accepted", acceptedAt: new Date() },
        });

        return user;
      });

      // Establish a better-auth session immediately after account creation.
      const signInResponse = await betterAuth.api.signInEmail({
        body: { email: invitation.email, password },
        headers: request.headers,
      });

      const sessionCookie = signInResponse.headers.get("set-cookie");
      if (sessionCookie) {
        (set.headers as Record<string, string>)["set-cookie"] = sessionCookie;
      }

      set.status = 201;
      return { user: mapUser(newUser) };
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String(),
        first_name: t.Optional(t.String()),
        last_name: t.Optional(t.String()),
      }),
    },
  );

// ── Protected routes — requireUser middleware applies ─────────────────────

export const protectedAuthRoutes = new Elysia()
  .use(requireUser)

  .get("/api/auth/me", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { user: null };
    }
    const [dbUser, passkeyCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.baPasskey.count({ where: { userId: user.id } }),
    ]);
    if (!dbUser) {
      set.status = 401;
      return { user: null };
    }
    return { user: mapUser(dbUser, { hasPasskey: passkeyCount > 0 }) };
  })

  .put(
    "/api/auth/me",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const result = await updateUserProfile(user.id, body);
      if (!result.ok) {
        set.status = result.status;
        return { error: result.error };
      }
      return { user: mapUser(result.user) };
    },
    {
      body: t.Object({
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
        locale: t.Optional(t.Union([t.String(), t.Null()])),
        country_code: t.Optional(t.Union([t.String(), t.Null()])),
        calendar_subdivision_code: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

  .post(
    "/api/auth/change-password",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const { current_password, new_password } = body;

      const [isValid, passwordError] = validatePassword(new_password);
      if (!isValid) {
        set.status = 400;
        return { error: passwordError };
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      if (!dbUser?.passwordHash) {
        set.status = 400;
        return {
          error:
            "This account uses passkey authentication. Add a password before changing it.",
        };
      }

      const isCurrentValid = await verifyPassword(
        current_password,
        dbUser.passwordHash,
      );
      if (!isCurrentValid) {
        set.status = 400;
        return { error: "Current password is incorrect" };
      }

      const passwordHash = await hashPassword(new_password);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
        prisma.baAccount.updateMany({
          where: { userId: user.id, providerId: "credential" },
          data: { password: passwordHash },
        }),
      ]);

      return { message: "Password updated successfully" };
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    },
  )

  .post(
    "/api/auth/avatar",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const { avatar } = body;
      const isWebFile = avatar instanceof File;
      const isReactNativeFile =
        avatar &&
        typeof avatar === "object" &&
        "uri" in avatar &&
        "name" in avatar &&
        "type" in avatar;
      if (!avatar || (!isWebFile && !isReactNativeFile)) {
        set.status = 400;
        return { error: "Avatar file is required" };
      }
      const result = await updateUserAvatarFromUpload(user.id, avatar);
      if (!result.ok) {
        set.status = 400;
        return { error: result.message };
      }
      return {
        message: "Avatar uploaded successfully",
        avatar_url: result.avatarUrl,
        url: result.avatarUrl,
      };
    },
    {
      body: t.Object({ avatar: t.Any() }),
      type: "multipart/form-data",
    },
  );
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bunx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Fix any remaining errors. Common ones: services that still pass numeric userId where string is now expected.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth.ts apps/api/src/index.ts
git commit -m "feat(auth): replace JWT routes with better-auth; keep custom /me, /change-password, /avatar, /accept-invitation"
```

---

## Task 7: Delete old passkey routes

**Files:**

- Delete: `apps/api/src/routes/passkey.ts`

- [ ] **Step 1: Delete**

```bash
rm /home/samuelloranger/sites/hously/apps/api/src/routes/passkey.ts
```

- [ ] **Step 2: Verify no dangling imports**

```bash
grep -r "passkeyRoutes\|routes/passkey" /home/samuelloranger/sites/hously/apps/api/src/ --include="*.ts"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): remove custom passkey routes — handled by better-auth passkey plugin"
```

---

## Task 8: Update frontend auth client and hooks

**Files:**

- Create: `apps/web/src/lib/auth/betterAuthClient.ts`
- Modify: `apps/web/src/lib/auth/useAuth.ts`
- Modify: `apps/web/src/lib/auth/usePasskey.ts`
- Modify: `apps/web/src/lib/endpoints.ts`

- [ ] **Step 1: Create the better-auth browser client**

Create `apps/web/src/lib/auth/betterAuthClient.ts`:

```typescript
import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  plugins: [passkeyClient()],
});
```

- [ ] **Step 2: Update `AUTH_ENDPOINTS` in `apps/web/src/lib/endpoints.ts`**

```typescript
export const AUTH_ENDPOINTS = {
  LOGIN: "/api/auth/sign-in/email",
  LOGOUT: "/api/auth/sign-out",
  FORGOT_PASSWORD: "/api/auth/forget-password",
  RESET_PASSWORD: "/api/auth/reset-password",
  ME: "/api/auth/me",
  CHANGE_PASSWORD: "/api/auth/change-password",
  AVATAR: "/api/auth/avatar",
  ACCEPT_INVITATION: "/api/auth/accept-invitation",
};
```

- [ ] **Step 3: Update `useLogin` — new body format, no refreshToken**

In `apps/web/src/lib/auth/useAuth.ts`:

```typescript
export function useLogin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      fetcher<{ user: unknown; session: unknown }>(AUTH_ENDPOINTS.LOGIN, {
        method: "POST",
        body: { email: data.email, password: data.password },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
```

- [ ] **Step 4: Update `useLogout`**

```typescript
export function useLogout() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<{ success: boolean }>(AUTH_ENDPOINTS.LOGOUT, { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
```

- [ ] **Step 5: Update `useForgotPassword` and `useResetPassword`**

better-auth's forget-password sends `{ email, redirectTo }` and reset-password sends `{ newPassword, token }` (note: `newPassword` not `password`):

```typescript
export function useForgotPassword() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (data: { email: string }) =>
      fetcher<{ status: boolean }>(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
        method: "POST",
        body: {
          email: data.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      }),
  });
}

export function useResetPassword() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      fetcher<{ status: boolean }>(AUTH_ENDPOINTS.RESET_PASSWORD, {
        method: "POST",
        body: { newPassword: data.password, token: data.token },
      }),
  });
}
```

- [ ] **Step 6: Rewrite `apps/web/src/lib/auth/usePasskey.ts`**

Replace the `@simplewebauthn/browser` calls with the better-auth client:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "./betterAuthClient";
import { queryKeys } from "@/lib/queryKeys";

export function useRegisterPasskey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authClient.passkey.addPasskey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useAuthenticatePasskey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authClient.passkey.signIn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
```

- [ ] **Step 7: TypeScript check on web app**

```bash
cd /home/samuelloranger/sites/hously/apps/web
bunx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Fix all errors before continuing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/auth/
git commit -m "feat(auth): update frontend to use better-auth endpoints and client"
```

---

## Task 9: Integration smoke test

- [ ] **Step 1: Start the stack**

```bash
cd /home/samuelloranger/sites/hously
docker compose up -d db redis
cd apps/api && bun run src/index.ts &
cd apps/web && bun run dev &
```

- [ ] **Step 2: Test login**

```bash
curl -v -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' 2>&1 | grep -E "HTTP|Set-Cookie|\"id\""
```

Expected: `200 OK`, `Set-Cookie: better-auth.session_token=...`, user id is a UUID string.

- [ ] **Step 3: Test /me**

```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/me | jq '{id: .user.id, email: .user.email}'
```

Expected: `id` is a UUID string, not a number.

- [ ] **Step 4: Test logout + verify session revoked**

```bash
curl -s -b /tmp/cookies.txt -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/sign-out
curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/me | jq .user
```

Expected: `null` — session is gone immediately.

- [ ] **Step 5: Test passkey registration in the browser**

Open the app, log in, register a new passkey. Verify in DB:

```bash
psql $DATABASE_URL -c "SELECT id, name, created_at FROM ba_passkeys;"
```

Expected: One row.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: verify better-auth login/logout/passkey flow end-to-end"
```

---

## Task 10: Add Authentik OIDC as an Integration

Authentik SSO follows the same pattern as every other Hously external service: config lives in the `integrations` table, editable via the admin UI, no env vars required. `apps/api/src/lib/auth.ts` loads it from the DB at startup using top-level await. **Config changes require a server restart** — expected behaviour for a homelab deployment.

**Files:**

- Create: `apps/api/src/routes/integrations/authentik/index.ts`
- Modify: `apps/api/src/routes/integrations/index.ts`
- Modify: `apps/web/src/` (login page — add conditional sign-in button)

- [ ] **Step 1: Create `apps/api/src/routes/integrations/authentik/index.ts`**

```typescript
import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getIntegrationConfigRecord,
  invalidateIntegrationConfigCache,
} from "@hously/api/services/integrationConfigCache";
import { nowUtc } from "@hously/api/utils";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import { logActivity } from "@hously/api/utils/activityLogs";

type AuthentikConfig = {
  issuer_url: string;
  client_id: string;
  client_secret: string;
};

function normalizeAuthentikConfig(config: unknown): AuthentikConfig | null {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const c = config as Record<string, unknown>;
  const issuer_url = typeof c.issuer_url === "string" ? c.issuer_url : "";
  const client_id = typeof c.client_id === "string" ? c.client_id : "";
  const client_secret =
    typeof c.client_secret === "string" ? c.client_secret : "";
  if (!issuer_url || !client_id || !client_secret) return null;
  return { issuer_url, client_id, client_secret };
}

export const authentikIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)

  .get("/authentik", async ({ set }) => {
    try {
      const integration = await getIntegrationConfigRecord("authentik");
      const config = normalizeAuthentikConfig(integration?.config);
      return {
        integration: {
          type: "authentik",
          enabled: integration?.enabled || false,
          issuer_url: config?.issuer_url || "",
          client_id: config?.client_id || "",
          client_secret_set: Boolean(config?.client_secret),
        },
      };
    } catch {
      return serverError(set, "Failed to fetch Authentik integration config");
    }
  })

  .put(
    "/authentik",
    async ({ user, body, set }) => {
      const issuer_url = body.issuer_url.trim().replace(/\/$/, "");
      const client_id = body.client_id.trim();

      if (!issuer_url || !/^https?:\/\//.test(issuer_url)) {
        return badRequest(set, "issuer_url must be a valid http(s) URL");
      }
      if (!client_id) {
        return badRequest(set, "client_id is required");
      }

      try {
        const existing = await getIntegrationConfigRecord("authentik");
        const existingConfig = normalizeAuthentikConfig(existing?.config);
        const clientSecret =
          body.client_secret?.trim() || existingConfig?.client_secret || "";

        if (!clientSecret) {
          return badRequest(set, "client_secret is required");
        }

        const enabled: boolean = body.enabled ?? existing?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          issuer_url,
          client_id,
          client_secret: encrypt(clientSecret),
        };

        await prisma.integration.upsert({
          where: { type: "authentik" },
          update: { enabled, config, updatedAt: nowUtc() },
          create: {
            type: "authentik",
            enabled,
            config,
            createdAt: nowUtc(),
            updatedAt: nowUtc(),
          },
        });
        await invalidateIntegrationConfigCache("authentik");

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "authentik" },
        });

        return {
          success: true,
          integration: {
            type: "authentik",
            enabled,
            issuer_url,
            client_id,
            client_secret_set: true,
          },
        };
      } catch {
        return serverError(set, "Failed to save Authentik integration config");
      }
    },
    {
      body: t.Object({
        issuer_url: t.String(),
        client_id: t.String(),
        client_secret: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
```

- [ ] **Step 2: Register in `apps/api/src/routes/integrations/index.ts`**

```typescript
import { authentikIntegrationRoutes } from "./authentik";

export const integrationsRoutes = new Elysia({ prefix: "/api/integrations" })
  // ... existing .use() calls ...
  .use(authentikIntegrationRoutes);
```

- [ ] **Step 3: Configure Authentik in the Authentik admin panel**

1. Create a new OAuth2/OpenID Provider
2. Set redirect URI: `https://hously.yourdomain.com/api/auth/callback/authentik`
3. Copy Client ID and Client Secret
4. Note the issuer URL (format: `https://auth.yourdomain.com/application/o/<slug>`)

Then in the Hously admin UI → Settings → Integrations → Authentik, fill in `issuer_url`, `client_id`, and `client_secret`. Save, then **restart the API server** so `lib/auth.ts` loads the new config.

- [ ] **Step 4: Verify the provider loaded**

```bash
curl -s http://localhost:3000/api/auth/list-providers | jq .
```

Expected: `"authentik"` appears in the providers list. If not, confirm the integration row has `enabled: true` and restart.

- [ ] **Step 5: Add the sign-in button to the login page**

Render the button conditionally — only when Authentik is active:

```typescript
import { authClient } from "@/lib/auth/betterAuthClient";
import { useQuery } from "@tanstack/react-query";

const { data: providers } = useQuery({
  queryKey: ["auth", "providers"],
  queryFn: () => authClient.$fetch("/api/auth/list-providers"),
});

const authentikEnabled = providers?.some(
  (p: { id: string }) => p.id === "authentik",
);

// In JSX:
{authentikEnabled && (
  <button
    type="button"
    onClick={() =>
      authClient.signIn.social({
        provider: "authentik",
        callbackURL: "/dashboard",
      })
    }
  >
    Sign in with Authentik
  </button>
)}
```

- [ ] **Step 6: End-to-end test**

Open the login page, click "Sign in with Authentik", complete the Authentik flow, verify you land on `/dashboard` and `/api/auth/me` returns your user with a UUID string `id`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/integrations/authentik/ \
        apps/api/src/routes/integrations/index.ts \
        apps/web/src/
git commit -m "feat(auth): add Authentik OIDC as a first-class Integration"
```

---

## Task 11: Cleanup — remove old packages, tables, and files

Run this task only after Task 9 passes completely.

- [ ] **Step 1: Remove old packages**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bun remove @elysiajs/jwt @elysiajs/cookie @simplewebauthn/server

cd /home/samuelloranger/sites/hously/apps/web
bun remove @simplewebauthn/browser
```

- [ ] **Step 2: Delete obsolete source files**

```bash
rm /home/samuelloranger/sites/hously/apps/api/src/utils/session.ts
```

Check if `utils/tokens.ts` is still used by the invitation flow before deleting:

```bash
grep -r "utils/tokens" /home/samuelloranger/sites/hously/apps/api/src/ --include="*.ts"
```

Keep it if referenced by `auth.ts` (invitation token hashing). Delete if not.

- [ ] **Step 3: Remove old auth tables from schema.prisma**

Remove these models entirely:

- `model RefreshToken { ... }`
- `model PasswordResetToken { ... }`
- `model WebAuthnCredential { ... }`

Remove `authVersion` from the `User` model.
Remove `passwordResetTokens`, `refreshTokens`, `passkeyCredentials` relations from `User`.

- [ ] **Step 4: Run the cleanup migration**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bunx prisma migrate dev --name remove_old_auth_tables
```

- [ ] **Step 5: Final compile check**

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit 2>&1 | grep -v node_modules | head -20
cd /home/samuelloranger/sites/hously/apps/web && bunx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: No errors.

- [ ] **Step 6: Run all tests**

```bash
cd /home/samuelloranger/sites/hously/apps/api
bun test 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore(auth): remove old JWT packages, auth tables, and source files"
```

---

## Self-Review

**Spec coverage:**

- ✅ Full `Int → String` UUID conversion — no bridge columns, atomic SQL migration
- ✅ Database sessions (immediately revocable) — `ba_sessions` table, no JWT
- ✅ Existing password hashes work — custom `verify` function reuses `verifyPassword()` from `utils/password.ts`
- ✅ Passkeys — better-auth passkey plugin replaces @simplewebauthn
- ✅ Invitation system — stays as a custom `publicAuthRoutes` Elysia plugin (no auth required)
- ✅ `/me` returns Hously-shaped user — custom `protectedAuthRoutes` plugin (requireUser applies)
- ✅ Authentik OIDC — first-class Integration stored in `integrations` table; `genericOAuth` loaded from DB at startup, no env vars
- ✅ `name → firstName` hack eliminated — `name: false`, `additionalFields` for `firstName`/`lastName`, `mapProfileToUser` splits OIDC claims correctly
- ✅ No `@ts-ignore` — cookie forwarding uses explicit `Record<string, string>` cast
- ✅ SQL migration is transactional — `BEGIN`/`COMMIT` wraps all 200+ statements
- ✅ Consistent UUID format — `@default(uuid())` on `users.id` matches `gen_random_uuid()` in SQL and `crypto.randomUUID()` in better-auth
- ✅ `ba_accounts` credential entry created atomically with the user in the invitation flow
- ✅ String IDs propagated — shared `User` type, `mapUser`, `buildUserMap` all updated

**Risks to note:**

- Existing `webauthn_credentials` rows are NOT migrated — users must re-register passkeys. Add a UI notice on the security settings page.
- All active user sessions (JWT cookies named `auth`) become invalid after migration. Users will be logged out and must sign in again. This is expected.
- The `sendPasswordResetEmail` signature in `emailService.ts` may need adjustment — better-auth passes a full `url` string, not a raw token. Verify it matches your email template before Task 9.
- The SQL migration in Task 2 should be run on a DB backup first in production.
- Authentik OIDC config changes via the admin UI require a server restart to take effect (the `auth.ts` module reads the DB once at startup via top-level await).
