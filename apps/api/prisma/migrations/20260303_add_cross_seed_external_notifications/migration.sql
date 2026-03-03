INSERT INTO "external_notification_services" ("service_name", "enabled", "token", "created_at", "updated_at", "notify_admins_only")
SELECT 'cross-seed', false, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true
WHERE NOT EXISTS (
  SELECT 1
  FROM "external_notification_services"
  WHERE "service_name" = 'cross-seed'
);

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'RESULTS', 'en', 'cross-seed found matches', '{{name}} matched on {{trackers}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'cross-seed'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'RESULTS'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'RESULTS', 'fr', 'cross-seed a trouve des correspondances', '{{name}} a trouve des correspondances sur {{trackers}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'cross-seed'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'RESULTS'
      AND nt.language = 'fr'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'TEST', 'en', 'cross-seed test notification', 'cross-seed webhook test completed successfully', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'cross-seed'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'TEST'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'TEST', 'fr', 'Notification de test cross-seed', 'Le test du webhook cross-seed a reussi', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'cross-seed'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'TEST'
      AND nt.language = 'fr'
  );
