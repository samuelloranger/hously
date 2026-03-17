-- CreateTable
CREATE TABLE "media_conversion_jobs" (
    "id" SERIAL NOT NULL,
    "service" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "source_title" TEXT,
    "preset" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requested_by_user_id" INTEGER,
    "input_path" TEXT NOT NULL,
    "output_path" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_seconds" DOUBLE PRECISION,
    "processed_seconds" DOUBLE PRECISION,
    "eta_seconds" INTEGER,
    "fps" DOUBLE PRECISION,
    "speed" TEXT,
    "error_message" TEXT,
    "validation_summary" JSONB,
    "probe_data" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "media_conversion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_media_conversion_jobs_source" ON "media_conversion_jobs"("service", "source_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_media_conversion_jobs_status" ON "media_conversion_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "ix_media_conversion_jobs_requested_by_user_id" ON "media_conversion_jobs"("requested_by_user_id");

-- AddForeignKey
ALTER TABLE "media_conversion_jobs" ADD CONSTRAINT "media_conversion_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
