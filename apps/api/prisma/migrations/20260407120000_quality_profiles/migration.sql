-- CreateTable
CREATE TABLE "quality_profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "min_resolution" INTEGER NOT NULL DEFAULT 1080,
    "preferred_sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_codecs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_size_gb" DOUBLE PRECISION,
    "require_hdr" BOOLEAN NOT NULL DEFAULT false,
    "prefer_hdr" BOOLEAN NOT NULL DEFAULT false,
    "cutoff_resolution" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quality_profiles_name_key" ON "quality_profiles"("name");

-- AlterTable
ALTER TABLE "library_media" ADD COLUMN "quality_profile_id" INTEGER;

-- CreateIndex
CREATE INDEX "ix_library_media_quality_profile_id" ON "library_media"("quality_profile_id");

-- AddForeignKey
ALTER TABLE "library_media" ADD CONSTRAINT "library_media_quality_profile_id_fkey" FOREIGN KEY ("quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default profile for new installs
INSERT INTO "quality_profiles" ("name", "min_resolution", "preferred_sources", "preferred_codecs", "max_size_gb", "require_hdr", "prefer_hdr", "cutoff_resolution", "created_at", "updated_at")
VALUES (
    'Standard 1080p',
    1080,
    ARRAY['BluRay', 'WEB-DL', 'WEBRip', 'REMUX']::TEXT[],
    ARRAY['x265', 'x264', 'AV1']::TEXT[],
    NULL,
    false,
    false,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
