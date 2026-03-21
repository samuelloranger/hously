-- Add type column to live_activity_tokens for filtering push-to-start vs other tokens
ALTER TABLE "live_activity_tokens" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'habit_start';

-- Create index on type for efficient filtering
CREATE INDEX "ix_live_activity_tokens_type" ON "live_activity_tokens"("type");

-- Add activity_push_token to media_conversion_jobs for server-side Live Activity updates
ALTER TABLE "media_conversion_jobs" ADD COLUMN "activity_push_token" TEXT;
