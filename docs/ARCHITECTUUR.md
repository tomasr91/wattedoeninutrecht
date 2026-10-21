# Architectuur

Bewust eenvoudig: één repository, geen eigen server, geen microservices. De verzamellaag draait
als script (lokaal of in GitHub Actions), de app is een statische site die een JSON-export leest.

```
bronnen (websites, iCal, JSON-LD, handmatige JSON)
        │  collector/adapters/*        één adapter per bron, los aan/uit te zetten
        ▼
RawEvent ──► collector/normalize.ts     intern model, verrijking, onzekerheden
        ▼
src/domain/reconcile.ts                 nieuw / gewijzigd / ongewijzigd / verlopen / geannuleerd / verdwenen
        ▼
data/agenda.sqlite (node:sqlite)        activities, sources, runs, geocache + migraties
        ▼
collector/export.ts + dedupe.ts         actueel, ontdubbeld, zonder testdata
        ▼
public/data/activities.json, status.json
        ▼
src/app (React)                         filters, scoring en secties draaien in de browser
```

## Mappen

| Map | Inhoud |
|---|---|
| `src/domain/` | Pure domeinlogica, gedeeld door app en verzamellaag: datums (Europe/Amsterdam), leeftijd op datum, filters, scoring, geografie, verrijking, ontdubbeling, reconcile. Geen DOM, geen I/O. |
| `src/app/` | UI: `App.tsx` (state, opslag, vegen), `views/` (dagagenda, doorlopend, gezin en bronnen), `components/` (activiteitkaart, detail, onderblad). De lijstlogica zelf staat in `src/domain/views.ts`. |
| `collector/` | `run.ts` (orchestratie), `adapters/`, `lib/` (HTTP met robots.txt en rate limit, parsers, iCal), `db.ts` + `migrations/`, `venues.ts` (bekende locaties), `geocode.ts` (optioneel). |
| `data/` | `agenda.sqlite` (wordt door de workflow gecommit, zodat historie bewaard blijft) en `curated/` (handmatig gecontroleerde activiteiten). |
| `tests/` | Vitest. `fixtures.ts` bevat uitsluitend fictieve, gelabelde testdata. |

## Belangrijke keuzes

- **Leeftijd is nooit opgeslagen als "geschikt voor 2 jaar".** De database bewaart leeftijdsgrenzen in
  maanden (officieel en geschat, apart). De app rekent per kind de leeftijd uit op de dag van de
  activiteit (bij doorlopend aanbod: de eerste dag binnen de gekozen periode). Daardoor verschuift
  de geschiktheid vanzelf als de kinderen ouder worden, en werkt het voor elk aantal kinderen.
- **Weergave is chronologisch.** `src/domain/views.ts` bepaalt de twee lijsten, fietsafstand, dit weekend en de grens tussen agenda en doorlopend. Het scoringsmodel hieronder wordt nu niet in de UI gebruikt, maar blijft beschikbaar voor aanraders later.
- **Scoring is transparant en instelbaar** (`src/domain/scoring.ts`): vijf componenten met gewichten
  30/25/20/15/10. Kinderactiviteiten krijgen een steilere afstandscurve plus een bonus voor Leidsche Rijn;
  volwassenenactiviteiten een mildere. Bijzondere evenementen krijgen extra interesse-score, zodat ze een
  doorsnee activiteit dichtbij kunnen overtreffen. Aanraders worden gevarieerd (`diversify`).
- **Activiteiten als JSON in SQLite** met geïndexeerde kolommen (datum, status, zone, doelgroep,
  minimumleeftijd). Nieuwe velden vragen geen migratie; zoekvelden wel.
- **Filters en scoring in de browser.** Met enkele honderden activiteiten is dat direct; het houdt
  hosting statisch en gratis. Bij duizenden activiteiten kan dezelfde domeinlaag achter een API.
- **Geen secrets in de client.** Er zijn ook geen secrets nodig; optionele variabelen gaan via
  `.env` of GitHub Actions-variabelen naar de verzamellaag.

## Vormgeving

Geïnspireerd op de stijl van utrecht.nl: een lichte, steengrijze kop met de Dom als lijntekening; gedempt Utrechts rood (#a3262a) alleen als accent, veel wit,
Noto Sans en sobere grijze blokken. De Domtoren in de kop en het app-icoon is een eigen tekening
(`src/app/components/DomTower.tsx`). Het logo, het stadswapen en de designbestanden van de gemeente
worden bewust niet gebruikt: die zijn eigendom van de gemeente, en de app is geen gemeentelijke dienst.
Rood betekent in de app "actief" (gekozen tab of schakelaar) of "in Leidsche Rijn" (rood blokje bij de locatie).
