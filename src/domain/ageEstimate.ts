/**
 * Leeftijdsschatting, gescheiden van de extractie.
 *
 * 1. Extractie: de adapters leveren titel, bronlabels en tekst aan.
 * 2. Normalisatie: `parseAgeLabel` (enrich.ts) zet expliciete leeftijden om
 *    ("4-8 jaar", "6+", "groep 3 t/m 5", "vanaf 2,5 jaar"). Dat is de bronlimiet.
 * 3. Beslisregels (dit bestand): noemt de bron geen leeftijd, dan schatten we
 *    een range uit levensfase-woorden en het soort activiteit.
 * 4. Presentatie: de app toont een schatting altijd als "ca." met de reden.
 *
 * Context (starttijd, duur) maakt géén leeftijdsgrens; dat blijft een
 * aandachtspunt. Een open bovengrens blijft open: we verzinnen geen maximum
 * als de regel er geen heeft.
 */

const Y = 12;

export type EstimateConfidence = 'middel' | 'laag';

export interface AgeEstimate {
  minMonths: number;
  maxMonths?: number;
  /** Korte reden voor de gebruiker, bv. "speurtocht" of "peuters en kleuters". */
  reason: string;
  confidence: EstimateConfidence;
}

interface StageRule {
  test: RegExp;
  min: number;
  max?: number;
  word: string;
}

/** Levensfase-woorden: alle treffers worden samengevoegd ("peuters en kleuters" → 2–6). */
const STAGES: StageRule[] = [
  { test: /\bbaby'?s?\b|\bzuigeling/, min: 0, max: 1 * Y, word: "baby's" },
  { test: /little ones|\bukkie|\bdreumes/, min: 1 * Y, max: 2 * Y, word: 'dreumesen' },
  { test: /\bpeuter/, min: 2 * Y, max: 4 * Y, word: 'peuters' },
  { test: /\bkleuter/, min: 4 * Y, max: 6 * Y, word: 'kleuters' },
  { test: /\bonderbouw\b/, min: 4 * Y, max: 8 * Y, word: 'onderbouw' },
  { test: /\bbovenbouw\b|\bbrugklas/, min: 8 * Y, max: 13 * Y, word: 'bovenbouw' },
  { test: /\bbasisschool(kinderen|leerlingen)?\b/, min: 4 * Y, max: 12 * Y, word: 'basisschool' },
  { test: /\btieners?\b|\bteens?\b/, min: 12 * Y, max: 16 * Y, word: 'tieners' },
  { test: /\bjongeren\b|\bjongerencrew|\byoung adults\b/, min: 12 * Y, max: 18 * Y, word: 'jongeren' },
];

interface TypeRule {
  test: RegExp;
  min: number;
  max?: number;
  reason: string;
  confidence: EstimateConfidence;
  /** Alleen toepassen als het item al voor kinderen/gezinnen is (bv. "workshop"). */
  needsKidContext?: boolean;
  /** Woorden die de regel uitschakelen. */
  unless?: RegExp;
}

/** Soort activiteit, specifiek vóór generiek. De eerste treffer telt. */
const TYPES: TypeRule[] = [
  { test: /babyconcert|baby\s*concert|muziek op schoot|krulmuziek/, min: 0, max: 3 * Y, reason: 'concert voor de allerkleinsten', confidence: 'middel' },
  { test: /peutervoorstelling|peuterconcert|peuterochtend|peuterdisco|peuterfeest/, min: 2 * Y, max: 4 * Y, reason: 'peuteractiviteit', confidence: 'middel' },
  { test: /voorlees|voorlezen|prentenboek|leesfeest|boekstart/, min: 2 * Y, max: 6 * Y, reason: 'voorlezen', confidence: 'middel' },
  { test: /poppenkast|poppenspel|figurentheater|marionet/, min: 3 * Y, max: 8 * Y, reason: 'poppenspel', confidence: 'middel' },
  { test: /verhalen|vertelling|vertelvoorstelling|verteltent|sprookje/, min: 3 * Y, max: 8 * Y, reason: 'verhalen vertellen', confidence: 'laag', needsKidContext: true },
  { test: /sint[\s-]?maarten|lampion/, min: 2 * Y, max: 10 * Y, reason: 'lampionnenoptocht', confidence: 'middel' },
  { test: /sinterklaas|intocht|pietenhuis|pieten|mega sint/, min: 2 * Y, max: 8 * Y, reason: 'sinterklaas', confidence: 'middel', unless: /gedicht|schrijven/ },
  { test: /nijntje|bumba|peppa|kleuterbios/, min: 1 * Y, max: 6 * Y, reason: 'figuur voor peuters en kleuters', confidence: 'middel' },
  { test: /spookhuis|griezel|engste/, min: 8 * Y, max: 14 * Y, reason: 'griezelen', confidence: 'laag' },
  { test: /escape\s?room/, min: 10 * Y, max: 16 * Y, reason: 'escape room', confidence: 'middel', needsKidContext: true },
  { test: /hip[\s-]?hop|breakdance|break dance|dance\s?crew|\bcrew\b|\bbattle\b|urban dance|streetdance|graffiti/, min: 10 * Y, max: 18 * Y, reason: 'urban dans voor jongeren', confidence: 'middel' },
  { test: /gaming|e-?sports|minecraft|fortnite|roblox/, min: 8 * Y, max: 14 * Y, reason: 'gaming', confidence: 'laag', needsKidContext: true },
  { test: /programmeer|programmeren|coding|codeer|robot|scratch|micro:?bit/, min: 7 * Y, max: 12 * Y, reason: 'programmeren of techniek', confidence: 'middel', needsKidContext: true },
  { test: /proefjes|experimenten|wetenschap|science|uitvinders?/, min: 6 * Y, max: 12 * Y, reason: 'proefjes en wetenschap', confidence: 'laag', needsKidContext: true },
  { test: /\blego\b/, min: 5 * Y, max: 12 * Y, reason: 'lego', confidence: 'laag', needsKidContext: true },
  { test: /speurtocht|zoektocht|puzzeltocht|ontdekkingstocht|kinderroute|kindertour|kinderrondleiding/, min: 5 * Y, max: 12 * Y, reason: 'speurtocht', confidence: 'laag' },
  { test: /pompoen/, min: 3 * Y, max: 10 * Y, reason: 'pompoenen', confidence: 'laag', needsKidContext: true },
  { test: /hutten bouwen|buitenspelen|natuurspeel|slootjes|kriebelbeestjes|beestjes zoeken/, min: 3 * Y, max: 10 * Y, reason: 'buitenspelen in de natuur', confidence: 'laag', needsKidContext: true },
  { test: /familierondleiding|familiespel|familiedag|familiezondag|familietour|gezinsrondleiding/, min: 4 * Y, max: 12 * Y, reason: 'familieactiviteit', confidence: 'laag' },
  { test: /disney on ice|circus/, min: 3 * Y, max: 12 * Y, reason: 'show voor het hele gezin', confidence: 'laag', needsKidContext: true },
  { test: /kinderboerderij|stadsboerderij|dieren voeren|dieren aaien|geitjes|lammetjes|pony/, min: 2 * Y, max: 10 * Y, reason: 'dieren en boerderij', confidence: 'laag', needsKidContext: true },
  { test: /knutsel|kinderworkshop|maak je eigen|creatief|schilderen|kleuren|kinderatelier|tekenen/, min: 4 * Y, max: 10 * Y, reason: 'knutselen of creatieve workshop', confidence: 'laag', needsKidContext: true },
  { test: /kinderdisco|kinderfeest|kindermiddag|kinderkermis|speeltuin|springkussen|kinderfestival/, min: 3 * Y, max: 10 * Y, reason: 'kinderfeest', confidence: 'laag' },
  { test: /familievoorstelling|kindervoorstelling|jeugdtheater|herfststukjes|winterstukjes|kindertheater|familieconcert|kinderconcert|kindervoorstelling/, min: 4 * Y, max: 12 * Y, reason: 'familievoorstelling', confidence: 'laag' },
  { test: /\bfilm\b|bioscoop|kinderfilm/, min: 4 * Y, max: 12 * Y, reason: 'kinderfilm', confidence: 'laag', needsKidContext: true },
];

function stageEstimate(text: string): AgeEstimate | undefined {
  const hits = STAGES.filter((s) => s.test.test(text));
  if (!hits.length) return undefined;
  const min = Math.min(...hits.map((h) => h.min));
  const max = hits.some((h) => h.max === undefined) ? undefined : Math.max(...hits.map((h) => h.max!));
  return { minMonths: min, maxMonths: max, reason: joinWords(hits.map((h) => h.word)), confidence: 'middel' };
}

function joinWords(w: string[]): string {
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} en ${w.at(-1)}`;
}

/**
 * Schat een leeftijdsrange als de bron er geen noemt.
 * `title` + `hints` zijn sterke tekst; `description` wordt alleen gebruikt voor
 * levensfase-woorden (bv. "voor peuters"), niet voor het soort activiteit, omdat
 * een omschrijving vaak meerdere programma's noemt.
 */
export function estimateAge(input: { title: string; hints?: string[]; description?: string; kidContext: boolean }): AgeEstimate | undefined {
  const strong = `${input.title} ${(input.hints ?? []).join(' ')}`.toLowerCase();
  const desc = (input.description ?? '').toLowerCase();

  // Levensfase-woorden alleen uit de titel: doelgroeplabels van een bron ("Kinderen", "Jongeren")
  // staan vaak samen op één activiteit en zeggen dan niets over de leeftijd.
  const stageStrong = stageEstimate(input.title.toLowerCase());
  if (stageStrong) return stageStrong;

  const type = TYPES.find((r) => r.test.test(strong) && (!r.needsKidContext || input.kidContext) && !(r.unless && r.unless.test(strong)));
  if (type) {
    // Een levensfase-woord in de omschrijving maakt de range van het soort activiteit nauwkeuriger.
    const stageDesc = stageEstimate(desc);
    if (stageDesc && overlaps(stageDesc, type)) {
      return { ...stageDesc, reason: `${type.reason}, ${stageDesc.reason}`, confidence: 'middel' };
    }
    return { minMonths: type.min, maxMonths: type.max, reason: type.reason, confidence: type.confidence };
  }

  const stageDesc = input.kidContext ? stageEstimate(desc) : undefined;
  if (stageDesc) return { ...stageDesc, confidence: 'laag' };
  return undefined;
}

function overlaps(a: AgeEstimate, r: { min: number; max?: number }): boolean {
  const aMax = a.maxMonths ?? 99 * Y;
  const rMax = r.max ?? 99 * Y;
  return a.minMonths <= rMax && r.min <= aMax;
}

/** Twijfelgeval: de bronlimiet en de schatting spreken elkaar duidelijk tegen. */
export function ageConflict(official: { min?: number; max?: number }, est: AgeEstimate | undefined): string | undefined {
  if (!est) return undefined;
  const oMin = official.min ?? 0;
  const oMax = official.max ?? 99 * Y;
  const eMax = est.maxMonths ?? 99 * Y;
  if (est.minMonths > oMax + 2 * Y || eMax + 2 * Y < oMin) {
    return `Bron noemt een andere leeftijd dan het soort activiteit doet vermoeden (${est.reason})`;
  }
  return undefined;
}
