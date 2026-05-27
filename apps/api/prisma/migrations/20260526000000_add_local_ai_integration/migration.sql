-- Seed a default disabled local-ai integration row so the settings UI
-- always has a record to read even before the user configures it.
INSERT INTO "integrations" ("type", "enabled", "config", "created_at", "updated_at")
VALUES ('local-ai', false, '{}', NOW(), NOW())
ON CONFLICT ("type") DO NOTHING;
