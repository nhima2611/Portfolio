import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep three.js in its own chunk so app changes don't bust its cache.
        manualChunks: { three: ['three'], r3f: ['@react-three/fiber'] },
      },
    },
  },
});
