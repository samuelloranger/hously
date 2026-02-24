-- Update Kopia notification templates to use parsed body variables
-- New variables: {{subject}}, {{path}}, {{status}}, {{size}}, {{files}}, {{directories}}, {{duration}}

-- Update BackupSuccess templates
UPDATE "notification_templates" nt
SET
  "title_template" = '{{subject}}',
  "body_template"  = '{{status}} | Size: {{size}} | Files: {{files}} | Duration: {{duration}}'
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'kopia'
  AND nt.event_type = 'BackupSuccess'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = '{{subject}}',
  "body_template"  = '{{status}} | Taille: {{size}} | Fichiers: {{files}} | Durée: {{duration}}'
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'kopia'
  AND nt.event_type = 'BackupSuccess'
  AND nt.language = 'fr';

-- Update BackupError templates
UPDATE "notification_templates" nt
SET
  "title_template" = '{{subject}}',
  "body_template"  = '{{status}} | Path: {{path}} | Duration: {{duration}}'
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'kopia'
  AND nt.event_type = 'BackupError'
  AND nt.language = 'en';

UPDATE "notification_templates" nt
SET
  "title_template" = '{{subject}}',
  "body_template"  = '{{status}} | Chemin: {{path}} | Durée: {{duration}}'
FROM "external_notification_services" ens
WHERE nt.service_id = ens.id
  AND ens.service_name = 'kopia'
  AND nt.event_type = 'BackupError'
  AND nt.language = 'fr';

-- Add BackupWarning templates (new event type from handler)
INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "created_at", "updated_at")
SELECT
  ens.id,
  'BackupWarning',
  'en',
  '{{subject}}',
  '{{status}} | Size: {{size}} | Files: {{files}} | Duration: {{duration}}',
  NOW(),
  NOW()
FROM "external_notification_services" ens
WHERE ens.service_name = 'kopia'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt2
    WHERE nt2.service_id = ens.id AND nt2.event_type = 'BackupWarning' AND nt2.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "created_at", "updated_at")
SELECT
  ens.id,
  'BackupWarning',
  'fr',
  '{{subject}}',
  '{{status}} | Taille: {{size}} | Fichiers: {{files}} | Durée: {{duration}}',
  NOW(),
  NOW()
FROM "external_notification_services" ens
WHERE ens.service_name = 'kopia'
  AND NOT EXISTS (
    SELECT 1 FROM "notification_templates" nt2
    WHERE nt2.service_id = ens.id AND nt2.event_type = 'BackupWarning' AND nt2.language = 'fr'
  );
