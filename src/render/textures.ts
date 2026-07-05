import * as THREE from 'three';
import type { TowerId } from '../data/towers';

/**
 * Bulk-imported via import.meta.glob (not plain `/public` paths) so Vite treats every PNG as a
 * real module-graph asset: the normal build keeps them as separate cacheable files, while the
 * single-file artifact preview build (vite.artifact.config.ts, raised assetsInlineLimit) base64-
 * inlines them instead — same source, two different packaging strategies, no code branching needed.
 */
const towerSources = import.meta.glob<string>('../assets/textures/towers/*.png', {
  eager: true,
  import: 'default',
});
const tileSources = import.meta.glob<string>('../assets/textures/tiles/*.png', {
  eager: true,
  import: 'default',
});
const iconSources = import.meta.glob<string>('../assets/icons/*.png', {
  eager: true,
  import: 'default',
});

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function keyByBasename(sources: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, url] of Object.entries(sources)) map.set(basename(path), url);
  return map;
}

const towerUrls = keyByBasename(towerSources);
const tileUrls = keyByBasename(tileSources);
const iconUrls = keyByBasename(iconSources);

/** Vitest's sim/render unit tests run under Node (no DOM), where THREE.TextureLoader would throw
 * synchronously trying to create an <img> element — degrade to "no texture" there instead of
 * crashing every test that constructs a TowerView/GridView. */
const hasDom = typeof document !== 'undefined';
const loader = hasDom ? new THREE.TextureLoader() : null;
const textureCache = new Map<string, THREE.Texture>();

function loadCached(url: string): THREE.Texture | null {
  if (!loader) return null;
  let tex = textureCache.get(url);
  if (!tex) {
    tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    textureCache.set(url, tex);
  }
  return tex;
}

export type TileKind = 'ground' | 'path' | 'blocked' | 'spawn' | 'exit';

export function towerTexture(towerId: TowerId, tier: 1 | 2 | 3, skinId: string): THREE.Texture | null {
  const url = towerUrls.get(`tower_${towerId}_t${tier}_${skinId}.png`);
  return url ? loadCached(url) : null;
}

export function tileTexture(kind: TileKind): THREE.Texture | null {
  const url = tileUrls.get(`tile_${kind}.png`);
  return url ? loadCached(url) : null;
}

/** Plain <img>-friendly URL (not a THREE.Texture) for DOM icons in HUD.ts / MainMenu.ts. */
export function iconUrl(name: string): string | null {
  return iconUrls.get(`icon_${name}.png`) ?? null;
}
