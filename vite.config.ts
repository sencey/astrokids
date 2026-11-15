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
          // React and react-three-fiber share one chunk: split apart, the two chunks imported each other and the
          // production build crashed at start-up ("Cannot read properties of undefined (reading 'useLayoutEffect')").
          if (/node_modules[\\/](@react-three|three-stdlib|zustand|suspend-react|its-fine|react-reconciler|scheduler|react|react-dom|use-sync-external-store)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
