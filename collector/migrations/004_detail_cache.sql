-- Uitgelezen detailpagina's, zodat niet elke nacht alle pagina's opnieuw opgehaald hoeven te worden.
CREATE TABLE IF NOT EXISTS detail_cache (
  key         TEXT PRIMARY KEY,   -- "<bron>|<parserversie>|<id>"
  fetched_at  TEXT NOT NULL,      -- ISO-tijd van ophalen
  value       TEXT NOT NULL       -- JSON
);
