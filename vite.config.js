import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'public-build',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        login: resolve(import.meta.dirname, 'login/index.html'),
        team: resolve(import.meta.dirname, 'equipo/index.html'),
        join: resolve(import.meta.dirname, 'unirse/index.html'),
        organizer: resolve(import.meta.dirname, 'organizador/index.html'),
        tactics: resolve(import.meta.dirname, 'tactica/index.html'),
        matches: resolve(import.meta.dirname, 'jdm/index.html')
      }
    }
  }
});
