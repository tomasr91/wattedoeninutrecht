import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { CITY } from './city/config';

/** Webmanifest (installeerbare app) uit het stadsprofiel. */
function manifest(): string {
  return JSON.stringify(
    {
      name: CITY.app.name,
      short_name: CITY.app.name,
      description: CITY.app.manifestDescription,
      lang: 'nl',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: CITY.theme.headBg,
      theme_color: CITY.theme.headBg,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  );
}

/** Zet naam, beschrijving en kleur van het stadsprofiel in index.html en levert de webmanifest. */
function cityProfile(): Plugin {
  return {
    name: 'city-profile',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%CITY_APP_NAME%', CITY.app.name)
        .replaceAll('%CITY_APP_DESCRIPTION%', CITY.app.description)
        .replaceAll('%CITY_THEME_COLOR%', CITY.theme.headBg),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith('/manifest.webmanifest')) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() + '\n' });
    },
  };
}

// BASE_PATH maakt publiceren onder een submap mogelijk (bv. GitHub Pages: /<repository>/).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react(), cityProfile()],
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString()),
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? '').slice(0, 7)),
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/**/*.test.ts', 'city/tests/**/*.test.ts'],
    environment: 'node',
  },
});
