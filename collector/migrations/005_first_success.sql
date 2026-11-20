-- Eerste geslaagde run per bron: de eerste lading van een nieuwe bron telt in de app niet als "Nieuw".
ALTER TABLE sources ADD COLUMN first_success TEXT;
-- Bestaande bronnen: de vroegste firstSeen van hun activiteiten.
UPDATE sources SET first_success = (
  SELECT MIN(json_extract(s.value, '$.firstSeen'))
  FROM activities a, json_each(a.data, '$.sources') s
  WHERE json_extract(s.value, '$.sourceId') = sources.id
) WHERE first_success IS NULL;
UPDATE sources SET first_success = last_success WHERE first_success IS NULL;
