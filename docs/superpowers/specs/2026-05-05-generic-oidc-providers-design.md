# Generic OIDC Providers

**Date:** 2026-05-05
**Status:** Approved

## Problem

Hously has a hardcoded Authentik integration. Self-hosters use many different identity providers (Authelia, Keycloak, Pocket ID, Zitadel, Kanidm, etc.) — all of which speak standard OIDC. The goal is to replace the Authentik-specific integration with a generic OIDC provider system that supports any number of OIDC-compliant providers.

## Design Decisions

- **User-defined slug**: Each provider has a user-defined URL-safe slug (e.g. `authentik`, `authelia`) that appears in the callback URL `/api/auth/oauth2/callback/{slug}`. Slug is immutable after creation — changing it breaks the redirect URI configured in the IdP.
- **Dedicated table**: OIDC providers live in their own `oidc_providers` table, separate from the generic `integrations` table.
- **No extra config**: Fields are minimal — name, slug, discovery URL, client ID, client secret. No icon URL, no custom scopes, no PKCE toggle (PKCE always enabled, scopes always `openid email profile`).
- **Sign-up disabled**: `disableSignUp: true` on all providers — only existing Hously users can sign in via OIDC.
- **Own settings page**: OIDC providers get their own page under the Integrations section of Settings, not a card inside the existing Integrations tab.

## Database

New model replacing the `authentik` row in `integrations`:

```prisma
model OidcProvider {
  id           String   @id @default(uuid())
  slug         String   @unique
  name         String
  discoveryUrl String   @map("discovery_url")
  clientId     String   @map("client_id")
  clientSecret String   @map("client_secret")  // AES-encrypted at rest
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("oidc_providers")
}
```

**Migration steps:**

1. Create `oidc_providers` table.
2. Read the existing `authentik` row from `integrations`.
3. Insert into `oidc_providers` with `slug: "authentik"`, `name: "Authentik"`. The current config JSON stores `issuer_url` — derive `discovery_url` as `{issuer_url}/.well-known/openid-configuration`. Copy `client_id`, `client_secret` (already encrypted), and `enabled` directly.
4. Delete the `authentik` row from `integrations`.

## Backend

### `apps/api/src/lib/auth.ts`

Replace the Authentik-specific loader with a generic one:

- `loadOidcProviders()` — fetches all enabled `OidcProvider` rows, maps each to a `genericOAuth` config entry with `providerId: slug`, `discoveryUrl`, PKCE enabled, `disableSignUp: true`, and standard `mapProfileToUser` using `name`, `given_name`, `family_name` claims.
- `oidcProviderConfigs` — shared mutable array passed to `genericOAuth({ config: oidcProviderConfigs })`.
- `refreshOidcProviders()` — clears and repopulates `oidcProviderConfigs` from the DB; called after any create/update/delete.

### `apps/api/src/routes/integrations/oidc/index.ts` (new, admin-only)

| Method   | Path                         | Description                                                                 |
| -------- | ---------------------------- | --------------------------------------------------------------------------- |
| `GET`    | `/api/integrations/oidc`     | List all providers (secret masked as boolean `client_secret_set`)           |
| `POST`   | `/api/integrations/oidc`     | Create provider — validates slug is URL-safe (`/^[a-z0-9-]+$/`) and unique  |
| `PUT`    | `/api/integrations/oidc/:id` | Update name, discoveryUrl, clientId, clientSecret, enabled — slug immutable |
| `DELETE` | `/api/integrations/oidc/:id` | Delete provider, refresh config                                             |

All mutating routes call `refreshOidcProviders()` after DB write.

### `apps/api/src/auth.ts` — `ssoProvidersRoute`

Return type changes from `{ authentik: boolean }` to `{ providers: { slug: string; name: string }[] }`. Returns only enabled providers. No auth required (needed by the public login page).

### Removed

- `apps/api/src/routes/integrations/authentik/index.ts` — deleted entirely.

## Frontend

### Login page

`useSSOProviders` return type updated to `{ providers: { slug: string; name: string }[] }`. `LoginForm.tsx` maps over the array — one button per provider, label is `name`, calls `authClient.signIn.oauth2({ providerId: slug, callbackURL: "/" })`. The "or" divider shows when there are any providers or when passkeys are supported. Remove all hardcoded Authentik references.

### New settings page — `apps/web/src/pages/settings/oidc-providers/`

List view:

- Table/list of configured providers showing name, slug, enabled status.
- "Add provider" button opens an inline or modal form.
- Each row has Edit and Delete actions.

Add/Edit form fields:

- **Name** — display label on the login button (e.g. `Authentik`)
- **Slug** — URL-safe ID for callback URL; read-only after creation; shown with the full redirect URI below it: `{baseUrl}/api/auth/oauth2/callback/{slug}` with a copy button
- **Discovery URL** — OIDC discovery endpoint (e.g. `https://authentik.example.com/application/o/hously/.well-known/openid-configuration`)
- **Client ID**
- **Client Secret** — password input; shows "already set" placeholder when a secret is saved and the field is left blank on edit

Page is admin-only, linked from the Settings navigation under Integrations.

### Shared package (`apps/shared`)

- `AUTH_ENDPOINTS.SSO_PROVIDERS` response type annotation updated to `{ providers: { slug: string; name: string }[] }`.
- `queryKeys.auth.ssoProviders()` return type updated accordingly.

### Removed

- `apps/web/src/pages/settings/_component/integrations/AuthentikIntegrationSection.tsx` — deleted.
- All `useAuthentikIntegration` / `useUpdateAuthentikIntegration` hooks.
- Authentik-specific i18n keys.

## Out of Scope

- Custom scopes per provider
- Provider icons / logo URLs
- Slug editing after creation (requires IdP reconfiguration — users delete and recreate instead)
- Forward-auth / trusted proxy header support (a separate future feature)
