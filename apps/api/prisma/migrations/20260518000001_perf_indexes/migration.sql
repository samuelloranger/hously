-- Composite index replaces three single-column indexes on notification_templates
DROP INDEX IF EXISTS "ix_notification_templates_event_type";
DROP INDEX IF EXISTS "ix_notification_templates_language";
DROP INDEX IF EXISTS "ix_notification_templates_service_id";
CREATE INDEX IF NOT EXISTS "ix_notification_templates_service_event_lang" ON "notification_templates"("service_id", "event_type", "language");

-- Missing FK / filter-column indexes
CREATE INDEX IF NOT EXISTS "ix_custom_events_user_id" ON "custom_events"("user_id");
CREATE INDEX IF NOT EXISTS "ix_reminders_chore_id" ON "reminders"("chore_id");
CREATE INDEX IF NOT EXISTS "ix_reminders_user_id" ON "reminders"("user_id");
CREATE INDEX IF NOT EXISTS "ix_task_completions_user_id" ON "task_completions"("user_id");
CREATE INDEX IF NOT EXISTS "ix_board_task_activities_user_id" ON "board_task_activities"("user_id");
CREATE INDEX IF NOT EXISTS "ix_chores_added_by" ON "chores"("added_by");
CREATE INDEX IF NOT EXISTS "ix_chores_assigned_to" ON "chores"("assigned_to");
CREATE INDEX IF NOT EXISTS "ix_chores_completed_by" ON "chores"("completed_by");
