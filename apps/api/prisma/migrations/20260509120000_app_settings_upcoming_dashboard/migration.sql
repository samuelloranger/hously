-- AlterTable — align app_settings with Prisma AppSettings (upcoming + dashboard widgets)
ALTER TABLE "app_settings" ADD COLUMN "upcoming_window_months" INTEGER NOT NULL DEFAULT 12;

ALTER TABLE "app_settings" ADD COLUMN "upcoming_languages" TEXT NOT NULL DEFAULT 'en,fr';

ALTER TABLE "app_settings"
  ADD COLUMN "dashboard_widget_visibility" JSONB NOT NULL
  DEFAULT '{"weather":true,"homeassistant":true,"system":true,"downloads":true,"rss":true}'::jsonb;
