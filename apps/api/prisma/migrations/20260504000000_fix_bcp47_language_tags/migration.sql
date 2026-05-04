-- Fix stale language_tags produced by the old classifier that used normalize()
-- (lowercase-only) instead of normalizeLanguageCode() (alpha-only first segment).
-- BCP-47 codes like "en-US" and "fr-CA" fell to the .slice(0,3).toUpperCase()
-- fallback, yielding "EN-" and "FR-". Replace these with the correct tags.
UPDATE media_files
SET language_tags = array_replace(
  array_replace(language_tags, 'EN-', 'EN'),
  'FR-', 'FR'
)
WHERE 'EN-' = ANY(language_tags) OR 'FR-' = ANY(language_tags);
