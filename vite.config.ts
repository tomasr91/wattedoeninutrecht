import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH maakt publiceren onder een submap mogelijk (bv. GitHub Pages: /utrecht-family-agenda/).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
