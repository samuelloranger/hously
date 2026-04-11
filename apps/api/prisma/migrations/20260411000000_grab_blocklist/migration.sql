-- CreateTable
CREATE TABLE "grab_blocklist" (
    "id" SERIAL NOT NULL,
    "torrent_hash" TEXT,
    "release_title" TEXT NOT NULL,
    "indexer" TEXT,
    "media_id" INTEGER,
    "episode_id" INTEGER,
    "reason" TEXT,
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grab_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_grab_blocklist_hash" ON "grab_blocklist"("torrent_hash");

-- CreateIndex
CREATE INDEX "ix_grab_blocklist_media_id" ON "grab_blocklist"("media_id");

-- AddForeignKey
ALTER TABLE "grab_blocklist" ADD CONSTRAINT "grab_blocklist_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "library_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grab_blocklist" ADD CONSTRAINT "grab_blocklist_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "library_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
