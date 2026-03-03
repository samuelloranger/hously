UPDATE "notification_templates" nt
SET
  "title_template" = '{{title}}',
  "body_template" = '{{body}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'cross-seed'
  AND nt.event_type = 'RESULTS'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = '{{title}}',
  "body_template" = '{{body}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'cross-seed'
  AND nt.event_type = 'RESULTS'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = '{{title}}',
  "body_template" = '{{body}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'cross-seed'
  AND nt.event_type = 'TEST';
