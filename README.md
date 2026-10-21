# Wat te doen in Utrecht — Uit met de kids

Persoonlijke gezinsagenda voor Leidsche Rijn, Utrecht en omgeving. De app toont activiteiten per dag,
filtert op kinderen of volwassenen en geeft per kind aan of iets past bij de leeftijd.

## Structuur

| Pad | Wat |
| --- | --- |
| `index.html` | Pagina die de app laadt |
| `assets/app.js` | De app (gebouwde React-bundel) |
| `assets/app.css` | Opmaak, met licht en donker thema |
| `data/activities.json` | Alle activiteiten, de bronstatus en verwachte evenementen |
| `scripts/build-single.mjs` | Maakt één los HTML-bestand met alles erin |
| `.github/workflows/pages.yml` | Publiceert de site op GitHub Pages bij elke push naar `main` |

## Lokaal bekijken

De app haalt `data/activities.json` op, dus open hem via een webserver en niet als los bestand:

```sh
npm start                     # met Node, daarna http://localhost:3000
python3 -m http.server 8000   # zonder Node, daarna http://localhost:8000
```

## De agenda bijwerken

Pas `data/activities.json` aan en push naar `main`. Het bestand bevat:

- `generatedAt`: wanneer de data is samengesteld
- `activities`: de activiteiten (titel, `start`/`end`, `venue`, `zone`, `audiences`, `age`, `price`, `booking`, `sources`, `uncertainties`, …)
- `status`: per bron of het ophalen lukte
- `expected`: evenementen die nog niet in de agenda staan maar wel verwacht worden

Activiteiten met `"isTestData": true` worden niet getoond.

## Los HTML-bestand

```sh
npm run build:single   # schrijft dist/uit-met-de-kids.html
```

Dat bestand werkt zonder server en zonder internet (op het lettertype na).

## Instellingen

Kinderen, thuislocatie, maximale afstand en interesses stelt iedere bezoeker zelf in via het tandwiel.
Ze worden alleen in de eigen browser bewaard (`localStorage`, sleutels beginnen met `ufa:`).

## Let op

`assets/app.js` is gebouwde code. De oorspronkelijke broncode (TypeScript/React) staat niet in deze repo.
Wijzigingen aan de werking zijn daarom lastig; de data aanpassen gaat wel gewoon.
