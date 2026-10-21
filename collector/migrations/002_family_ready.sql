-- Voorbereiding op uitbreiding: doelgroepen en leeftijden doorzoekbaar maken
-- zonder het JSON-veld te hoeven parsen (bv. voor extra gezinsleden of een API).
ALTER TABLE activities ADD COLUMN audiences TEXT NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN min_age_months INTEGER;
ALTER TABLE activities ADD COLUMN zone TEXT;
CREATE INDEX IF NOT EXISTS idx_activities_zone ON activities(zone);
