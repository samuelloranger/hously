CREATE TABLE "ba_sessions" (
  "id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "ba_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ba_accounts" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ba_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ba_verifications" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ba_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ba_passkeys" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "public_key" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "device_type" TEXT NOT NULL,
  "backed_up" BOOLEAN NOT NULL,
  "transports" TEXT,
  "created_at" TIMESTAMP(3),
  "aaguid" TEXT,
  CONSTRAINT "ba_passkeys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ba_sessions_token_key" ON "ba_sessions"("token");
CREATE INDEX "ix_ba_sessions_user_id" ON "ba_sessions"("user_id");
CREATE INDEX "ix_ba_accounts_user_id" ON "ba_accounts"("user_id");
CREATE INDEX "ix_ba_passkeys_credential_id" ON "ba_passkeys"("credential_id");
CREATE INDEX "ix_ba_passkeys_user_id" ON "ba_passkeys"("user_id");

ALTER TABLE "ba_sessions" ADD CONSTRAINT "ba_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ba_accounts" ADD CONSTRAINT "ba_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ba_passkeys" ADD CONSTRAINT "ba_passkeys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ba_accounts" (
  "id",
  "account_id",
  "provider_id",
  "user_id",
  "password",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  "email",
  'credential',
  "id",
  "password_hash",
  COALESCE("created_at", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "users"
WHERE "password_hash" IS NOT NULL
ON CONFLICT DO NOTHING;
