import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  plugins: [
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    compression({ algorithm: 'gzip', ext: '.gz' }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
