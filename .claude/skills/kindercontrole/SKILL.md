---
name: kindercontrole
description: Wekelijkse controle van deze uitagenda op kinderactiviteiten die bij "Kinderen" wegvallen, met voorstellen voor betere leeftijdsherkenning; op de eerste dinsdag van de maand ook voorstellen voor nieuwe vaste plekken. Wijzigt niets in de repository.
---

# Kindercontrole en voorstellen

Werk zelfstandig; er kijkt niemand mee. Wijzig NIETS in de repository: dit is alleen een controle met voorstellen. De gebruiker beslist zelf.

1. Lees `city/config.ts`: de stad (`cityName`) en de thuiswijk (`home.name`). Draai: `npm ci && npx tsx scripts/kids-check.ts`
   Het script geeft het aantal titels dat bij "Kinderen" verborgen is (geen leeftijd, en de bron noemt ook volwassenen) en een lijst "Mogelijk gemist bij Kinderen" met bronlink.
2. Bekijk daarnaast zelf de volledige lijst verborgen activiteiten: lees `public/data/activities.json` en filter met dezelfde regel als `src/domain/views.ts` → `kidHiddenForUnknownAge` (bv. met een klein tsx-script dat die functie importeert). Zoek ook naar gevallen die het script niet vangt maar duidelijk kinderaanbod zijn (op titel of summary).
3. Bepaal per echt gemist geval welk woord of patroon het zou laten herkennen en in welk bestand dat hoort: een leeftijdsschatting (`src/domain/ageEstimate.ts`, lijst TYPES, met range en reden) of een expliciete leeftijd in de tekst die niet herkend werd (`src/domain/enrich.ts`, `parseAgeLabel`). Stel alleen woorden voor die geen volwassenenaanbod meenemen; noem het risico als dat er is.
4. ALLEEN OP DE EERSTE DINSDAG VAN DE MAAND — voorstellen voor nieuwe vaste plekken (`data/places.json`):
   - Lees `data/places.json` (de huidige lijst; wat er al in staat niet opnieuw voorstellen).
   - Zoek met WebSearch/WebFetch naar plekken binnen ±15 km van de thuiswijk (`home.name`, `cityName`) waar je zonder afspraak heen kunt, voor kinderen én voor volwassenen: musea, stadsboerderijen/kinderboerderijen, speeltuinen en natuurspeelplaatsen, binnenspeelparadijzen, zwembaden, sport (klimmen, schaatsen, trampoline), parken, rondvaarten en dergelijke.
   - Neem alleen plekken op waarvan je het adres en wat het is op een betrouwbare bron (bij voorkeur de eigen site) hebt bevestigd. Verzin niets. Hooguit 10 voorstellen, de meest passende eerst.
5. Antwoord in het Nederlands, kort, zonder inleiding, in Markdown:
   - Eén regel: "Verborgen bij Kinderen: N titels; daarvan mogelijk gemist: M."
   - Kopje "Mogelijk gemist", per regel: titel – bron, datum, waarom het voor kinderen lijkt, [↗](bronlink) (exact die schrijfwijze).
   - Kopje "Voorstel woorden", per regel het woord/patroon, de range (bv. ca. 3–8 jaar) en het bestand.
   - Alleen op de eerste dinsdag: kopje "Voorstel nieuwe vaste plekken", per regel: naam – soort, plaats/wijk, binnen/buiten, gratis/betaald, open (kort), waarom het past, [↗](bron).
   - Is een onderdeel leeg: zeg dat in één regel.
   - Sluit af met: "Antwoord 'ja' in de chat met Claude om dit toe te voegen (of noem welke wel/niet)."
