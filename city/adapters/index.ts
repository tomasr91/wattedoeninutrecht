/**
 * Eigen adapters van deze stad (stadsprofiel). De sleutel is de bron-ID in
 * collector/sources.config.json. Algemene adapters (handmatig, vaste-plekken,
 * pathe en de types ical/jsonld/tribe) levert de verzamellaag zelf: zie
 * collector/adapters/registry.ts.
 */
import type { SourceAdapter } from '../../collector/adapters/types.ts';
import { uitagendaUtrecht } from './uitagenda-utrecht.ts';
import { bibliotheekUtrecht } from './bibliotheek-utrecht.ts';
import { podiumHogeWoerd } from './podium-hoge-woerd.ts';
import { tivoliVredenburg } from './tivolivredenburg.ts';
import { stadsschouwburgUtrecht } from './stadsschouwburg-utrecht.ts';
import { podiumSprits } from './podium-sprits.ts';
import { utrechtNatuurlijk } from './utrecht-natuurlijk.ts';
import { kasteelDeHaar } from './kasteel-de-haar.ts';
import { jaarbeurs } from './jaarbeurs.ts';
import { comedyhuis } from './comedyhuis.ts';
import { hofman } from './hofman.ts';

export const CITY_ADAPTERS: Record<string, SourceAdapter> = {
  'uitagenda-utrecht': uitagendaUtrecht,
  'bibliotheek-utrecht': bibliotheekUtrecht,
  'podium-hoge-woerd': podiumHogeWoerd,
  tivolivredenburg: tivoliVredenburg,
  'stadsschouwburg-utrecht': stadsschouwburgUtrecht,
  'podium-sprits': podiumSprits,
  'utrecht-natuurlijk': utrechtNatuurlijk,
  'kasteel-de-haar': kasteelDeHaar,
  jaarbeurs,
  comedyhuis,
  hofman,
};
