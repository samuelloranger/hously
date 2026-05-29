-- AlterTable
ALTER TABLE "quality_profiles" ADD COLUMN "min_seeders" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "custom_formats" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_profile_custom_formats" (
    "id" SERIAL NOT NULL,
    "quality_profile_id" INTEGER NOT NULL,
    "custom_format_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "forbidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quality_profile_custom_formats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_formats_name_key" ON "custom_formats"("name");

-- CreateIndex
CREATE INDEX "ix_qp_custom_format_profile" ON "quality_profile_custom_formats"("quality_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_profile_custom_formats_quality_profile_id_custom_fo_key" ON "quality_profile_custom_formats"("quality_profile_id", "custom_format_id");

-- AddForeignKey
ALTER TABLE "quality_profile_custom_formats" ADD CONSTRAINT "quality_profile_custom_formats_quality_profile_id_fkey" FOREIGN KEY ("quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_profile_custom_formats" ADD CONSTRAINT "quality_profile_custom_formats_custom_format_id_fkey" FOREIGN KEY ("custom_format_id") REFERENCES "custom_formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
