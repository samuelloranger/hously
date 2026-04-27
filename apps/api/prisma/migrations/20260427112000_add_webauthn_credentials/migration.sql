-- Make password optional for passkey-only accounts
ALTER TABLE "users"
ALTER COLUMN "password_hash" DROP NOT NULL;

-- Store WebAuthn credentials per user
CREATE TABLE "webauthn_credentials" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "device_type" TEXT NOT NULL DEFAULT 'singleDevice',
  "backed_up" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key"
  ON "webauthn_credentials"("credential_id");

CREATE INDEX "ix_webauthn_credentials_user_id"
  ON "webauthn_credentials"("user_id");

ALTER TABLE "webauthn_credentials"
ADD CONSTRAINT "webauthn_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
