CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_ext_notif_logs_created_at"
ON "external_notification_service_logs" ("created_at" DESC);
