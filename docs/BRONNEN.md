# Databronnen en beperkingen

Stand van 21 oktober 2026 (uitgebreid met Tivoli, Stadsschouwburg, Podium Sprits, Utrecht Natuurlijk en Geertjes Hoeve). Alle bronnen worden beleefd benaderd: herkenbare User-Agent met
contactadres, `robots.txt` wordt gerespecteerd, minimaal 1,5 seconde tussen verzoeken per website,
en per run een maximum aantal detailpagina's. Omschrijvingen van bronnen worden **niet** overgenomen
(auteursrecht); de app toont een eigen, korte samenvatting en verwijst voor de rest naar de bron.

## Geïmplementeerd

| Bron | Adapter | Methode | Dekking | Beperkingen |
|---|---|---|---|---|
| **UITagenda Utrecht** (uitagendautrecht.nl) | `uitagenda-utrecht` | HTML-lijsten per genre en wijk + iCal/Google Agenda-link per evenement | Stadsbreed: jeugdtheater, festivals, musea, rondleidingen, klassiek, diversen; apart Leidsche Rijn / Vleuten-De Meern | Geen publieke API of feed gevonden. Prijs staat niet altijd vermeld. Leeftijd alleen als het in de titel staat (bv. "4+"). |
| **Bibliotheek Utrecht** (bibliotheekutrecht.op-shop.nl) | `bibliotheek-utrecht` | HTML (OP-shop) | Alle vestigingen, waaronder Leidsche Rijn Centrum, Vleuterweide, Vleuten en De Meern | Geen feed of JSON-LD. Reeksen op meerdere vestigingen worden per vestiging uitgesplitst; in de app samengevoegd tot één kaart met "+ n andere locaties". |
| **Pathé** (pathe.nl) | `pathe` | Paginadata (`ng-state`) van de bioscooppagina, één verzoek per bioscoop | Kinderfilms met keuring AL of 6 en Kleuterbios in Pathé Utrecht Leidsche Rijn (Rembrandt instelbaar) | Alleen speeldagen, geen aanvangstijden ('Tijd: zie bron'). Programma komt per week; een film staat onder Doorlopend, Kleuterbios per dag in de agenda. De losse API weigert servers en robots.txt verbiedt `language=`, die worden niet gebruikt. |
| **Podium Hoge Woerd** (podiumhogewoerd.nl) | `podium-hoge-woerd` | HTML + JSON-LD indien aanwezig | Theater in De Meern, veel jeugdvoorstellingen | Toont maar een deel van het seizoen op de agendapagina. Levert status direct van het theater (uitverkocht, laatste tickets, geannuleerd). |
| **TivoliVredenburg** (tivolivredenburg.nl) | `tivolivredenburg` | HTML: lijst + genrefilter `familie`, detailpagina's | Alle concerten, lezingen, clubavonden; familieaanbod apart gemarkeerd | Datum komt uit de URL (betrouwbaar). Aanvangstijd, zaal en prijs alleen als de detailpagina die toont; anders "tijd zie bron". Alleen gekozen genres (pop & rock, club & elektronisch, comedy) plus familie; instelbaar via `genres` in `sources.config.json`. Klassiek, jazz/wereld, kennis & debat en items zonder genre (podcasts, workshops) worden niet opgehaald. |
| **Stadsschouwburg Utrecht** (stadsschouwburg-utrecht.nl) | `stadsschouwburg-utrecht` | HTML: agendakaarten `/agenda?page=N` | Toneel, dans, cabaret, jeugdvoorstellingen (leeftijd in de titel, bv. "4+") | Prijs per productie via de productiepagina. "Meerdere speeltijden" zonder exacte tijd. Kaarten met alleen de genres Verdieping of Foodprogramma worden overgeslagen (`excludeGenres`). |
| **Podium Sprits** (podiumsprits.nl) | `podium-sprits` | HTML: `/programma` + productiepagina's | Jeugdtheater in ZIMIHC Zuilen, veel voor 0–6 jaar | Op productiepagina's staan soms datums van andere voorstellingen; alleen datums die ook in het programmablok staan tellen. |
| **Utrecht Natuurlijk** (utrechtnatuurlijk.nl) | `utrecht-natuurlijk` | HTML: `/activiteit-type/<type>/?view=upcoming` | Activiteiten en exposities op de stadsboerderijen (Steede Hoge Woerd, Eilandsteede, Griftsteede, Gagelsteede, Koppelsteede) en stadstuinen; veel gratis en voor peuters | Datum uit de URL. Adressen van de meeste Steedes staan niet op de kaart, dus afstand onbekend (wijk wel). Partneractiviteiten ("De Groene Uitloper") niet opgenomen. |
| **Kasteel de Haar** (kasteeldehaar.nl) | `kasteel-de-haar` | HTML: `/agenda` | Seizoensactiviteiten, rondleidingen, speurtochten, salons, lichtroute | Datum staat in de kaarttekst (URL-datum is publicatiedatum). Items zonder datum worden "doorlopend". Tijden en prijs op de bronpagina. |
| **Jaarbeurs** (jaarbeurs.nl) | `jaarbeurs` | HTML: `/agenda` | Alleen publieksevenementen voor kinderen/gezin (trefwoorden, bv. Disney On Ice, Winterspektakel, LEGO World) | De robots.txt weerde op 21-10-2026 detailpagina's voor sommige crawlers; de koppeling respecteert robots.txt en slaat over wat niet mag. |
| **Markten** (gemeente Utrecht) | handmatig | Marktenoverzicht utrecht.nl | Weekmarkten (Brusselplein, Verlengde Houtrakgracht, Vleuten, Vredenburg), boeren-, bloemen- en stoffenmarkt; zondagsmarkten Vredenburg | Weekmarkten staan onder Doorlopend met dag en tijd. Kerstmarkten e.d. komen via de UITagenda of de vaste momenten. |
| **Utrecht Lumen** (opvolger Trajectum Lumen) | handmatig | DUIC-artikel; ontdek-utrecht.nl/lumen was niet bereikbaar | Lichtkunstroute, 27 werken in de stad | Onder Doorlopend. Tijden en eventuele rondleidingen op de bronpagina. |
| **Geertjes Hoeve** (Haarzuilens) | handmatig | Agendapagina | Seizoensactiviteiten op de boerderij (Sinterklaas, kerst, vakanties) | Agenda bevat deels data van vorig jaar; alleen data die met de kalender kloppen zijn overgenomen. Weinig items per jaar, daarom handmatig. |
| **Handmatig gecontroleerd** (`data/curated/`) | `handmatig` | JSON-bestanden | Startdataset (140 activiteiten, 21-10-2026) en seizoensevenementen zonder feed, zoals intochten | Wordt niet automatisch ververst. De controledatum blijft staan, zodat de app laat zien hoe oud het is; de betrouwbaarheidsscore daalt mee. |
| **Generiek iCal** | `type: "ical"` | iCal-feeds | Elke bron met een .ics-feed (bv. WordPress "The Events Calendar": `/?ical=1`) | Kwaliteit hangt af van de feed. |
| **Generiek JSON-LD** | `type: "jsonld"` | schema.org `Event` | Elke pagina met gestructureerde evenementdata | Veel kleine organisaties hebben dit niet. |

## Eerste live run (21 oktober 2026, GitHub Actions)

| Bron | Resultaat | Oorzaak |
|---|---|---|
| Stadsschouwburg, Utrecht Natuurlijk, Podium Sprits, Podium Hoge Woerd | werkt | — |
| TivoliVredenburg | geweigerd (403) | Cloudflare-controle ("Just a moment…") voor servers in datacenters. Structureel; wordt niet omzeild. De adapter staat daarom uit; een geplande Claude-taak vervangt elke dinsdag 00:00 `data/curated/tivoli.json` (zelfde genres), de nachtelijke update neemt dat over. |
| Bibliotheek Utrecht (op-shop.nl) | 503 | Onderhoudspagina "Tijdelijk niet beschikbaar". Tijdelijk. |
| Jaarbeurs | 404 | Hele site gaf "Tijdelijk offline". Tijdelijk. |
| UITagenda Utrecht | TLS-fout | Server gaf een standaardcertificaat ("Kubernetes Ingress Controller Fake Certificate"). Probleem bij de site. |
| Kasteel de Haar | TLS-fout | Server gaf een verlopen certificaat van een andere domeinnaam. Probleem bij de site. |

TLS-controle wordt nooit uitgezet. Diagnose opnieuw draaien: Actions → **Bronnen diagnose** → Run workflow;
het resultaat staat op de branch `diagnose`.

## Over de startdataset

De database is gevuld met 140 activiteiten die op 21-10-2026 met de hand zijn nagelopen op de
officiële pagina's van de UITagenda, Bibliotheek Utrecht en Podium Hoge Woerd (plus twee
Sinterklaasintochten via Kidsproof als secundaire bron). Alleen gegevens die op de bronpagina stonden
zijn opgenomen; wat ontbrak, staat in de app als onzekerheid. De automatische adapters zijn
geschreven en getest op de paginastructuur van die sites, maar konden vanuit de bouwomgeving niet
live draaien (uitgaand verkeer naar die websites was daar geblokkeerd). **De eerste run in GitHub
Actions is dus de eerste echte test tegen de live sites.** Als een parser daar faalt, blijft de
startdataset staan en meldt de app welke bron mislukte.

## Afgeleide gegevens (altijd herkenbaar als inschatting)

- **Leeftijd:** officiële grens uit de bron (titel of label) gaat voor. Anders een inschatting op basis
  van het soort activiteit (voorlezen 2–6, babyconcert 0–3, jeugdtheater zonder leeftijd vanaf 4).
  De app labelt dit als "inschatting, niet van de bron".
- **Binnen/buiten, categorie, duur:** afgeleid uit titel, bronlabels en bekende locaties.
- **Afstand:** hemelsbreed vanaf je wijk, met benaderde coördinaten van bekende locaties
  (ca. 0,3–0,5 km nauwkeurig). Met `GEOCODER=nominatim` worden onbekende adressen opgezocht.
- **Reisduur:** grove schatting (fiets tot 7 km, daarna auto), altijd met "ca.".
- **Beschikbaarheid:** alleen getoond als de bron het zelf meldt (uitverkocht, laatste tickets), met datum.

## Onderzocht, nog niet gekoppeld

| Bron | Waarom interessant | Status |
|---|---|---|
| Kidsproof Utrecht | Veel kinderuitjes, ook omgeving | Commerciële redactie; alleen als secundaire bron gebruikt. Liever per activiteit naar de organisator linken. |
| Gemeente Utrecht (evenementen, wijkberichten Leidsche Rijn / Vleuten-De Meern) | Intochten, Sint Maarten, wijkfeesten | Geen bruikbare feed gevonden; via `data/curated/` bijhouden. |
| Kinderboerderijen en speeltuinverenigingen in Leidsche Rijn | Kleine, gratis activiteiten dichtbij | Veel zitten op Facebook/Instagram (niet te gebruiken). Heeft een vereniging een WordPress-agenda, dan werkt de generieke iCal-adapter. |
| Nijntje Museum | Activiteiten voor peuters en kleuters | Op verzoek niet opgenomen. |
| De Helling | Poppodium en club | Op verzoek niet opgenomen. |
| De Vrijstaat (Leidsche Rijn) | Kunstlocatie voor kinderen | Vooral cursussen en reeksen voor 6+; nu nog niet relevant voor de leeftijden. Doe-expo Het Klokkenhuis staat al via de UITagenda. |
| EKKO | Kleine popzaal | **Niet gekoppeld.** De robots.txt weert expliciet AI-crawlers, waaronder Claude. |
| Pathé Leidsche Rijn | Kinderfilms om de hoek | **Niet gekoppeld.** De site was voor het onderzoek niet bereikbaar. |
| Dierenweide Vleuten | Dieren kijken, gratis | Geen agenda gevonden; vaste plek, geen evenementen. |
| Louis Hartlooper Complex | Film, kinderfilms (Cinemaatjes) | **Niet gekoppeld.** De robots.txt weert expliciet AI-crawlers (o.a. ClaudeBot) en de filmladder voor iedereen. |
| Uitfeest Utrecht | Seizoensopening, begin september | Staat bij de vaste momenten; datum 2027 nog niet bekend. |
| Overige musea (Spoorwegmuseum, Museum Speelklok, Centraal Museum, Universiteitsmuseum) | Vaste uitjes en vakantieprogramma's | Activiteiten staan deels al in de UITagenda (genre "musea"). Later per museum bekijken. |
| Omgeving (Amersfoort, Houten, Nieuwegein, Woerden, Zeist) | Uitstapjes | Regionale uitagenda's hebben elk een eigen opmaak; nog niet gekoppeld. Daardoor is "Omgeving" nu dun gevuld. |
| Nationale Database Toerisme (NDTRC / feeds van marketingorganisaties) | Gestructureerde data voor de hele regio | Toegang loopt via een licentie of de regionale marketingorganisatie; aan te vragen. Met een sleutel past dit als nieuwe adapter met `process.env`. |

## Soortlabel in de app

Elke activiteit toont naast de tijd wat het is. Waar de bron een eigen indeling heeft, gebruiken we die:
Tivoli-genres (Pop, Rock, Indie, Singer-songwriter, Club, Comedy, Familievoorstelling …), Stadsschouwburg-genres
(Cabaret, Toneel, Dans, Concert, Jeugdtheater) en Podium Sprits (Jeugdtheater, Kinderconcert). Voor de overige
bronnen leidt de app het af van de categorie (Voorstelling, Concert, Museum, Workshop …).

## Vaste momenten ("Komt eraan")

`data/vaste-momenten.json` bevat jaarlijkse momenten: Koningsdag in Leidsche Rijn/Vleuten-De Meern, Sint Maarten,
de Sinterklaasintocht, kerst in Leidsche Rijn Centrum, Uitfeest, TREK, Lepeltje Lepeltje, De Parade, Soenda en Soenda NYE.
Valt zo'n moment binnen acht weken en staat er nog niets passends in de agenda (trefwoord in de titel, eventueel
op de juiste locatie), dan toont de app het onder Doorlopend als "Komt eraan", en staat het in de log van de update.
De periodes zijn indicaties ("meestal december"), geen bevestigde data. Een moment toevoegen = één regel in dat bestand.
