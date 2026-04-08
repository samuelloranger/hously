-- CreateTable
CREATE TABLE "library_media" (
    "id" SERIAL NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_title" TEXT,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'wanted',
    "poster_url" TEXT,
    "overview" TEXT,
    "digital_release_date" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_episodes" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "title" TEXT,
    "air_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'wanted',
    "tmdb_episode_id" INTEGER,
    "downloaded_at" TIMESTAMP(3),

    CONSTRAINT "library_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER,
    "episode_id" INTEGER,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "duration_secs" DOUBLE PRECISION,
    "release_group" TEXT,
    "video_codec" TEXT,
    "video_profile" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "frame_rate" DOUBLE PRECISION,
    "bit_depth" INTEGER,
    "video_bitrate" INTEGER,
    "hdr_format" TEXT,
    "resolution" INTEGER,
    "source" TEXT,
    "audio_tracks" JSONB NOT NULL DEFAULT '[]',
    "subtitle_tracks" JSONB NOT NULL DEFAULT '[]',
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "library_media_tmdb_id_key" ON "library_media"("tmdb_id");

-- CreateIndex
CREATE INDEX "ix_library_media_type" ON "library_media"("type");

-- CreateIndex
CREATE INDEX "ix_library_media_status" ON "library_media"("status");

-- CreateIndex
CREATE UNIQUE INDEX "library_episodes_media_id_season_episode_key" ON "library_episodes"("media_id", "season", "episode");

-- CreateIndex
CREATE INDEX "ix_library_episodes_media_id" ON "library_episodes"("media_id");

-- CreateIndex
CREATE INDEX "ix_media_files_media_id" ON "media_files"("media_id");

-- CreateIndex
CREATE INDEX "ix_media_files_episode_id" ON "media_files"("episode_id");

-- AddForeignKey
ALTER TABLE "library_episodes" ADD CONSTRAINT "library_episodes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "library_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "library_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "library_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
