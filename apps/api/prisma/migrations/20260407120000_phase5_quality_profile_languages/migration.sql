ALTER TABLE "quality_profiles" ADD COLUMN "preferred_languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
