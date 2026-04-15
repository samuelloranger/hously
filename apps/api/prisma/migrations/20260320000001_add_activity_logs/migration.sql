-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "user_id" INTEGER,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_activity_logs_created_at" ON "activity_logs"("created_at");
CREATE INDEX "ix_activity_logs_type" ON "activity_logs"("type");
CREATE INDEX "ix_activity_logs_user_id" ON "activity_logs"("user_id");

ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
