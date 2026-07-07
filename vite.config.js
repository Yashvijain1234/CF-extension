import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './manifest.config';

export default defineConfig({
  // Relative asset paths so dynamic imports work from content scripts injected
  // on external pages (absolute "/assets/..." URLs would hit codeforces.com).
  base: './',
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    // Vite's modulepreload helper injects <link href="/assets/..."> which breaks
    // on third-party pages; the dynamic import itself is enough.
    modulePreload: false,
    rollupOptions: {
      // Ensure large chunks (Monaco) don't spam warnings.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
