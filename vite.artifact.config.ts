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
    // Base64-inline imported texture/icon assets (see src/assets/) so the single-file artifact
    // preview stays fully self-contained — the Artifact tool only publishes the one HTML file,
    // not the sibling static files a normal build would emit. The real build (vite.config.ts)
    // keeps Vite's small default limit so production keeps these as separate cacheable files.
    assetsInlineLimit: 2_000_000,
  },
});
