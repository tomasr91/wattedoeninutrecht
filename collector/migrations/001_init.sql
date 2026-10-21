-- Basis-schema. Activiteiten worden als JSON opgeslagen (flexibel bij nieuwe velden),
-- met geïndexeerde kolommen voor wat we doorzoeken.
CREATE TABLE IF NOT EXISTS sources (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  method        TEXT NOT NULL,
  homepage      TEXT,
  description   TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  last_attempt  TEXT,
  last_success  TEXT,
  last_error    TEXT,
  last_count    INTEGER NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  source_key     TEXT PRIMARY KEY,           -- "<bron-id>::<bron-event-id>"
  id             TEXT NOT NULL,              -- stabiele interne ID
  source_id      TEXT NOT NULL REFERENCES sources(id),
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  status         TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  missing_count  INTEGER NOT NULL DEFAULT 0,
  data           TEXT NOT NULL,              -- volledige Activity als JSON
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_dates ON activities(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

CREATE TABLE IF NOT EXISTS runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  ok           INTEGER NOT NULL DEFAULT 0,  -- 1 = minstens één bron geslaagd
  stats        TEXT,                        -- JSON
  log          TEXT
);

CREATE TABLE IF NOT EXISTS geocache (
  query       TEXT PRIMARY KEY,
  lat         REAL,
  lon         REAL,
  display     TEXT,
  fetched_at  TEXT NOT NULL
);
