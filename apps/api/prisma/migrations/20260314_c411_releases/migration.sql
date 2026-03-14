-- CreateTable
CREATE TABLE "c411_releases" (
    "id" SERIAL NOT NULL,
    "c411_torrent_id" INTEGER,
    "info_hash" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "tmdb_id" INTEGER,
    "imdb_id" TEXT,
    "tmdb_type" TEXT,
    "category_id" INTEGER,
    "subcategory_id" INTEGER,
    "category_name" TEXT,
    "subcategory_name" TEXT,
    "language" TEXT,
    "resolution" TEXT,
    "source" TEXT,
    "video_codec" TEXT,
    "audio_codec" TEXT,
    "size" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'local',
    "seeders" INTEGER,
    "leechers" INTEGER,
    "completions" INTEGER,
    "torrent_s3_key" TEXT,
    "nfo_content" TEXT,
    "hardlink_path" TEXT,
    "original_path" TEXT,
    "options" JSONB,
    "tmdb_data" JSONB,
    "metadata" JSONB,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "c411_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "c411_presentations" (
    "id" SERIAL NOT NULL,
    "release_id" INTEGER NOT NULL,
    "bbcode" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "c411_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "c411_releases_c411_torrent_id_key" ON "c411_releases"("c411_torrent_id");

-- CreateIndex
CREATE UNIQUE INDEX "c411_releases_info_hash_key" ON "c411_releases"("info_hash");

-- CreateIndex
CREATE INDEX "ix_c411_releases_tmdb_id" ON "c411_releases"("tmdb_id");

-- CreateIndex
CREATE INDEX "ix_c411_releases_status" ON "c411_releases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "c411_presentations_release_id_key" ON "c411_presentations"("release_id");

-- AddForeignKey
ALTER TABLE "c411_presentations" ADD CONSTRAINT "c411_presentations_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "c411_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
