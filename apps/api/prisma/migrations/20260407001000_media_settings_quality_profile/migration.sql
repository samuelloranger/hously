ALTER TABLE "media_settings" ADD COLUMN "default_quality_profile_id" INTEGER;
ALTER TABLE "media_settings" ADD CONSTRAINT "media_settings_default_quality_profile_id_fkey" FOREIGN KEY ("default_quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
