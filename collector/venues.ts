/**
 * Bekende locaties met benaderde coördinaten (precisie ca. 0,3–0,5 km) en
 * wijk/plaats. Bedoeld voor afstandsindicaties; de app toont afstanden
 * daarom altijd als "ca.". Met GEOCODER=nominatim worden adressen tijdens de
 * update preciezer opgezocht (zie geocode.ts).
 *
 * Voeg locaties toe als ze vaak voorkomen; laat coördinaten weg als je ze
 * niet zeker weet — dan valt de app terug op de wijk/plaats.
 */
export interface KnownVenue {
  name: string;
  aliases: RegExp;
  locality: string;
  address?: string;
  lat?: number;
  lon?: number;
  indoor?: 'binnen' | 'buiten' | 'beide';
}

export const VENUES: KnownVenue[] = [
  // — Leidsche Rijn en directe omgeving —
  { name: 'Bibliotheek Leidsche Rijn Centrum', aliases: /bibliotheek leidsche rijn( centrum)?|leidsche rijn centrum$/i, locality: 'Leidsche Rijn Centrum', lat: 52.0943, lon: 5.059, indoor: 'binnen' },
  { name: 'Bibliotheek Vleuterweide', aliases: /bibliotheek vleuterweide|^vleuterweide$/i, locality: 'Vleuterweide', lat: 52.1033, lon: 5.0208, indoor: 'binnen' },
  { name: 'Bibliotheek Vleuten', aliases: /bibliotheek vleuten|^vleuten$/i, locality: 'Vleuten', lat: 52.1081, lon: 5.0128, indoor: 'binnen' },
  { name: 'Bibliotheek De Meern', aliases: /bibliotheek de meern|^de meern$/i, locality: 'De Meern', lat: 52.0815, lon: 5.0335, indoor: 'binnen' },
  { name: 'Podium Hoge Woerd', aliases: /podium hoge woerd/i, locality: 'De Meern', address: 'Hoge Woerdplein 1, 3454 PB Utrecht', lat: 52.0838, lon: 5.0413, indoor: 'binnen' },
  { name: 'Museum Hoge Woerd', aliases: /museum hoge woerd|castellum hoge woerd|de meern 1|romeins schip/i, locality: 'De Meern', address: 'Hoge Woerdplein 1, 3454 PB Utrecht', lat: 52.0838, lon: 5.0413, indoor: 'binnen' },
  { name: 'Máximapark', aliases: /m[aá]ximapark/i, locality: 'Vleuten', address: 'Utrechtseweg 4, 3451 GG Vleuten', lat: 52.1, lon: 5.043, indoor: 'buiten' },
  { name: 'Kasteel de Haar', aliases: /kasteel de haar/i, locality: 'Haarzuilens', address: 'Kasteellaan 1, 3455 RR Haarzuilens', lat: 52.1214, lon: 4.9939 },
  { name: 'Leidsche Rijn Centrum', aliases: /^leidsche rijn centrum( \(.*\))?$|berlijnplein/i, locality: 'Leidsche Rijn Centrum', lat: 52.095, lon: 5.061 },

  // — Stad Utrecht —
  { name: 'Bibliotheek Neude', aliases: /bibliotheek neude|^neude$/i, locality: 'Binnenstad', address: 'Neude 11, Utrecht', lat: 52.0928, lon: 5.1189, indoor: 'binnen' },
  { name: 'Bibliotheek Kanaleneiland', aliases: /bibliotheek kanaleneiland|^kanaleneiland$/i, locality: 'Kanaleneiland', lat: 52.0748, lon: 5.0925, indoor: 'binnen' },
  { name: 'Bibliotheek Overvecht', aliases: /bibliotheek overvecht|^overvecht$/i, locality: 'Overvecht', lat: 52.116, lon: 5.111, indoor: 'binnen' },
  { name: 'Bibliotheek Zuilen', aliases: /bibliotheek zuilen|^zuilen$/i, locality: 'Zuilen', lat: 52.1078, lon: 5.0918, indoor: 'binnen' },
  { name: 'Bibliotheek Oog in Al', aliases: /bibliotheek oog in al|^oog in al$/i, locality: 'Oog in Al', lat: 52.0886, lon: 5.0918, indoor: 'binnen' },
  { name: 'Bibliotheek Hoograven', aliases: /bibliotheek hoograven|^hoograven$/i, locality: 'Hoograven', lat: 52.076, lon: 5.13, indoor: 'binnen' },
  { name: 'Bibliotheek Tuinwijk', aliases: /bibliotheek tuinwijk|^tuinwijk$/i, locality: 'Tuinwijk', lat: 52.1017, lon: 5.1287, indoor: 'binnen' },
  { name: 'Bibliotheek Lunetten', aliases: /bibliotheek lunetten|^lunetten$/i, locality: 'Lunetten', lat: 52.0625, lon: 5.138, indoor: 'binnen' },
  { name: 'Stadsschouwburg Utrecht', aliases: /stadsschouwburg utrecht/i, locality: 'Binnenstad', address: 'Lucasbolwerk 24, Utrecht', lat: 52.092, lon: 5.1255, indoor: 'binnen' },
  { name: 'Theater Kikker', aliases: /theater kikker/i, locality: 'Binnenstad', address: 'Ganzenmarkt 14, Utrecht', lat: 52.0907, lon: 5.1192, indoor: 'binnen' },
  { name: 'TivoliVredenburg', aliases: /tivoli\s?vredenburg/i, locality: 'Binnenstad', lat: 52.0927, lon: 5.1135, indoor: 'binnen' },
  { name: 'ZIMIHC theater Zuilen', aliases: /zimihc theater zuilen/i, locality: 'Zuilen', lat: 52.1093, lon: 5.089, indoor: 'binnen' },
  { name: 'ZIMIHC theater Stefanus', aliases: /zimihc theater stefanus/i, locality: 'Overvecht', lat: 52.115, lon: 5.113, indoor: 'binnen' },
  { name: 'Kanaal30', aliases: /kanaal\s?30/i, locality: 'Oog in Al', address: 'Kanaalweg 30, Utrecht', lat: 52.089, lon: 5.092, indoor: 'binnen' },
  { name: 'Jaarbeurs', aliases: /jaarbeurs/i, locality: 'Jaarbeurs', lat: 52.0855, lon: 5.105, indoor: 'binnen' },
  { name: 'Centraal Museum', aliases: /centraal museum/i, locality: 'Binnenstad', address: 'Agnietenstraat 1, Utrecht', lat: 52.0835, lon: 5.124, indoor: 'binnen' },
  { name: 'Nijntje Museum', aliases: /nijntje museum|miffy museum/i, locality: 'Binnenstad', lat: 52.0838, lon: 5.1235, indoor: 'binnen' },
  { name: 'Museum Catharijneconvent', aliases: /catharijneconvent/i, locality: 'Binnenstad', address: 'Lange Nieuwstraat 38, Utrecht', lat: 52.0868, lon: 5.1223, indoor: 'binnen' },
  { name: 'Universiteitsmuseum (UMU)', aliases: /universiteitsmuseum|\bumu\b/i, locality: 'Binnenstad', lat: 52.087, lon: 5.124, indoor: 'binnen' },
  { name: 'Museum Speelklok', aliases: /museum speelklok/i, locality: 'Binnenstad', lat: 52.0915, lon: 5.1205, indoor: 'binnen' },
  { name: 'Spoorwegmuseum', aliases: /spoorwegmuseum/i, locality: 'Oost', lat: 52.088, lon: 5.133, indoor: 'beide' },
  { name: 'Museum Sonnenborgh', aliases: /sonnenborgh/i, locality: 'Binnenstad', lat: 52.0848, lon: 5.1269, indoor: 'binnen' },
  { name: 'Domplein', aliases: /^domplein/i, locality: 'Binnenstad', lat: 52.0907, lon: 5.1214, indoor: 'buiten' },
  { name: 'Jacobikerk', aliases: /jacobikerk/i, locality: 'Binnenstad', lat: 52.0942, lon: 5.117, indoor: 'binnen' },
  { name: 'Stadhuis Utrecht', aliases: /stadhuis utrecht/i, locality: 'Binnenstad', lat: 52.0916, lon: 5.1186, indoor: 'binnen' },
  { name: 'Nicolaïkerk', aliases: /nicola[iï]kerk/i, locality: 'Binnenstad', lat: 52.0855, lon: 5.1232, indoor: 'binnen' },
  { name: 'Werkspoorkathedraal', aliases: /werkspoorkathedraal/i, locality: 'Zuilen', lat: 52.106, lon: 5.084, indoor: 'binnen' },

  // — Omgeving —
  { name: 'Waterliniemuseum Fort bij Vechten', aliases: /fort bij vechten|waterliniemuseum/i, locality: 'Bunnik', lat: 52.059, lon: 5.1685, indoor: 'beide' },
];

export function lookupVenue(name: string | undefined): KnownVenue | undefined {
  if (!name) return undefined;
  const n = name.trim();
  return VENUES.find((v) => v.aliases.test(n) || v.name.toLowerCase() === n.toLowerCase());
}
