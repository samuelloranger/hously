-- AlterTable
ALTER TABLE "users" ADD COLUMN "calendar_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ix_users_calendar_token" ON "users"("calendar_token");
