-- Add index on media_files.file_path to avoid full table scans on findFirst by path
CREATE INDEX IF NOT EXISTS "ix_media_files_file_path" ON "media_files"("file_path");
