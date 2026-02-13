CREATE TABLE IF NOT EXISTS "plugins" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ix_plugins_type" ON "plugins" ("type");
