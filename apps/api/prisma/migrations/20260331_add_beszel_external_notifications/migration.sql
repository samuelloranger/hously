INSERT INTO "external_notification_services" ("service_name", "enabled", "token", "created_at", "updated_at", "notify_admins_only")
SELECT 'beszel', false, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true
WHERE NOT EXISTS (
  SELECT 1 FROM "external_notification_services" WHERE "service_name" = 'beszel'
);

-- AlertTriggered
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'AlertTriggered', 'en', '⚠️ {{alert_name}} alert on {{system_name}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'AlertTriggered' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'AlertTriggered', 'fr', '⚠️ Alerte {{alert_name}} sur {{system_name}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'AlertTriggered' AND nt.language = 'fr'
  );

-- AlertResolved
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'AlertResolved', 'en', '✅ {{alert_name}} alert resolved on {{system_name}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'AlertResolved' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'AlertResolved', 'fr', '✅ Alerte {{alert_name}} résolue sur {{system_name}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'AlertResolved' AND nt.language = 'fr'
  );

-- StatusDown
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'StatusDown', 'en', '🔴 {{system_name}} is down', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'StatusDown' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'StatusDown', 'fr', '🔴 {{system_name}} est hors ligne', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'StatusDown' AND nt.language = 'fr'
  );

-- StatusUp
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'StatusUp', 'en', '🟢 {{system_name}} is back up', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'StatusUp' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'StatusUp', 'fr', '🟢 {{system_name}} est de retour en ligne', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'StatusUp' AND nt.language = 'fr'
  );

-- SmartAlert
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'SmartAlert', 'en', '🔧 SMART alert', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'SmartAlert' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'SmartAlert', 'fr', '🔧 Alerte SMART', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'SmartAlert' AND nt.language = 'fr'
  );

-- Alert (fallback for test notifications and unrecognized event types)
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'Alert', 'en', '{{title}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'Alert' AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'Alert', 'fr', '{{title}}', '{{message}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'beszel'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt
    WHERE nt.service_id = ens.id AND nt.event_type = 'Alert' AND nt.language = 'fr'
  );
