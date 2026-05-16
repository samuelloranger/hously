-- AlterTable
ALTER TABLE "media_files" ADD COLUMN "audio_format" TEXT;
ALTER TABLE "media_files" ADD COLUMN "is_proper" BOOLEAN NOT NULL DEFAULT false;
