import type { Activity, AgeInfo, Child } from './types';
import { dateOf, parseDateKey, todayInAmsterdam, toDateKey } from './dates';

export interface Age {
  years: number;
  months: number;
  totalMonths: number;
}

/** Leeftijd op een specifieke datum (bv. de dag van een activiteit), in hele maanden. */
export function ageOnDate(birthDate: string, onDate: string): Age {
  const b = parseDateKey(birthDate);
  const d = parseDateKey(dateOf(onDate));
  let totalMonths =
    (d.getUTCFullYear() - b.getUTCFullYear()) * 12 + (d.getUTCMonth() - b.getUTCMonth());
  if (d.getUTCDate() < b.getUTCDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, totalMonths };
}

export function formatAge(age: Age): string {
  if (age.years === 0) return `${age.months} mnd`;
  if (age.months === 0) return `${age.years} jaar`;
  if (age.months === 6) return `${age.years},5 jaar`;
  return `${age.years} jr ${age.months} mnd`;
}

/** Geboortedatum afleiden van een opgegeven leeftijd (in maanden) op een peildatum. */
export function birthDateFromAge(totalMonths: number, onDate: string = todayInAmsterdam()): string {
  const d = parseDateKey(onDate);
  d.setUTCMonth(d.getUTCMonth() - totalMonths);
  return toDateKey(d);
}

export type Fit = 'geschikt' | 'mogelijk' | 'te-jong' | 'te-oud' | 'onbekend' | 'niet-voor-kinderen';

export interface ChildFit {
  childId: string;
  childName: string;
  age: Age;
  fit: Fit;
  /** 'officieel' = de bron noemt de grens; 'geschat' = onze inschatting. */
  basis: 'officieel' | 'geschat' | 'geen';
  reason: string;
}

const MARGIN_BELOW_MONTHS = 6;

/** Kan een kind met deze leeftijd (maanden) mee naar een activiteit met deze leeftijdsinfo? */
export function fitForAge(
  ageMonths: number,
  info: AgeInfo,
  adultsOnly: boolean,
): { fit: Fit; basis: ChildFit['basis']; reason: string } {
  if (adultsOnly) return { fit: 'niet-voor-kinderen', basis: 'geen', reason: 'Voor volwassenen' };

  const { officialMinMonths: oMin, officialMaxMonths: oMax } = info;
  const { estimatedMinMonths: eMin, estimatedMaxMonths: eMax } = info;

  if (oMin !== undefined && ageMonths < oMin) {
    return { fit: 'te-jong', basis: 'officieel', reason: `Officieel vanaf ${monthsLabel(oMin)}` };
  }
  if (oMax !== undefined && ageMonths > oMax + 11) {
    return { fit: 'te-oud', basis: 'officieel', reason: `Officieel t/m ${monthsLabel(oMax)}` };
  }
  if (oMin !== undefined || oMax !== undefined) {
    // Binnen de officiële grenzen; een geschatte ondergrens kan nog een aandachtspunt geven.
    if (eMin !== undefined && ageMonths < eMin) {
      return { fit: 'mogelijk', basis: 'officieel', reason: `Mag mee, maar pas echt leuk vanaf ${monthsLabel(eMin)}` };
    }
    return { fit: 'geschikt', basis: 'officieel', reason: `Binnen leeftijd ${info.label ?? rangeLabel(oMin, oMax)}` };
  }

  if (eMin === undefined && eMax === undefined) {
    return { fit: 'onbekend', basis: 'geen', reason: 'Geen leeftijdsindicatie in de bron' };
  }
  // Een grove schatting op basis van het soort activiteit (lage zekerheid) is geen grens:
  // dan nooit verbergen, alleen waarschuwen. Zo mis je geen gezinsactiviteit door een te strenge gok.
  if (eMin !== undefined && ageMonths < eMin && info.estimateConfidence === 'laag') {
    return { fit: 'mogelijk', basis: 'geschat', reason: `Geschat vanaf ${monthsLabel(eMin)}; misschien nog wat jong` };
  }
  if (eMin !== undefined && ageMonths < eMin - MARGIN_BELOW_MONTHS) {
    return { fit: 'te-jong', basis: 'geschat', reason: `Geschat vanaf ${monthsLabel(eMin)}` };
  }
  if (eMin !== undefined && ageMonths < eMin) {
    return { fit: 'mogelijk', basis: 'geschat', reason: `Geschat vanaf ${monthsLabel(eMin)}; net wat jong` };
  }
  if (eMax !== undefined && ageMonths > eMax + 11) {
    return { fit: 'te-oud', basis: 'geschat', reason: `Geschat t/m ${monthsLabel(eMax)}` };
  }
  return { fit: 'geschikt', basis: 'geschat', reason: `Geschat geschikt (${rangeLabel(eMin, eMax)})` };
}

/**
 * Geschiktheid per kind, op basis van de leeftijd op de dag van de activiteit.
 * Voor doorlopende activiteiten geef je `onDate` mee: de eerste dag waarop je
 * er binnen de gekozen periode heen kunt (anders telt de startdatum).
 */
export function childFits(activity: Activity, children: Child[], onDate?: string): ChildFit[] {
  const adultsOnly =
    activity.audiences.length > 0 && activity.audiences.every((a) => a === 'volwassenen');
  const day = onDate && onDate > dateOf(activity.start) ? onDate : activity.start;
  return children.map((c, i) => {
    const age = ageOnDate(c.birthDate, day);
    const r = fitForAge(age.totalMonths, activity.age, adultsOnly);
    return { childId: c.id, childName: c.name.trim() || `Kind ${i + 1}`, age, ...r };
  });
}

export function monthsLabel(m: number): string {
  if (m % 12 === 0) return `${m / 12} jaar`;
  if (m < 12) return `${m} maanden`;
  if (m % 12 === 6) return `${Math.floor(m / 12)},5 jaar`;
  return `${Math.floor(m / 12)} jaar en ${m % 12} mnd`;
}

function rangeLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${yearsShort(min)}–${yearsShort(max)} jaar`;
  if (min !== undefined) return `${yearsShort(min)}+`;
  if (max !== undefined) return `t/m ${yearsShort(max)} jaar`;
  return 'alle leeftijden';
}

function yearsShort(m: number): string {
  const y = m / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1).replace('.', ',');
}

/** Samenvatting voor de kaart: voor wie is dit geschikt? */
export function fitSummary(fits: ChildFit[]): {
  label: string;
  tone: 'good' | 'ok' | 'bad' | 'neutral';
} {
  if (fits.length === 0) return { label: '', tone: 'neutral' };
  if (fits.every((f) => f.fit === 'niet-voor-kinderen')) return { label: 'Volwassenen', tone: 'neutral' };
  const good = fits.filter((f) => f.fit === 'geschikt');
  const maybe = fits.filter((f) => f.fit === 'mogelijk');
  if (good.length === fits.length) {
    return { label: fits.length > 2 ? 'Alle kinderen' : fits.length === 2 ? 'Beide kinderen' : `Geschikt voor ${good[0].childName}`, tone: 'good' };
  }
  if (good.length > 0) {
    return { label: `Geschikt voor ${good.map((f) => f.childName).join(' & ')}`, tone: 'ok' };
  }
  if (maybe.length > 0) return { label: 'Misschien nog wat jong', tone: 'ok' };
  if (fits.every((f) => f.fit === 'onbekend')) return { label: 'Leeftijd onbekend', tone: 'neutral' };
  if (fits.some((f) => f.fit === 'te-oud')) return { label: 'Voor jongere kinderen', tone: 'bad' };
  return { label: 'Nog te jong', tone: 'bad' };
}

/**
 * Leeftijd zoals de app hem toont. Een bronleeftijd zonder "ca.", een schatting
 * met "ca." en de reden. Een open bovengrens blijft open ("vanaf 6 jaar").
 */
export function ageDisplay(info: AgeInfo): { text: string; short: string; basis: 'bron' | 'schatting'; note: string } | undefined {
  const { officialMinMonths: oMin, officialMaxMonths: oMax, estimatedMinMonths: eMin, estimatedMaxMonths: eMax } = info;
  if (oMin !== undefined || oMax !== undefined) {
    if (info.label === 'alle leeftijden' || (oMin === 0 && oMax === undefined)) {
      return { text: 'Alle leeftijden', short: 'alle leeftijden', basis: 'bron', note: 'Volgens de bron' };
    }
    const r = yearsRange(oMin, oMax);
    return { text: r, short: r.replace(' jaar', ' jr'), basis: 'bron', note: info.officialFromText ? 'Volgens de omschrijving' : 'Volgens de bron' };
  }
  if (eMin !== undefined || eMax !== undefined) {
    const r = yearsRange(eMin, eMax);
    return { text: `ca. ${r}`, short: `ca. ${r.replace(' jaar', ' jr')}`, basis: 'schatting', note: info.estimateReason ? `Geschat: ${info.estimateReason}` : 'Geschat' };
  }
  return undefined;
}

function yearsRange(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return min === max ? `${yearsShort(min)} jaar` : `${yearsShort(min)}–${yearsShort(max)} jaar`;
  if (min !== undefined) return `vanaf ${yearsShort(min)} jaar`;
  return `t/m ${yearsShort(max!)} jaar`;
}
