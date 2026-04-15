-- Add monitored flag to library_media and library_episodes
ALTER TABLE "library_media" ADD COLUMN "monitored" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "library_episodes" ADD COLUMN "monitored" BOOLEAN NOT NULL DEFAULT true;
