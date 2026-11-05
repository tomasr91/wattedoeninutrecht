# Stadsdeel voor de skill bronnen-verversen — Utrecht (Uit in 030)

Dit bestand hoort bij het stadsprofiel. De algemene stappen staan in `.claude/skills/bronnen-verversen/SKILL.md`; hier staan de bronnen van Utrecht die een eigen aanpak nodig hebben.

Extra bij "Niet opnemen": Markt Vredenburg.

Bronnen met een eigen adapter (voor deel B van de skill): UITagenda Utrecht, Bibliotheek Utrecht, Kasteel de Haar, Jaarbeurs, Stadsschouwburg Utrecht, Utrecht Natuurlijk, Podium Sprits, Podium Hoge Woerd, Pathé, Máximapark, Comedyhuis. Losse items in deel B zijn o.a. Geertjes Hoeve, Utrecht Lumen, de Sint Maarten-parade en items van Kidsproof. Gebruik bij Geertjes Hoeve alleen data die kloppen met het huidige jaar.

## A1 — TivoliVredenburg (data/curated/tivoli.json)

De nachtelijke update kan Tivoli niet ophalen: Cloudflare weigert servers van GitHub.

1. Tivoli wordt NIET op genre beperkt: haal de complete agenda op, alle genres. De gebruiker filtert zelf in de app per soortlabel. Lees in `city/sources.config.json` bij `tivolivredenburg` de lijst `excludeTitles` (reguliere expressies, hoofdletterongevoelig). Lees `data/curated/tivoli.json` voor de exacte vorm per event (sourceName "TivoliVredenburg", sourceEventId "tivoli-<nummer uit de URL>", url, title, start "YYYY-MM-DDTHH:mm" of alleen "YYYY-MM-DD" met allDay false als de tijd onbekend is, end, venueName "TivoliVredenburg", address "Vredenburgkade 11, 3511 WC Utrecht", locality "Binnenstad", hints, bookingText "tickets", kind, priceText, openingNote, durationMinutes, summary, checkedAt, confidence, extraUncertainties). Kijk in `city/adapters/tivolivredenburg.ts` naar `TIVOLI_GENRE_LABEL` en `pickKind` voor het soortlabel (kind); de app zet muziekgenres zelf om naar "Concert · <genre>".
2. Lees op https://www.tivolivredenburg.nl/agenda/ welke genres de site in het genrefilter aanbiedt (alle opties). Haal met WebFetch per genre https://www.tivolivredenburg.nl/agenda/?genre=<slug> op (en /agenda/page/<n>/?genre=<slug> zolang er items binnen het venster zijn), inclusief "familie", klassiek, jazz/wereld, kennis & debat enz. Haal daarnaast de ongefilterde agenda op, zodat ook items zonder genre (podcasts, workshops e.d.) meekomen. Venster: vandaag t/m drie maanden vooruit. De datum staat in de URL (…/agenda/<id>/<slug>-DD-MM-YYYY).
   - Soortlabel: gebruik `TIVOLI_GENRE_LABEL` en `pickKind`; voor een genre dat daar niet in staat de korte genrenaam zoals de site die toont (bv. "Klassiek", "Wereld"); zonder genre een passend kort label uit de titel (bv. "Podcast", "Workshop") of "Overig".
   - Familie-items: hints ["Familie"], kind "Familievoorstelling", leeftijd uit de titel (bv. "(2+)").
   - Voor items in de komende 45 dagen waar mogelijk de detailpagina voor aanvangstijd, zaal, prijs en een korte beschrijving (summary: de eerste één à twee zinnen van de introtekst, letterlijk, max. ±220 tekens; familie eerst); anders confidence "middel" en extraUncertainties ["Aanvangstijd nog niet opgehaald; staat op de bronpagina"].
   - Sla titels over die passen bij `excludeTitles`: alleen concrete shows.
3. Schrijf `data/curated/tivoli.json` in zijn geheel opnieuw (zelfde meta-velden; meta.collectedAt = nu in UTC; meta.method: "Complete programma van tivolivredenburg.nl/agenda, alle genres."), gesorteerd op start, zonder dubbele sourceEventId. Haal je minder dan de helft van het vorige aantal op, of mislukt WebFetch voor Tivoli: dit bestand NIET wijzigen.

## A2 — Leidsche Rijn Centrum (data/curated/leidsche-rijn-centrum.json)

1. Lees het huidige bestand voor de vorm (sourceName "Leidsche Rijn Centrum", sourceEventId "lrc-<korte-naam>", venueName "Leidsche Rijn Centrum" of een specifieker plein, locality "Leidsche Rijn Centrum", audiences, categories, kind, openingNote, priceText, cautions, special, extraUncertainties, confidence, summary).
2. Haal https://leidscherijncentrum.nl/nieuws-en-events/ op en daarna de evenementpagina's (/events/<slug>/) die toegestaan zijn. Alleen evenementen (geen winkelopeningen, acties of nieuws), vandaag t/m drie maanden vooruit. Splits een evenement in losse items als onderdelen een eigen dag of tijd hebben. Kinderactiviteiten: audiences ["kinderen","gezin"]; voor iedereen: ["gezin","kinderen","volwassenen"]. Noemt de pagina een leeftijd, zet die in de titel of in ageLabel/officialMinMonths. Behoud bestaande sourceEventId's voor dezelfde evenementen.
3. Schrijf het bestand in zijn geheel opnieuw (meta.collectedAt = nu). Lukt de overzichtspagina niet: NIET wijzigen.
