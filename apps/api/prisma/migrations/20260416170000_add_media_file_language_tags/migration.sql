-- AlterTable
ALTER TABLE "media_files"
  ADD COLUMN "language_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "ix_media_files_language_tags" ON "media_files" USING GIN ("language_tags");
