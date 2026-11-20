# Werken aan deze uitagenda

Een persoonlijke gezinsagenda als statische web-app (React + TypeScript, Vite) met een verzamellaag die elke nacht in GitHub Actions draait. Zie `README.md` en `docs/ARCHITECTUUR.md`.

## Stad en motor

- Alles wat bij één stad hoort, staat in `city/`: `config.ts` (naam, thema, thuiswijk, zones, teksten), `venues.ts` (bekende locaties), `Landmark.tsx` (herkenningspunt in de kop), `adapters/` (eigen bronnen) en `claude/` (stadsdelen voor de skills). Ook `sources.config.json` (welke bronnen) en `BRONNEN.md` (uitleg per bron) staan daar. De data staat in `data/` (`curated/`, `places.json`, `agenda.sqlite`) en `public/data/`.
- De rest (`src/`, `collector/`, `scripts/`) is de motor en bevat geen stadsnamen. Zet stad-specifieke waarden in het stadsprofiel, niet in de motor.
- Zone-ID's (`home.zoneId`, `city.zoneId`) komen in de data terecht: niet meer veranderen als een stad draait.

## Huisregels

- Toon alleen echte activiteiten, altijd met een link naar de bron. Verzin nooit gegevens; wat je niet kunt bevestigen, laat je weg of ongewijzigd.
- Neem geen omschrijvingen van bronnen over (auteursrecht): de app maakt een eigen korte samenvatting en verwijst naar de bron. Uitzonderingen staan uitdrukkelijk in een stadsbestand in `city/claude/`.
- Ga beleefd te werk bij het ophalen: robots.txt respecteren, niet sneller dan de verzamellaag (`collector/lib/http.ts`).
- Geen persoonsgegevens in de repository: de repository en de app zijn openbaar. Namen en geboortedata van kinderen staan alleen op de telefoon (localStorage) of in de opdracht van een geplande taak.
- Tests en typecheck moeten groen blijven: `npm test` en `npm run typecheck`.

## Een bron onderzoeken

Vanuit een Claude-sessie zijn de websites van bronnen vaak niet bereikbaar; GitHub Actions wel. Zet de URL's (één per regel, plus een regel `bewaar` als je de volledige pagina's nodig hebt om een adapter te schrijven) in `.github/diagnose-request` en push naar `main`. De workflow "Bronnen diagnose" schrijft het resultaat naar de branch `diagnose` (`diagnose.json`, `tls.txt` en bij `bewaar` de pagina's als `diag-*`). Haal die op met `git fetch origin diagnose`.

## Een update starten

De nachtelijke update draait vanzelf. Is er vandaag al bijgewerkt en wil je toch opnieuw ophalen (bv. na een nieuwe bron), zet dan in `.github/run-request` een regel `forceer` (naast de datum) en push naar `main`. Zonder die regel slaat de workflow een tweede update op dezelfde dag over.

## Skills voor geplande taken

In `.claude/skills/` staan de terugkerende taken die met een Claude-account draaien: `ochtendcontrole`, `bronnen-verversen`, `kindercontrole` en `weekendtips`. Hoe je ze als geplande taak instelt, staat in `docs/GEPLANDE-TAKEN.md`.
