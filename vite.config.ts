import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Prefer TypeScript sources: a stray `tsc` emit once left .js twins in src/ that silently shadowed the .ts files.
  resolve: { extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'] },
  // Data pipelines write large/locked files there; watching them crashed the dev server (EBUSY on Windows).
  server: { watch: { ignored: ['**/scripts/**', '**/data/**', '**/art/**', '**/supabase/**', '**/.github/**'] } },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: app-code changes do not bust the (large) three / r3f / react caches.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'vendor-three';
          if (/node_modules[\\/](@react-three|three-stdlib|zustand|suspend-react|its-fine|react-reconciler|scheduler)[\\/]/.test(id)) return 'vendor-r3f';
          if (/node_modules[\\/](react|react-dom)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
