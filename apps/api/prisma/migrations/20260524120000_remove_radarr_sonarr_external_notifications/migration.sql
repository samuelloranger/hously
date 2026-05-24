-- Hously replaces Radarr/Sonarr; remove legacy external notification services.
-- Templates and logs cascade via FK on external_notification_services.id.
DELETE FROM "external_notification_services"
WHERE "service_name" IN ('radarr', 'sonarr');
