-- AlterTable
ALTER TABLE "library_media" ADD COLUMN "search_attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "library_episodes" ADD COLUMN "search_attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "download_history" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER,
    "episode_id" INTEGER,
    "release_title" TEXT NOT NULL,
    "indexer" TEXT,
    "torrent_hash" TEXT,
    "download_url" TEXT,
    "quality_parsed" JSONB,
    "grabbed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "fail_reason" TEXT,

    CONSTRAINT "download_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_download_history_torrent_hash" ON "download_history"("torrent_hash");

-- CreateIndex
CREATE INDEX "ix_download_history_media_id" ON "download_history"("media_id");

-- AddForeignKey
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "library_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "library_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
