import { createContext } from 'react';

/** IDs van activiteiten die sinds een eerder bezoek zijn toegevoegd (label "Nieuw"). */
export const NewContext = createContext<Set<string>>(new Set());

/** Afstand (km) tot waar een activiteit als "dichtbij" gemarkeerd wordt; 0 = uit. */
export const NearContext = createContext<number>(0);
