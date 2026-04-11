-- AlterTable
ALTER TABLE "quality_profiles" ADD COLUMN "prioritized_trackers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "quality_profiles" ADD COLUMN "prefer_tracker_over_quality" BOOLEAN NOT NULL DEFAULT false;
