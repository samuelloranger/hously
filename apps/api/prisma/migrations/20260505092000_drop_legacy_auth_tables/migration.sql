DROP TABLE IF EXISTS "password_reset_tokens";
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "webauthn_credentials";

ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_version";
