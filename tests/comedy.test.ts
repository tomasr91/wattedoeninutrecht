/** Comedyhuis en Hofman. De HTML hieronder is ⚠️ TESTDATA, nagebouwd naar de opbouw van 21-10-2026. */
import { describe, expect, it } from 'vitest';
import { comedyToRaw, isRealShow, parseComedyhuis } from '../collector/adapters/comedyhuis';
import { wednesdays, weeklyComedyTime } from '../collector/adapters/hofman';

const card = (slug: string, title: string, taal: string, place: string, date: string, time: string, desc = 'Een avond stand-up met een MC en drie acts.') => `
<div class="fwpl-result r1"><div class="fwpl-item img"><a href="https://comedyhuis.nl/shows/${slug}/"><img src="x.jpg" alt=""><noscript><img src="x.jpg"></noscript></a></div>
<div class="fwpl-item t"><a href="https://comedyhuis.nl/shows/${slug}/">${title}</a></div>
<div class="fwpl-item d">${desc}</div>
<div class="fwpl-item vlag"><img src="flag.webp"></div><div class="fwpl-item taal">${taal}</div><div class="fwpl-item p">${place}</div>
<div class="fwpl-item ticketlink"><a href="https://shop.example/x">Tickets</a></div>
<div class="fwpl-item dt">${date}</div><div class="fwpl-item tm">${time}</div><div class="fwpl-item show-status">Tickets te koop</div></div>`;

const html = `<html><body>
${card('vrijdagavondshow-23-oktober', '[TESTDATA] Vrijdagavondshow', 'Nederlands', 'Catharijnepoort 6', 'vr 23 okt', '20:30', 'Tickets €18,95.')}
${card('all-english-23-october', '[TESTDATA] All English Comedy Night', 'Engels', 'Oudegracht 36', 'vr 23 okt', '20:30')}
${card('open-mic', '[TESTDATA] Open Mic Regulars', 'Nederlands', 'Catharijnepoort 6', 'wo 21 okt', '20:30')}
${card('comedy-cloud', '[TESTDATA] Comedy Cloud', 'Nederlands', 'TivoliVredenburg', 'do 29 okt', '20:30')}
${card('showcase', '[TESTDATA] International Showcase', 'Engels', 'Oudegracht aan de Werf 145', 'zo 25 okt', '15:00')}
</body></html>`;

describe('Comedyhuis', () => {
  const items = parseComedyhuis(html, '2026-10-21');
  const shows = items.filter((i) => isRealShow(i)).map((i) => comedyToRaw(i, '2026-10-21T00:00:00Z'));
  it('leest titel, datum (met jaar), tijd, taal en plek', () => {
    expect(items[0]).toMatchObject({ title: '[TESTDATA] Vrijdagavondshow', date: '2026-10-23', time: '20:30', language: 'Nederlands', place: 'Catharijnepoort 6' });
  });
  it('slaat open mics en shows in Tivoli over, houdt Engelstalige avonden', () => {
    expect(shows.map((s) => s.title)).toEqual(['[TESTDATA] Vrijdagavondshow', '[TESTDATA] All English Comedy Night', '[TESTDATA] International Showcase (Engelstalig)']);
  });
  it('herkent de zalen en de prijs', () => {
    expect(shows.map((s) => s.venueName)).toEqual(['Comedyhuis', 'De Kargadoor', 'Comedyhuis aan de Werf']);
    expect(shows[0].priceText).toBe('€18,95');
    expect(shows[0].start).toBe('2026-10-23T20:30');
  });
});

describe('Hofman', () => {
  it('vindt de wekelijkse comedyavond en de begintijd', () => {
    expect(weeklyComedyTime('<p>Iedere woensdagavond comedy. Utrecht Lacht begint om 20:30.</p>')).toBe('20:30');
    expect(weeklyComedyTime('<p>Pubquiz op dinsdag.</p>')).toBeUndefined();
  });
  it('geeft alle woensdagen in het venster', () => {
    expect(wednesdays('2026-10-21', '2026-11-05')).toEqual(['2026-10-21', '2026-10-28', '2026-11-04']);
    expect(wednesdays('2026-10-22', '2026-10-28')).toEqual(['2026-10-28']);
  });
});
