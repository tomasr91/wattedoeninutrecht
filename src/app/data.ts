import type { Dataset } from '../domain/types';

/**
 * Laadt de dataset die de wekelijkse update exporteert (public/data/activities.json).
 * Als de pagina als losse, ingepakte versie draait, staat de dataset in de pagina zelf
 * (<script type="application/json" id="ufa-dataset">).
 */
export async function loadDataset(): Promise<Dataset> {
  const embedded = document.getElementById('ufa-dataset');
  if (embedded?.textContent?.trim()) {
    return clean(JSON.parse(embedded.textContent) as Dataset);
  }
  const res = await fetch('./data/activities.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`De activiteiten konden niet worden geladen (HTTP ${res.status}).`);
  return clean((await res.json()) as Dataset);
}

/** Testdata komt nooit in de app terecht, ook niet per ongeluk. */
function clean(d: Dataset): Dataset {
  return { ...d, activities: d.activities.filter((a) => !a.isTestData) };
}
