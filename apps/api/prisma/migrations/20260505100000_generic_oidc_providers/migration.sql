-- Create oidc_providers table
CREATE TABLE "oidc_providers" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "slug"         TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "discovery_url" TEXT NOT NULL,
    "client_id"    TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "enabled"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oidc_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oidc_providers_slug_key" ON "oidc_providers"("slug");

-- Migrate existing Authentik config from integrations table
-- The stored config has: issuer_url, client_id, client_secret, (enabled is top-level)
-- discovery_url is derived as issuer_url + /.well-known/openid-configuration
INSERT INTO "oidc_providers" ("id", "slug", "name", "discovery_url", "client_id", "client_secret", "enabled", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    'authentik',
    'Authentik',
    rtrim(config->>'issuer_url', '/') || '/.well-known/openid-configuration',
    config->>'client_id',
    config->>'client_secret',
    enabled,
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM "integrations"
WHERE type = 'authentik'
  AND config->>'issuer_url' IS NOT NULL
  AND config->>'client_id' IS NOT NULL
  AND config->>'client_secret' IS NOT NULL;

-- Remove Authentik from integrations table
DELETE FROM "integrations" WHERE type = 'authentik';
