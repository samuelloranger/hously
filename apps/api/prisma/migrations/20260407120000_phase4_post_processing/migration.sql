-- AlterTable
ALTER TABLE "download_history" ADD COLUMN "post_process_error" TEXT,
ADD COLUMN "post_process_destination_path" TEXT;

-- CreateTable
CREATE TABLE "media_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "movies_library_path" TEXT,
    "shows_library_path" TEXT,
    "file_operation" TEXT NOT NULL DEFAULT 'hardlink',
    "movie_template" TEXT NOT NULL DEFAULT '{title} ({year}) [{resolution} {source}]',
    "episode_template" TEXT NOT NULL DEFAULT '{show}/Season {season}/{show} - S{season:02}E{episode:02} - {title} [{resolution} {source}]',
    "min_seed_ratio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "post_processing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "media_settings" (
    "id",
    "file_operation",
    "movie_template",
    "episode_template",
    "min_seed_ratio",
    "post_processing_enabled",
    "updated_at"
) VALUES (
    1,
    'hardlink',
    '{title} ({year}) [{resolution} {source}]',
    '{show}/Season {season}/{show} - S{season:02}E{episode:02} - {title} [{resolution} {source}]',
    1.0,
    false,
    CURRENT_TIMESTAMP
);
