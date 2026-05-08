CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "country_code" VARCHAR(2) NOT NULL DEFAULT 'US',
    "calendar_subdivision_code" VARCHAR(16),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_settings" ("id", "country_code", "calendar_subdivision_code")
SELECT
    1,
    COALESCE(
        (
            SELECT "country_code"
            FROM "users"
            WHERE "country_code" IS NOT NULL
            ORDER BY COALESCE("is_admin", false) DESC, "created_at" ASC
            LIMIT 1
        ),
        'US'
    ),
    (
        SELECT "calendar_subdivision_code"
        FROM "users"
        WHERE "country_code" IS NOT NULL
        ORDER BY COALESCE("is_admin", false) DESC, "created_at" ASC
        LIMIT 1
    )
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "users" DROP COLUMN IF EXISTS "country_code";
ALTER TABLE "users" DROP COLUMN IF EXISTS "calendar_subdivision_code";
