-- CreateTable
CREATE TABLE "library_attention_alerts" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "episode_id" INTEGER,
    "season" INTEGER,
    "scope_type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detail" TEXT,
    "download_history_id" INTEGER,
    "search_attempts" INTEGER,
    "grabbed_at" TIMESTAMP(3),
    "library_status_snapshot" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_attention_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_library_attention_alert_media_id" ON "library_attention_alerts"("media_id");

-- CreateIndex
CREATE INDEX "ix_library_attention_alert_status" ON "library_attention_alerts"("status");

-- AddForeignKey
ALTER TABLE "library_attention_alerts" ADD CONSTRAINT "library_attention_alerts_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "library_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_attention_alerts" ADD CONSTRAINT "library_attention_alerts_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "library_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one *open* alert per logical target + issue kind (TV scope follows pack vs episode).
CREATE UNIQUE INDEX "library_attention_alert_open_dedupe" ON "library_attention_alerts" (
    "media_id",
    "kind",
    "scope_type",
    COALESCE("episode_id", -1),
    COALESCE("season", -1)
) WHERE "status" = 'open';
