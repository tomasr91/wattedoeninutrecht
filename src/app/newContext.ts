import { createContext } from 'react';

/** IDs van activiteiten die sinds een eerder bezoek zijn toegevoegd (label "Nieuw"). */
export const NewContext = createContext<Set<string>>(new Set());
