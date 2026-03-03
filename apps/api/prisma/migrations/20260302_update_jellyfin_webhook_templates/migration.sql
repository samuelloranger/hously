-- Align Jellyfin webhook templates with the official jellyfin-plugin-webhook event types
-- and payload variables documented in the upstream project.

-- Update existing official rows to use official payload fields.
UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin item added',
  "body_template" = '{{Title}} ({{ItemType}}) was added on {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'ItemAdded'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Element Jellyfin ajoute',
  "body_template" = '{{Title}} ({{ItemType}}) a ete ajoute sur {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'ItemAdded'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin playback started',
  "body_template" = '{{NotificationUsername}} started {{Title}} on {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'PlaybackStart'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Lecture Jellyfin demarree',
  "body_template" = '{{NotificationUsername}} a lance {{Title}} sur {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'PlaybackStart'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin playback stopped',
  "body_template" = '{{NotificationUsername}} stopped {{Title}} at {{PlaybackPosition}} on {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'PlaybackStop'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Lecture Jellyfin arretee',
  "body_template" = '{{NotificationUsername}} a arrete {{Title}} a {{PlaybackPosition}} sur {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'PlaybackStop'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin user deleted',
  "body_template" = '{{NotificationUsername}} was deleted from {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'UserDeleted'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Utilisateur Jellyfin supprime',
  "body_template" = '{{NotificationUsername}} a ete supprime de {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'UserDeleted'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin item deleted',
  "body_template" = '{{Title}} ({{ItemType}}) was deleted from {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'ItemDeleted'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Element Jellyfin supprime',
  "body_template" = '{{Title}} ({{ItemType}}) a ete supprime de {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'ItemDeleted'
  AND nt.language = 'fr';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Jellyfin user created',
  "body_template" = '{{NotificationUsername}} was created on {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'UserCreated'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = 'Utilisateur Jellyfin cree',
  "body_template" = '{{NotificationUsername}} a ete cree sur {{ServerName}}',
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type = 'UserCreated'
  AND nt.language = 'fr';

-- Insert missing official rows that did not previously exist.
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'ItemDeleted', 'en', 'Jellyfin item deleted', '{{Title}} ({{ItemType}}) was deleted from {{ServerName}}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'ItemDeleted'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'ItemDeleted', 'fr', 'Element Jellyfin supprime', '{{Title}} ({{ItemType}}) a ete supprime de {{ServerName}}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'ItemDeleted'
      AND nt.language = 'fr'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'UserCreated', 'en', 'Jellyfin user created', '{{NotificationUsername}} was created on {{ServerName}}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'UserCreated'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'UserCreated', 'fr', 'Utilisateur Jellyfin cree', '{{NotificationUsername}} a ete cree sur {{ServerName}}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'UserCreated'
      AND nt.language = 'fr'
  );

-- Rename or disable legacy non-official rows.
UPDATE "notification_templates" nt
SET
  "enabled" = false,
  "updated_at" = CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'jellyfin'
  AND nt.event_type IN ('PlaybackProgress', 'UserAdded', 'UserUpdated', 'ItemRemoved', 'ItemUpdated');
