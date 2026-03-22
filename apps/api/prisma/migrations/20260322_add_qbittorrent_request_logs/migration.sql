CREATE TABLE "qbittorrent_request_logs" (
    "id" SERIAL NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "request_path" VARCHAR(512) NOT NULL,
    "status_code" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER NOT NULL,
    "response_bytes" INTEGER,
    "auth_retried" BOOLEAN NOT NULL DEFAULT false,
    "rid" INTEGER,
    "full_update" BOOLEAN,
    "item_count" INTEGER,
    "removed_count" INTEGER,
    "error_message" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qbittorrent_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_qbittorrent_request_logs_created_at" ON "qbittorrent_request_logs"("created_at");
CREATE INDEX "ix_qbittorrent_request_logs_endpoint_created_at" ON "qbittorrent_request_logs"("endpoint", "created_at");
CREATE INDEX "ix_qbittorrent_request_logs_ok_created_at" ON "qbittorrent_request_logs"("ok", "created_at");
