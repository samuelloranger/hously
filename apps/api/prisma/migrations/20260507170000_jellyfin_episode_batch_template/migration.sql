-- Jellyfin EpisodeBatchAdded template: emitted by the in-process episode
-- batcher when 2+ ItemAdded(Episode) webhooks arrive within the debounce
-- window for the same series. Single-episode events keep using ItemAdded.

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'EpisodeBatchAdded', 'en', 'New episodes of {{SeriesName}}', '{{Count}} new episodes of {{SeriesName}} added on {{ServerName}} ({{EpisodeList}})', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'EpisodeBatchAdded'
      AND nt.language = 'en'
  );

INSERT INTO "notification_templates" ("service_id", "event_type", "language", "title_template", "body_template", "enabled", "created_at", "updated_at")
SELECT ens.id, 'EpisodeBatchAdded', 'fr', 'Nouveaux episodes de {{SeriesName}}', '{{Count}} nouveaux episodes de {{SeriesName}} ajoutes sur {{ServerName}} ({{EpisodeList}})', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "external_notification_services" ens
WHERE ens.service_name = 'jellyfin'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_templates" nt
    WHERE nt.service_id = ens.id
      AND nt.event_type = 'EpisodeBatchAdded'
      AND nt.language = 'fr'
  );
