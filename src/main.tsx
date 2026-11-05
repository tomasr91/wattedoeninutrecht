import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';
import { CITY } from '../city/config';

// Kleuren uit het stadsprofiel. Inline op <html>, zodat ze voor de stylesheet gaan (ook in de losse artifact-pagina).
const theme: Record<string, string> = {
  '--brand': CITY.theme.brand,
  '--brand-ink': CITY.theme.brandInk,
  '--brand-soft': CITY.theme.brandSoft,
  '--head-bg': CITY.theme.headBg,
  '--head-muted': CITY.theme.headMuted,
  '--head-landmark': CITY.theme.headLandmark,
  '--day-ink': CITY.theme.dayInk,
};
for (const [k, v] of Object.entries(theme)) document.documentElement.style.setProperty(k, v);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installeerbaar als app (PWA). Faalt stil waar service workers niet mogen (previews, privévensters).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
