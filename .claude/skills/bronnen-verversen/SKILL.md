---
name: bronnen-verversen
description: Ververst de bronnen van deze uitagenda die de nachtelijke GitHub-update niet zelf kan ophalen (data/curated/ en data/places.json), via WebFetch. Voor een wekelijkse geplande taak.
---

# Handmatige bronnen verversen

Sommige bronnen kan de nachtelijke GitHub-update niet zelf ophalen (bijvoorbeeld omdat de site servers van GitHub weigert). Die staan als JSON in `data/curated/`; de vaste plekken in `data/places.json`. Jij ververst ze wekelijks via WebFetch. Werk zelfstandig; er kijkt niemand mee.

Respecteer robots.txt (een ROBOTS_DISALLOWED van WebFetch = die pagina overslaan), ga beleefd te werk en verzin nooit gegevens. Neem geen beschrijvingen van bronnen over, behalve waar het stadsdeel hieronder dat uitdrukkelijk toestaat.

## Voorbereiden

0. Lees `CLAUDE.md`, `city/config.ts` (welke stad, welke thuiswijk) en `public/data/status.json`. Bronnen met een eigen adapter die "ok" zijn, beheer je NIET: hun handmatige kopieën ruimt de nachtelijke update zelf op. Welke bronnen een eigen adapter hebben, zie je in `city/sources.config.json` (`enabled: true`) en `city/adapters/index.ts`.

## Niet opnemen

Vaste marktdagen (weekmarkten, boeren-/bloemen-/stoffenmarkt, zondagsmarkt); acties en campagnes (winacties, "stem op", loterijen, "spot de …"); openingstijden of vast aanbod van een zaak als evenement; activiteiten zonder einddatum; vaste comedyavonden zonder concrete line-up. Het stadsdeel kan dit aanvullen.

## Deel A — stadsspecifieke bronnen

Lees `city/claude/bronnen-verversen.md` en voer de delen uit die daar staan (per bron: welke pagina's, welk bestand in `data/curated/`, de vorm per event en wanneer je het bestand NIET mag wijzigen). Bestaat dat bestand niet, sla dit deel over.

## Deel B — overige losse items (alle andere bestanden in data/curated/)

1. Loop elk event na waarvan `sourceName` NIET de naam is van een bron met een eigen adapter, en dat niet al in deel A is behandeld.
   - Open de `url` van het event (of de agendapagina van die bron). Klopt het nog: `checkedAt` = nu. Gewijzigd (datum, tijd, prijs, afgelast): bijwerken. Bestaat het niet meer of is het voorbij: verwijderen.
   - Staan er op dezelfde bronpagina nieuwe data van hetzelfde soort aanbod binnen drie maanden, voeg die toe in dezelfde vorm. Gebruik alleen data die kloppen met het huidige jaar (agenda's bevatten soms oude data).
   - Kun je een pagina niet openen: laat het event staan en verander niets.
   - Event met een secundaire bron (zoals Kidsproof): zoek de officiële organisator; vind je die, vervang de bron daardoor.
   - Houd je aan "Niet opnemen" hierboven.
2. Schrijf alleen bestanden terug die echt veranderd zijn. Laat events van bronnen met een eigen adapter ongemoeid.

## Deel C — vaste plekken (data/places.json), alleen op de eerste dinsdag van de maand

Is het vandaag niet de eerste dinsdag van de maand: sla dit deel over. Anders: loop elke plek na (musea, stadsboerderijen, speeltuinen, binnenspeelparadijzen, zwembaden, sport, rondvaart). Open de `url` of de eigen site van de plek. Controleer of de plek nog bestaat en of adres, openingsdagen (`open`, kort zoals "di–zo 10–17"), prijs (gratis/betaald) en leeftijd nog kloppen; werk bij wat veranderd is. Bestaat een plek niet meer: verwijderen. Verzin niets; wat je niet kunt bevestigen, laat je ongewijzigd. Voeg GEEN nieuwe plekken toe: die stelt de skill `kindercontrole` voor en de gebruiker beslist. Zet `meta.collectedAt` op nu als je iets wijzigt.

## Afronden

1. Controleer: elk gewijzigd JSON-bestand moet parsen (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <bestand>`), daarna `npm ci`, `npm test` en `npm run collect:dry -- --source=handmatig,vaste-plekken`; alles moet slagen.
2. Commit alleen de gewijzigde bestanden in `data/curated/` en `data/places.json` met bericht "Handmatige bronnen bijgewerkt <datum>" en push naar `main` (eerst `git pull --rebase`). De volgende nachtelijke update neemt het op in de app.
3. Sluit af met één regel per deel (de delen uit het stadsbestand, B en C): aantal oud → nieuw, of waarom je iets hebt overgeslagen.
