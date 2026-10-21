import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH maakt publiceren onder een submap mogelijk (bv. GitHub Pages: /utrecht-family-agenda/).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString()),
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? '').slice(0, 7)),
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
