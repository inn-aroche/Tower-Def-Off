import { defineConfig } from 'vite';

// Produces a single JS-file build (no chunk splitting) for scripts/build-artifact.mjs to inline
// into one self-contained HTML file — used to share a live, playable preview (e.g. Claude
// Artifacts). Not used by the real build/deploy pipeline; see vite.config.ts for that.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
