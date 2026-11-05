# Geplande Claude-taken

Een deel van het onderhoud doet Claude, als geplande taak in je **eigen** Claude-account. De instructies staan in deze repository (`.claude/skills/`); de geplande taak zegt alleen welke repository en welke skill. Zo kan iedereen met een eigen kopie van de app dezelfde taken draaien, zonder het account van een ander.

| Skill | Wat het doet | Wanneer | Schrijft in de repo |
|---|---|---|---|
| `ochtendcontrole` | Start de dagelijkse update als de nachtelijke GitHub-run is overgeslagen | Elke dag rond 06:00 | Alleen `.github/run-request` |
| `bronnen-verversen` | Ververst bronnen die GitHub niet zelf kan ophalen (`data/curated/`, `data/places.json`) | Wekelijks | Ja |
| `kindercontrole` | Zoekt kinderactiviteiten die bij "Kinderen" wegvallen; maandelijks voorstellen voor vaste plekken | Wekelijks | Nee |
| `weekendtips` | Weekendoverzicht als bericht | Donderdag- of vrijdagavond | Nee |

Alleen `ochtendcontrole` is nodig om de app bij te houden. De rest is optioneel. Het stadsdeel van `bronnen-verversen` staat in `city/claude/bronnen-verversen.md`; heeft jouw stad geen bronnen die GitHub weigert, laat dat bestand dan weg.

## Instellen (eenmalig)

1. Koppel in Claude je GitHub-account (Instellingen → Connectors) en geef Claude toegang tot je repository.
2. Maak per skill een geplande taak aan, bijvoorbeeld door in Claude te vragen: *"Maak een geplande taak 'Ochtendcontrole update', elke dag om 06:07, met deze opdracht: …"* en plak de opdracht hieronder. Vervang `<eigenaar>/<repository>` door die van jou.
3. Het verbruik telt mee voor je eigen Claude-abonnement. Loopt een taak vast op de gebruikslimiet, dan probeert hij het de volgende keer gewoon opnieuw.

### Opdracht: ochtendcontrole (dagelijks)

```
Voeg de repository <eigenaar>/<repository> toe met add_repo (access push) en clone hem zoals add_repo aangeeft.
Lees daarna .claude/skills/ochtendcontrole/SKILL.md in die repository en voer het precies uit.
```

### Opdracht: bronnen verversen (wekelijks, bv. dinsdag 00:00)

```
Voeg de repository <eigenaar>/<repository> toe met add_repo (access push) en clone hem zoals add_repo aangeeft.
Lees daarna .claude/skills/bronnen-verversen/SKILL.md in die repository en voer het precies uit.
```

### Opdracht: kindercontrole (wekelijks, bv. dinsdagochtend)

```
Voeg de repository <eigenaar>/<repository> toe met add_repo (access read) en clone hem zoals add_repo aangeeft.
Lees daarna .claude/skills/kindercontrole/SKILL.md in die repository en voer het precies uit. Wijzig niets in de repository.
```

### Opdracht: weekendtips (wekelijks, bv. donderdag 18:49)

De geboortedata van je kinderen staan alleen hier, niet in de (openbare) repository. Gebruik een benadering als je dat liever hebt, zoals de eerste van de geboortemaand.

```
Voeg de repository <eigenaar>/<repository> toe met add_repo (access read) en clone hem zoals add_repo aangeeft.
Lees daarna .claude/skills/weekendtips/SKILL.md in die repository en voer het precies uit, met --kids=<JJJJ-MM-DD>,<JJJJ-MM-DD> (de jongste eerst). Wijzig niets in de repository.
```

Zet bij de weekendtips meldingen aan (push en/of e-mail): het eindantwoord is het bericht.
