-- CreateTable
CREATE TABLE "live_activity_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "live_activity_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ix_live_activity_tokens_token" ON "live_activity_tokens"("token");

-- CreateIndex
CREATE INDEX "ix_live_activity_tokens_user_id" ON "live_activity_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "live_activity_tokens" ADD CONSTRAINT "live_activity_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
