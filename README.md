# Uit in 030 — gezinsagenda voor Leidsche Rijn en Utrecht

Een persoonlijke, mobiele gezinsagenda voor Leidsche Rijn, de rest van Utrecht en de omgeving.
De app laat direct zien wat er de komende maand te doen is, rekent per activiteit uit hoe oud
je kinderen *op die dag* zijn, geeft Leidsche Rijn voorrang bij kinderactiviteiten en toont alleen
echte activiteiten met een link naar de bron.

- **App:** React + TypeScript (Vite), installeerbaar als PWA, werkt zonder account.
- **Data:** SQLite-database (`data/agenda.sqlite`) via de ingebouwde `node:sqlite`, met migraties.
- **Verzamellaag:** één adapter per bron, normalisatie, ontdubbeling en verwerking van wijzigingen.
- **Planning:** GitHub Actions haalt elke nacht alles op, commit de database en publiceert de app.

## Gebruik

- Bovenaan kies je **Kinderen** of **Volwassenen**. Een gezinsactiviteit (bv. een markt) staat in allebei.
- **Dit weekend** en **Volgend weekend** tonen zaterdag en zondag; bij Volwassenen ook de vrijdagavond (vanaf 18:00).
- De app toont altijd de komende drie maanden.
- **Agenda** is chronologisch per dag: eendaagse en meerdaagse activiteiten (een meerdaags festival staat
  één keer, op de eerste dag). **Doorlopend** bevat exposities, speurtochten en alles wat twee weken of langer
  loopt. Wissel door opzij te vegen of op de kop te tikken.
- Bij Kinderen verdwijnt wat voor beide kinderen te jong of te oud is op de dag zelf; onderaan staat hoeveel.
  Voorlezen wordt niet getoond (`excludeCategories` in `src/domain/views.ts`).
- Onder Doorlopend staat bovenaan **Komt eraan**: jaarlijkse momenten (Koningsdag, kerst in Leidsche Rijn Centrum, festivals) die binnen acht weken vallen maar nog geen datum in de agenda hebben. Zie `data/vaste-momenten.json`.
- Per lijst kun je soorten verbergen (Gezin → Soorten). Bij Volwassenen staan standaard uit: Indie, Metal & punk, Expositie, Dans, Roots & americana, Opera, Musical en Podcast.
- Nieuw toegevoegde activiteiten krijgen een week lang het label **Nieuw** (per toestel bijgehouden). **Gratis** en **Binnen** staan als label op de kaart; bij een activiteit kun je hem **delen** (WhatsApp e.d.).
- Via het gezinsicoon rechtsboven vul je naam en geboortedatum van de kinderen in en zie je de status van de bronnen, het tijdstip van de laatste update en de app-versie (bouwmoment).

Zie ook [docs/BRONNEN.md](docs/BRONNEN.md) voor de bronnen en hun beperkingen, en
[docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md) voor de opbouw van de code.

## Snel starten (lokaal)

Vereist: Node.js 22.13 of nieuwer.

```bash
npm install
npm run dev          # app op http://localhost:5173 (gebruikt public/data/activities.json)
npm test             # 155 tests
npm run typecheck    # TypeScript voor app én verzamellaag
```

Op je telefoon in hetzelfde wifi-netwerk: `npm run dev -- --host` en open het getoonde adres.

## Data verversen

```bash
npm run collect                               # alle ingeschakelde bronnen
npm run collect -- --source=bibliotheek-utrecht   # één bron
npm run collect:dry                           # ophalen en rapporteren, niets opslaan
npm run export                                # alleen opnieuw exporteren uit de database
```

Een run doet het volgende:

1. Bronnen ophalen, binnen een venster van vandaag tot drie maanden vooruit (plus twee weken marge).
2. Nieuwe activiteiten toevoegen.
3. Gewijzigde activiteiten bijwerken (ID blijft stabiel; wijziging herkend via een inhoudshash).
4. Verlopen activiteiten markeren; annuleringen van de bron overnemen. Een activiteit die bij de
   bron verdwijnt, krijgt eerst een waarschuwing en na vier runs (dagen) de status "vermoedelijk geannuleerd".
5. Dubbele vermeldingen samenvoegen (bron-ID, of titel + locatie + datum/tijd), met behoud van alle bronlinks.
6. Fouten per bron loggen. Een mislukte bron laat eerder verzamelde data staan, met de oude
   controledatum, zodat de app kan laten zien hoe oud die informatie is.
7. `public/data/activities.json` en `status.json` schrijven; de app toont de laatste geslaagde update.

De database bewaart de volledige reeks activiteiten; de dagelijkse run vult alleen aan en werkt bij.
Zo zie je in de app altijd het hele gekozen venster, ook drie maanden vooruit.

Instellingen staan in `collector/sources.config.json` (bron aan/uit, venster, limieten) en
optioneel in `.env` (zie `.env.example`). Er zijn geen API-sleutels of geheimen nodig.

## Online zetten (GitHub Pages, gratis)

1. Maak een **openbare** repository en push deze map naar de branch `main`.
   (GitHub Pages werkt gratis alleen met een openbare repository; privé kan met GitHub Pro of via Cloudflare Pages.)
   Zet bij **Settings → Actions → General → Workflow permissions** de optie op *Read and write permissions*.
2. Ga naar **Settings → Pages** en kies bij *Source* voor **GitHub Actions**.
3. Ga naar **Settings → Secrets and variables → Actions → Variables** en zet `COLLECTOR_CONTACT`
   op je e-mailadres (komt in de User-Agent, zodat bronbeheerders contact kunnen opnemen).
4. Start de eerste update via **Actions → Dagelijkse update → Run workflow**.
5. De app staat daarna op `https://<gebruikersnaam>.github.io/<repository>/`.
   Open die op je telefoon en kies *Zet op beginscherm* (iPhone: deelknop; Android: menu).

Let op: de code, de agenda en de website zijn openbaar.
De app bevat geen persoonsgegevens: het gezinsprofiel en je bewaarde activiteiten staan alleen
in de browser op je telefoon.

### Meldingen

Mislukt een bron drie dagen achter elkaar, dan opent de workflow een GitHub-melding (label `bronnen`); GitHub mailt je daarover. Werkt alles weer, dan sluit de melding vanzelf.

`scripts/weekend-digest.ts` maakt een tekstoverzicht van het komende weekend (basis voor de wekelijkse weekendtips).

### De dagelijkse planning

`.github/workflows/weekly-update.yml` draait elke **nacht om 02:17 UTC** (03:17 winter-, 04:17 zomertijd).
Aanpassen kan in de regel `cron:`; handmatig verversen kan altijd via *Run workflow*,
eventueel voor één bron. GitHub schakelt geplande workflows uit als een repository 60 dagen
geen activiteit heeft; de dagelijkse data-commit voorkomt dat zolang er iets verandert. Krijg je
een melding dat de workflow is uitgeschakeld, zet hem dan aan onder *Actions*.

Andere hosting kan ook: elke statische host (Netlify, Cloudflare Pages, een eigen server) kan
`dist/` serveren. Planning gaat dan via een cronjob die `npm ci && npm run collect && npm run build` draait.

### Losse pagina zonder server

`npm run build:artifact` maakt `artifact/index.html`: de complete app met de huidige dataset in
één bestand. Handig om te delen; die versie ververst zichzelf niet.

## Onderhoud

- **Een bron uitschakelen:** `"enabled": false` in `collector/sources.config.json`.
- **Een iCal- of JSON-LD-bron toevoegen zonder code:** voeg een item toe met `"type": "ical"` of
  `"type": "jsonld"` (voorbeeld staat in de config).
- **Een activiteit met de hand toevoegen:** zet hem in een JSON-bestand in `data/curated/`
  (zelfde vorm als het startbestand), met bronlink en `checkedAt`.
- **Een nieuwe locatie met coördinaten:** `collector/venues.ts`.
- **Een bron geeft fouten:** kijk in de log van de Actions-run, of draai lokaal
  `npm run collect:dry -- --source=<id>`. Websites veranderen hun opmaak; de parsers staan in
  `collector/adapters/` en hebben tests in `tests/collector.test.ts`.

## Privacy

Alleen wat nodig is: namen (vrij in te vullen), geboortedata, een wijk als startpunt voor afstanden,
interesses, filters en bewaarde activiteiten. Alles staat in `localStorage` op je eigen toestel en kan
in de app onder *Gezin* worden gewist. Er is geen account, geen tracking en geen server die iets opslaat.

## Testdata

`tests/fixtures.ts` bevat fictieve activiteiten voor geautomatiseerde tests. Ze hebben `isTestData: true`
en een titel met `[TESTDATA]`; zowel de export als de app filteren ze altijd weg.
