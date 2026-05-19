CREATE INDEX IF NOT EXISTS "ix_notifications_user_id_read_created_at"
ON "notifications" ("user_id", "read", "created_at" DESC);
