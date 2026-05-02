ALTER TABLE "library_media" ADD COLUMN "tmdb_status_refreshed_at" TIMESTAMP(3);

CREATE TABLE "library_health_log" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,

    CONSTRAINT "library_health_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_library_health_log_started_at" ON "library_health_log"("started_at");
