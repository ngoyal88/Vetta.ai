import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      firebaseConfig: path.resolve(root, 'src/firebaseConfig.ts'),
      routes: path.resolve(root, 'src/routes'),
      features: path.resolve(root, 'src/features'),
      shared: path.resolve(root, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
