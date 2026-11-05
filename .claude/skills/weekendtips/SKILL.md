---
name: weekendtips
description: Maakt het complete weekendoverzicht uit deze uitagenda als ideeënlijst (met de kids en voor de ouders), voor een wekelijkse geplande taak op donderdag of vrijdag. Wijzigt niets in de repository.
---

# Weekendtips

Werk zelfstandig; er kijkt niemand mee. Wijzig niets in de repository.

**Persoonlijke gegevens horen niet in deze (openbare) repository.** De geboortedata van de kinderen staan in de opdracht van de geplande taak, als `--kids=JJJJ-MM-DD,JJJJ-MM-DD` (de jongste eerst). Staan ze er niet, laat `--kids` dan weg; het script gebruikt dan het standaardprofiel.

1. Lees `city/config.ts`: de naam van de app (`app.name`), de link (`app.url`) en de thuiswijk (`home.name`).
2. Draai: `npm ci && npx tsx scripts/weekend-digest.ts --kids=<geboortedata uit de opdracht> --weekend=dit`
   Dat geeft alle activiteiten van dit weekend (Kinderen: za+zo; Volwassenen: ook vrijdagavond), met dezelfde filters als de app. De laatste kolom van elke regel is de bronlink; de zone staat tussen haakjes bij de plek (de thuiswijk heeft de zone-ID `home.zoneId` uit het stadsprofiel).
3. Neem ALLES op wat het script geeft, niets weglaten. Alleen samenvoegen: meerdere voorstellingen of tijden van hetzelfde op dezelfde dag = één regel met alle tijden.
4. Opmaak in Markdown, in het Nederlands, zonder inleiding:
   - Kopje "Met de kids", daaronder per dag (vrijdag/zaterdag/zondag) de activiteiten op tijd. Per regel: tijd (of "hele dag" / "loopt t/m …"), titel, plek, en kort tussen haakjes wat handig is: "gratis", "in <thuiswijk>", "alleen voor de jongste" / "alleen voor de oudste" (bij "Geschikt voor Kind 1/2"; Kind 1 is de jongste), "misschien nog wat jong". Sluit elke regel af met een klein klikbaar pijltje naar de bron: [↗](bronlink) — exact die schrijfwijze, alleen het pijltje als linktekst.
   - Kopje "Voor jullie", zelfde opbouw per dag, met het soortlabel (bv. Comedy, Club, Pop) erbij, ook met [↗](bronlink) aan het eind.
   - Daaronder één regel met het aantal doorlopende dingen en de drie voorbeelden die het script noemt (zonder links).
   - Sluit af met de link naar de app (`app.url`). Niets verzinnen: gebruik alleen wat het script geeft.
5. Is er voor een groep niets, zeg dat in één regel.
6. Het bericht is je eindantwoord (de gebruiker krijgt het als pushbericht en per e-mail).
