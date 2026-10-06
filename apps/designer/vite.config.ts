import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fiducial/shared-types': fileURLToPath(new URL('../../packages/shared-types/src/index.ts', import.meta.url)),
      '@fiducial/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@fiducial/renderer': fileURLToPath(new URL('../../packages/renderer/src/index.ts', import.meta.url)),
      '@fiducial/serialization': fileURLToPath(new URL('../../packages/serialization/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
