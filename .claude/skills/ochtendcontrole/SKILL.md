---
name: ochtendcontrole
description: Zorgt dat de dagelijkse data-update van deze uitagenda vandaag draait; vraagt hem aan via .github/run-request als de nachtelijke GitHub-run is overgeslagen. Voor een dagelijkse geplande taak in de ochtend.
---

# Ochtendcontrole update

De nachtelijke GitHub-klok start de workflow "Dagelijkse update" soms uren te laat of helemaal niet. Jij bent de wekker. Werk zelfstandig; er kijkt niemand mee. Doe NIETS anders dan hieronder staat.

1. Bepaal de datum van vandaag in UTC: `date -u +%F`
2. Lees `public/data/status.json`, veld `lastSuccessfulRun`. Begint dat met de datum van vandaag (UTC): er is al bijgewerkt. Stop en antwoord met één regel: "Al bijgewerkt (<lastSuccessfulRun>), niets gedaan."
3. Lees `.github/run-request`. Staat de datum van vandaag er al in: er is vandaag al een update aangevraagd. Stop en antwoord: "Update vandaag al aangevraagd, niets gedaan."
4. Anders: schrijf in `.github/run-request` precies deze twee regels:
   ```
   # Datum waarop de ochtendcontrole een update heeft aangevraagd (zie weekly-update.yml).
   <datum van vandaag, UTC, JJJJ-MM-DD>
   ```
   Commit alleen dat bestand met bericht "Update aangevraagd <datum>" en push naar `main` (eerst `git pull --rebase`). De push start de workflow "Dagelijkse update" direct.
5. Antwoord met één regel: "Update aangevraagd <datum> (laatste geslaagde update was <lastSuccessfulRun>)." Lukt de push niet, zeg dat in één regel met de foutmelding.
