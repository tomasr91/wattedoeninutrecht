-- Sinds wanneer een bron onafgebroken mislukt (voor de melding na een paar dagen).
ALTER TABLE sources ADD COLUMN failing_since TEXT;
