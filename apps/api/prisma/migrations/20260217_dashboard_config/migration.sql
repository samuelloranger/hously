ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "dashboard_config" JSONB;

