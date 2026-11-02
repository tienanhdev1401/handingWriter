import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks(id) {
          if (id.includes('gifenc')) return 'gifenc';
          if (id.includes('jszip')) return 'jszip';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['gifenc', 'jszip'],
  },
  server: {
    fs: { strict: false },
  },
});
