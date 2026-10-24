/**
 * Adapters TivoliVredenburg, Stadsschouwburg Utrecht en Podium Sprits.
 * ⚠️ De HTML hieronder is SYNTHETISCH: nagebouwd op basis van de structuur die op 21-10-2026
 * via webonderzoek is vastgesteld (URL-patronen, labels, datumnotatie). De echte opmaak kan
 * afwijken; de eerste live run in GitHub Actions is de echte test.
 */
import { describe, expect, it } from 'vitest';
import { parseTivoliDetail, parseTivoliList, toRawEvents } from '../collector/adapters/tivolivredenburg';
import { parseSsuDetail, parseSsuList, ssuCardToRaw } from '../collector/adapters/stadsschouwburg-utrecht';
import { parseSpritsDetail, parseSpritsProgram, spritsToRaw } from '../collector/adapters/podium-sprits';
import { normalize } from '../collector/normalize';
import { parseAgeLabel } from '../src/domain/enrich';
import { pricesIn, priceTextFrom } from '../collector/lib/parse';

const NOW = '2026-10-21T06:00:00Z';
const TODAY = '2026-10-21';

describe('TivoliVredenburg', () => {
  const list = `<main><ul>
    <li class="event"><a href="/agenda/95650731/op-avontuur-met-dikkie-dik-2-25-10-2026/"><span>zo 25 okt 2026</span><h3>Op Avontuur met Dikkie Dik (2+)</h3></a></li>
    <li class="event"><a href="/agenda/69214441/ceelo-green-26-10-2026/"><span>ma 26 okt 2026</span><h3>CeeLo Green</h3></a><span>AFGELAST</span></li>
    <li class="event"><a href="/agenda/10567573/utrechtse-meezingerij-14-11-2026/"><span>za 14 nov 2026</span><h3>Utrechtse Meezingerij</h3></a><span>Gratis</span></li>
  </ul></main>`;
  const detail = `<main><h1>Op Avontuur met Dikkie Dik (2+)</h1><p>zo 25 okt 2026 · Grote zaal</p>
    <h4>Concert 1</h4><p>Deuren open 9.15 uur</p><p>Aanvang 10.00 uur</p><p>Verwachte eindtijd 10.45 uur</p>
    <h4>Concert 2</h4><p>Deuren open 11.30 uur</p><p>Aanvang 12.00 uur</p><p>Verwachte eindtijd 12.45 uur</p>
    <h4>Tickets</h4><p>Volwassene € 16,- Kind (t/m 18 jaar) € 13,-</p></main>`;

  it('haalt datum uit de URL, titel uit de kaart, en herkent afgelast en gratis', () => {
    const items = parseTivoliList(list);
    expect(items.map((i) => [i.date, i.title])).toEqual([
      ['2026-10-25', 'Op Avontuur met Dikkie Dik (2+)'],
      ['2026-10-26', 'CeeLo Green'],
      ['2026-11-14', 'Utrechtse Meezingerij'],
    ]);
    expect(items[1].cancelled).toBe(true);
    expect(items[2].free).toBe(true);
  });

  it('leest twee voorstellingen, zaal en prijs van de detailpagina', () => {
    const d = parseTivoliDetail(detail);
    expect(d.times).toEqual([{ start: '10:00', end: '10:45' }, { start: '12:00', end: '12:45' }]);
    expect(d.room).toBe('Grote zaal');
    expect(d.priceText).toBe('€ 13 – € 16');
  });

  it('maakt per voorstelling een activiteit; familie wordt gezin met officiële leeftijd 2+', () => {
    const [item] = parseTivoliList(list);
    const raws = toRawEvents(item, parseTivoliDetail(detail), true, NOW);
    expect(raws.map((r) => r.start)).toEqual(['2026-10-25T10:00', '2026-10-25T12:00']);
    const a = normalize(raws[0]);
    expect(a.audiences).toContain('kinderen');
    expect(a.age.officialMinMonths).toBe(24);
    expect(a.zone).toBe('utrecht');
  });

  it('zonder detail: alleen de datum, en de begintijd staat als onzeker', () => {
    const items = parseTivoliList(list);
    const a = normalize(toRawEvents(items[1], undefined, false, NOW)[0]);
    expect(a.start).toBe('2026-10-26');
    expect(a.status).toBe('geannuleerd');
  });
});

describe('Stadsschouwburg Utrecht', () => {
  const list = `<main>
    <article><a href="/agenda/seizoen-2026-2027/dag-poes-4-hntjong"><span>do 22 okt 2026</span><span>14:00</span><h3>Dag Poes 4+</h3><p>HNTjong</p><span>Toneel</span></a></article>
    <article><a href="/agenda/seizoen-2026-2027/ile-mijn-thuis-3-buhnenbiest"><span>vr 23 okt 2026</span><span>10:30</span><h3>ilė, mijn thuis 3+</h3><p>Bühnenbiest</p><span>Muziektheater</span><span>Dans</span></a></article>
    <article><a href="/agenda/seizoen-2026-2027/ile-mijn-thuis-3-buhnenbiest"><span>vr 23 okt 2026</span><span>12:00</span><h3>ilė, mijn thuis 3+</h3><p>Bühnenbiest</p></a></article>
    <article><a href="/agenda/seizoen-2026-2027/rekhalzen-yentl-en-de-boer"><span>wo 04 nov 2026</span><span>20:00</span><h3>Rekhalzen</h3><p>Yentl en de Boer</p><span>Cabaret</span></a><span>uitverkocht</span></article>
    <article><a href="/agenda/seizoen-2026-2027/club-kafka-theatergroep-matrose"><span>wo 04 nov 2026</span><span>meerdere speeltijden</span><h3>Club Kafka</h3><p>Theatergroep MATROSE</p></a></article>
  </main>`;

  it('één kaart per voorstelling, ook als voorstellingen dezelfde pagina delen', () => {
    const cards = parseSsuList(list, TODAY);
    expect(cards.map((c) => `${c.date} ${c.time ?? '-'} ${c.title}`)).toEqual([
      '2026-10-22 14:00 Dag Poes 4+',
      '2026-10-23 10:30 ilė, mijn thuis 3+',
      '2026-10-23 12:00 ilė, mijn thuis 3+',
      '2026-11-04 20:00 Rekhalzen',
      '2026-11-04 - Club Kafka',
    ]);
    expect(cards[3].soldOut).toBe(true);
    expect(cards[4].multipleTimes).toBe(true);
    expect(cards[1].genres).toEqual(['Dans', 'Muziektheater']);
  });

  it('jeugdvoorstelling krijgt een officiële leeftijd; gezelschap staat in de titel', () => {
    const [poes] = parseSsuList(list, TODAY);
    const a = normalize(ssuCardToRaw(poes, NOW, '€ 12 – € 15'));
    expect(a.title).toBe('Dag Poes 4+ – HNTjong');
    expect(a.age.officialMinMonths).toBe(48);
    expect(a.price.minEur).toBe(12);
    expect(a.start).toBe('2026-10-22T14:00');
  });

  it('prijs van de productiepagina', () => {
    expect(parseSsuDetail('<main><p>do 22 okt 2026 14:00 - 14:55</p><p>€ 15,00 / t/m 18 jaar € 12,00</p><p>Blauwe Zaal</p></main>')).toEqual({
      priceText: '€ 12 – € 15',
      room: 'Blauwe Zaal',
    });
  });
});

describe('Podium Sprits', () => {
  const program = `<main>
    <section><h2>Kluizelaar</h2><p>Simone de Jong Company (2+)</p><p>WO 4 NOV | 10:00</p><a href="https://podiumsprits.nl/kluizelaar">INFO &amp; TICKETS</a></section>
    <section><h2>Pim &amp; Pom op naar pakjesavond</h2><p>(2+)</p><p>VR 27 NOV | 9:30 &amp; 11:00</p><a href="/pimpom">INFO &amp; TICKETS</a></section>
  </main>`;
  const detail = `<main><h1>Kluizelaar</h1><p>Woensdag 4 november 2026</p><p>Aanvang 10:00</p><p>35 minuten + 15 minuten naspel</p>
    <p>€9 / €11 / €13</p><a href="https://podium-sprits.weticket.io/kluizelaar/shop">Tickets</a>
    <aside><h3>Ook leuk</h3><p>Vrijdag 27 november 2026</p></aside></main>`;

  it('leest per voorstelling de datums en tijden uit het programma', () => {
    const shows = parseSpritsProgram(program, TODAY);
    expect(shows.map((s) => [s.slug, s.title, s.sessions])).toEqual([
      ['kluizelaar', 'Kluizelaar', [{ date: '2026-11-04', time: '10:00' }]],
      ['pimpom', 'Pim & Pom op naar pakjesavond', [{ date: '2026-11-27', time: '09:30' }, { date: '2026-11-27', time: '11:00' }]],
    ]);
  });

  it('neemt geen datums van andere voorstellingen over van de productiepagina', () => {
    const [show] = parseSpritsProgram(program, TODAY);
    const d = parseSpritsDetail(detail);
    expect(d.durationMinutes).toBe(35);
    expect(d.priceText).toBe('€ 9 – € 13');
    const raws = spritsToRaw(show, d, NOW);
    expect(raws.map((r) => r.start)).toEqual(['2026-11-04T10:00']);
    expect(raws[0].bookingUrl).toContain('weticket');
  });
});

describe('leeftijden en prijzen in nieuwe notaties', () => {
  it('halve jaren en maanden', () => {
    expect(parseAgeLabel('Tuimelaar (0,5+)')).toEqual({ officialMinMonths: 6, label: '0,5+' });
    expect(parseAgeLabel('Cadeautje (1,5+)')?.officialMinMonths).toBe(18);
    expect(parseAgeLabel('Tuimelaar (6-18 mnd)')).toEqual({ officialMinMonths: 6, officialMaxMonths: 18, label: '6-18 mnd' });
  });
  it('bedragen met ,- en zonder spatie', () => {
    expect(pricesIn('€ 16,- en €9 / € 12,50')).toEqual([16, 9, 12.5]);
    expect(priceTextFrom('Vrije inloop')).toBe('Gratis');
  });
});

describe('soortlabels en inkorten', () => {
  it('Tivoli: het meest zeggende genre wint', async () => {
    const { pickKind } = await import('../collector/adapters/tivolivredenburg');
    expect(pickKind(['Pop', 'Comedy'])).toBe('Comedy');
    expect(pickKind(['Indie', 'Metal & punk'])).toBe('Indie');
    expect(pickKind([])).toBeUndefined();
  });
  it('Stadsschouwburg: alleen Verdieping/Foodprogramma valt weg, een voorstelling met eten niet', async () => {
    const { ssuExcluded, ssuKind } = await import('../collector/adapters/stadsschouwburg-utrecht');
    const ex = ['Verdieping', 'Foodprogramma'];
    expect(ssuExcluded({ genres: ['Verdieping'] }, ex)).toBe(true);
    expect(ssuExcluded({ genres: ['Foodprogramma', 'Toneel'] }, ex)).toBe(false);
    expect(ssuExcluded({ genres: [] }, ex)).toBe(false);
    expect(ssuKind({ title: 'WIER 8+', genres: ['Foodprogramma', 'Toneel'] })).toBe('Jeugdtheater');
    expect(ssuKind({ title: 'I am Andrew 14+', genres: ['Toneel'] })).toBe('Toneel');
    expect(ssuKind({ title: 'Keanu', genres: ['Cabaret'] })).toBe('Cabaret');
    expect(ssuKind({ title: 'Popronde', genres: ['Muziek'] })).toBe('Concert');
  });
});

describe('Utrecht Natuurlijk (synthetische HTML)', () => {
  const html = `<main>
    <article><a href="https://www.utrechtnatuurlijk.nl/activiteit/beestenboel-activiteit/?date=2026-10-24"><h3>Beestenboel activiteit</h3></a>
      <p>zaterdag 24 okt 2026</p><p>14.00-15.00 uur</p><p>Eilandsteede</p><p>Peuters, Kinderen, Gezinnen</p><p>Gratis</p></article>
    <article><a href="https://www.utrechtnatuurlijk.nl/activiteit/hutten-bouwen/?date=2026-10-21"><h3>Hutten bouwen</h3></a>
      <p>21 t/m 23 okt 2026</p><p>10.30-16.00 uur</p><p>Griftsteede</p><p>Kinderen</p><p>Gratis</p></article>
    <article><a href="https://www.utrechtnatuurlijk.nl/activiteit/workshop-kruidenzalf-maken-herfst/?date=2026-11-28"><h3>Workshop kruidenzalf maken – herfst</h3></a>
      <p>zaterdag 28 nov 2026</p><p>13.30-15.30 uur</p><p>Griftsteede</p><p>Volwassenen</p><p>Betaald 22,50</p></article>
  </main>`;
  it('leest datum uit de URL, tijd, locatie, doelgroep en prijs', async () => {
    const { parseUnList, unCardToRaw } = await import('../collector/adapters/utrecht-natuurlijk');
    const cards = parseUnList(html, TODAY);
    expect(cards.map((c) => [c.date, c.time?.start, c.location?.venueName, c.groups])).toEqual([
      ['2026-10-24', '14:00', 'Stadsboerderij Eilandsteede', ['Peuters', 'Kinderen', 'Gezinnen']],
      ['2026-10-21', '10:30', 'Stadsboerderij Griftsteede', ['Kinderen']],
      ['2026-11-28', '13:30', 'Stadsboerderij Griftsteede', ['Volwassenen']],
    ]);
    expect(cards[1].end).toBe('2026-10-23');
    const peuter = normalize(unCardToRaw(cards[0], NOW));
    expect(peuter.audiences).toEqual(expect.arrayContaining(['kinderen', 'gezin']));
    expect(peuter.price.kind).toBe('gratis');
    expect(peuter.kind).toBe('Kinderboerderij');
    const ws = normalize(unCardToRaw(cards[2], NOW));
    expect(ws.audiences).toEqual(['volwassenen']);
    expect(ws.price.minEur).toBe(22.5);
    expect(ws.kind).toBe('Workshop');
  });
});


describe('Kasteel de Haar (synthetische HTML)', () => {
  const html = `<main>
    <article><a href="https://www.kasteeldehaar.nl/2025/12/19/indienstvandeadel/"><h3>Rondleiding: In dienst van de adel</h3></a><p>1 november 2026 – 3 januari 2027</p></article>
    <article><a href="https://www.kasteeldehaar.nl/2026/07/14/salons-2026/"><h3>Salons Kasteel de Haar</h3></a><p>7 &amp; 14 november</p></article>
    <article><a href="https://www.kasteeldehaar.nl/2026/10/01/herfstvakantie2026/"><h3>Vier de herfstvakantie bij De Haar</h3></a><p>10 – 25 oktober</p></article>
    <article><a href="https://www.kasteeldehaar.nl/2026/06/25/tuinspeurtocht_ontsnaptedieren/"><h3>Tuinspeurtocht: Ontsnapte dieren</h3></a><p>Doorlopend</p></article>
  </main>`;
  it('bereik, losse dagen, bereik zonder maand bij het begin, en doorlopend', async () => {
    const { parseHaarList, haarToRaw } = await import('../collector/adapters/kasteel-de-haar');
    const items = parseHaarList(html, TODAY);
    expect(items.map((i) => [i.slug, i.start, i.end, i.days, i.ongoing])).toEqual([
      ['indienstvandeadel', '2026-11-01', '2027-01-03', undefined, false],
      ['salons-2026', undefined, undefined, ['2026-11-07', '2026-11-14'], false],
      ['herfstvakantie2026', '2026-10-10', '2026-10-25', undefined, false],
      ['tuinspeurtocht_ontsnaptedieren', undefined, undefined, undefined, true],
    ]);
    expect(items[2].kids).toBe(true);
    const speur = normalize(haarToRaw(items[3], TODAY, '2027-02-04', NOW)[0]);
    expect(speur.kind).toBe('Speurtocht');
    expect(speur.endUnknown).toBe(true);
    expect(speur.zone).toBe('leidsche-rijn');
  });
});

describe('Jaarbeurs (synthetische HTML)', () => {
  const html = `<main>
    <div><a href="/agenda-item/disney-on-ice-presenteert-road-trip-adventures"><h3>Disney On Ice: Road Trip Adventures</h3></a><p>18 – 30 dec 2026</p><span>Gastevenement</span><span>Publieksevenement</span></div>
    <div><a href="/agenda-item/het-utrechtse-winterspektakel"><h3>Het Utrechtse Winterspektakel</h3></a><p>26 okt 2026 – 3 jan 2027</p><span>Publieksevenement</span></div>
    <div><a href="/agenda-item/esg-days"><h3>ESG Days</h3></a><p>3 nov 2026</p><span>Publieksevenement</span></div>
    <div><a href="/agenda-item/logistica"><h3>Logistica Next</h3></a><p>10 nov 2026</p><span>Zakelijk evenement</span></div>
  </main>`;
  it('alleen publieksevenementen voor gezinnen, met datumbereik over de jaargrens', async () => {
    const { parseJbList, isFamilyEvent, jbToRaw } = await import('../collector/adapters/jaarbeurs');
    const items = parseJbList(html, TODAY);
    const fam = items.filter((i) => isFamilyEvent(i));
    expect(fam.map((i) => [i.slug, i.start, i.end])).toEqual([
      ['disney-on-ice-presenteert-road-trip-adventures', '2026-12-18', '2026-12-30'],
      ['het-utrechtse-winterspektakel', '2026-10-26', '2027-01-03'],
    ]);
    expect(normalize(jbToRaw(fam[0], NOW)!).zone).toBe('utrecht');
  });
  it('overige publieksevenementen bij volwassenen als Beurs; zakelijk valt af', async () => {
    const { parseJbList, jbToRaw } = await import('../collector/adapters/jaarbeurs');
    const { kindLabel } = await import('../src/domain/kind');
    const items = parseJbList(html, TODAY).filter((i) => i.isPublic);
    expect(items.map((i) => i.slug)).not.toContain('logistica');
    const esg = normalize(jbToRaw(items.find((i) => i.slug === 'esg-days')!, NOW)!);
    expect(esg.audiences).toEqual(['volwassenen']);
    expect(kindLabel(esg)).toBe('Beurs');
    const winter = normalize(jbToRaw(items.find((i) => i.slug === 'het-utrechtse-winterspektakel')!, NOW)!);
    expect(winter.audiences).toContain('kinderen');
    expect(kindLabel(winter)).toBe('Feest & festival');
    const { isOuting } = await import('../collector/adapters/jaarbeurs');
    expect(isOuting({ title: 'Scrum Day Europe 2026', text: 'community event' })).toBe(false);
    expect(isOuting({ title: 'Studiekeuzebeurs Midden 2026', text: '' })).toBe(false);
    expect(isOuting({ title: 'CardCon 2026', text: 'Trefpunt voor fans van trading card games' })).toBe(true);
  });
});

describe('Jaarbeurs detailpagina (synthetische HTML)', () => {
  const page = (slots: string) => `<main><div class="col-md-6"><h1>[TESTDATA] Testbeurs</h1><p>Een gezellige testbeurs met honderden standhouders en veel te ontdekken.</p></div>
    <div class="agenda__info-box"><div class="agenda__meta">${slots}</div><h5 class="agenda__tickets-starting">€13,50</h5></div></main>`;
  it('tijden per dag, prijs en beschrijving', async () => {
    const { parseJbDetail, withJbDetail } = await import('../collector/adapters/jaarbeurs');
    const d = parseJbDetail(page('<div>14 nov 2026 09:00 - 17:00</div><div>15 nov 2026 09:00 - 16:00</div>'), TODAY);
    const e = withJbDetail({ sourceId: 'jaarbeurs', sourceName: 'Jaarbeurs', url: 'u', title: 't', start: '2026-11-14', end: '2026-11-15', allDay: true }, d);
    expect(e).toMatchObject({ start: '2026-11-14T09:00', end: '2026-11-15', priceText: 'v.a. €13,50', openingNote: 'za 14 nov 09:00–17:00; zo 15 nov 09:00–16:00' });
    expect(e.summary).toMatch(/testbeurs/);
  });
  it('voorstellingen met twee tijden per dag en een paar vrije dagen', async () => {
    const { parseJbDetail, withJbDetail } = await import('../collector/adapters/jaarbeurs');
    const days = ['19', '20', '21', '24', '25', '26'].map((x) => `<div>${x} dec 2026 11:00 - 12:40</div><div>${x} dec 2026 15:00 - 16:40</div>`).join('');
    const e = withJbDetail({ sourceId: 'jaarbeurs', sourceName: 'Jaarbeurs', url: 'u', title: 't', start: '2026-12-19', end: '2026-12-26', allDay: true }, parseJbDetail(page(days), TODAY));
    expect(e.start).toBe('2026-12-19');
    expect(e.openingNote).toBe('Voorstellingen op 6 dagen, meestal om 11:00 en 15:00 (niet op di 22 dec, wo 23 dec)');
  });
});
