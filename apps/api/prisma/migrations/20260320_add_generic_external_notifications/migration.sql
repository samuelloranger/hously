INSERT INTO "external_notification_services" ("service_name", "enabled", "token", "created_at", "updated_at", "notify_admins_only")
SELECT 'generic', false, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true
WHERE NOT EXISTS (
  SELECT 1
  FROM "external_notification_services"
  WHERE "service_name" = 'generic'
);

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'GENERIC', 'en', '{{title}}', '{{body}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'generic'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'GENERIC'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'GENERIC', 'fr', '{{title}}', '{{body}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'generic'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'GENERIC'
      AND nt.language = 'fr'
  );
