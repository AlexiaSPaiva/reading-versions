import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` must match the repository name: the app is served from
// https://alexiaspaiva.github.io/reading-versions/ by GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: '/reading-versions/',
  test: {
    // Only src/domain is unit-tested, and it is pure: no DOM, so no jsdom.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
