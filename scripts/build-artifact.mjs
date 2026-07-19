#!/usr/bin/env node
/**
 * Inlines the single-file build (dist-artifact/, produced by `vite build --config
 * vite.artifact.config.ts`) into one self-contained HTML fragment suitable for sharing as a
 * live preview (e.g. a Claude Artifact, which supplies its own <!doctype>/<html>/<head>/<body>
 * skeleton — hence stripping those tags here rather than leaving a nested document).
 *
 * Usage: npm run build:artifact
 * Output: dist-artifact/artifact-fragment.html
 *
 * Gotcha this guards against: naively doing
 *   html.replace(scriptTagRe, `<script type="module">${js}</script>`)
 * is broken — String.replace() treats "$&", "$1", "$$" etc. in the REPLACEMENT STRING as special
 * patterns, and minified JS bundles reliably contain "$&" somewhere by chance, corrupting the
 * output. A replacer FUNCTION sidesteps this since its return value is inserted verbatim.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist-artifact');

const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const assetFiles = readdirSync(path.join(distDir, 'assets'));
const jsFile = assetFiles.find((f) => f.endsWith('.js'));
if (!jsFile) throw new Error('No JS bundle found in dist-artifact/assets — run the vite build first.');
const js = readFileSync(path.join(distDir, 'assets', jsFile), 'utf8');

const scriptTagRe = /<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>/;
if (!scriptTagRe.test(html)) throw new Error('Expected script tag not found in dist-artifact/index.html');

let inlined = html.replace(scriptTagRe, () => `<script type="module">\n${js}\n</script>`);

// Vite always extracts CSS into its own file even with cssCodeSplit:false — inline it too so the
// fragment has no sibling-file dependency (Claude Artifacts publish only the one HTML file).
const cssFile = assetFiles.find((f) => f.endsWith('.css'));
if (cssFile) {
  const css = readFileSync(path.join(distDir, 'assets', cssFile), 'utf8');
  const linkTagRe = /<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+">/;
  if (!linkTagRe.test(inlined)) throw new Error('Expected stylesheet link tag not found in dist-artifact/index.html');
  inlined = inlined.replace(linkTagRe, () => `<style>\n${css}\n</style>`);
}

const fragment = inlined
  .replace(/^<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '');

const outPath = path.join(distDir, 'artifact-fragment.html');
writeFileSync(outPath, fragment);
console.log(`Wrote ${outPath} (${(statSync(outPath).size / 1024).toFixed(0)} KB)`);
