# Session Enrichment & Provider Icons — Design Spec

**Date:** 2026-05-05  
**Status:** Approved

## Overview

Enrich the admin Sessions tab with IP address, geolocation, device/browser info, and the auth provider used per session. Add an optional icon to OIDC providers, displayed in the SSO settings tab, the login page, and the sessions list.

---

## Schema Changes

### `BaSession` — add `provider_id`

```prisma
provider_id String? @map("provider_id")
```

- Nullable. Populated at sign-in time via better-auth `after` hooks.
- Value: `"credential"` for email/password, or the OIDC provider slug (e.g. `"google"`, `"authentik"`) for SSO logins.

### `OidcProvider` — add `icon_url`

```prisma
icon_url String? @map("icon_url")
```

- Nullable. Admin pastes any publicly accessible image URL.
- Displayed anywhere the provider is shown; silently omitted if absent.

### Migration

Single migration covering both columns:

```sql
ALTER TABLE "ba_sessions" ADD COLUMN "provider_id" TEXT;
ALTER TABLE "oidc_providers" ADD COLUMN "icon_url" TEXT;
```

---

## Backend

### Provider tracking — better-auth `after` hooks

better-auth exposes path-scoped `after` hooks. Two hooks are added in `apps/api/src/lib/auth.ts`:

| Path matched | `provider_id` value set |
|---|---|
| `/sign-in/email` | `"credential"` |
| `/oauth2/callback/:providerId` (dynamic) | the `:providerId` slug from the path |

Each hook reads the session token from the response cookies/body, then runs:
```sql
UPDATE ba_sessions SET provider_id = $1 WHERE token = $2
```

### Geolocation — `geoip-lite`

- Installed in `apps/api`.
- Called at query time in `GET /api/admin/sessions` — never stored in DB.
- Input: `ip_address` from `BaSession`.
- Output: `{ city: string | null, country: string | null }`.
- Private/local IPs (127.x, 10.x, 192.168.x) return `null` gracefully.

### User-agent parsing — `ua-parser-js`

- Installed in `apps/api`.
- Called at query time in the same handler.
- Input: raw `user_agent` string from `BaSession`.
- Output: `{ browser: string | null, os: string | null }` (name only, no version).

### API changes

**`GET /api/admin/sessions`** — extended response shape:

```typescript
{
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  created_at: string;
  expires_at: string;
  ip_address: string | null;
  provider_id: string | null;
  location: { city: string | null; country: string | null } | null;
  device: { browser: string | null; os: string | null } | null;
}
```

**`GET /api/auth/sso-providers`** — add `icon_url` to response:

```typescript
{ providers: { slug: string; name: string; icon_url: string | null }[] }
```

**`PUT /api/integrations/oidc/:id`** — accept optional `icon_url` field.

**`POST /api/integrations/oidc`** — accept optional `icon_url` field.

---

## Frontend

### Shared type update (`@hously/shared`)

`OidcProvider` interface gains `icon_url: string | null`.

### Sessions tab (`SessionsTab.tsx`)

Each session row gains:

- **Provider badge** (left of user info): small icon if the provider is a known OIDC slug with `icon_url`; key icon for `"credential"`; shield icon for OIDC without an icon.
- **Location**: country flag emoji + city (e.g. `🇨🇦 Montréal`). Hidden if null.
- **Device**: browser + OS as a small muted string (e.g. `Chrome · macOS`). Hidden if null.
- **IP address**: shown in monospace, small, muted. Hidden if null.

Provider icon data is resolved by cross-referencing `provider_id` against the OIDC providers list (already fetched via `useOidcProviders`).

### SSO settings tab (`OidcProvidersTab.tsx`)

- **`ProviderForm`**: add optional `icon_url` text input below the slug field. Shows a live preview thumbnail if the URL is non-empty.
- **`ProviderRow`**: show `<img>` (24×24, rounded) to the left of the provider name if `icon_url` is set.

### Login page (`LoginForm.tsx`)

Each SSO button shows `<img>` (20×20) to the left of the label if `icon_url` is set for that provider. No change to button layout otherwise.

---

## Out of scope

- Storing location in DB (computed at query time is sufficient).
- Automatic favicon detection (user provides the URL explicitly).
- Showing provider info on the user's own session (non-admin view).
- Per-session "last active" timestamp.
