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

/** Base colors sampled from the corresponding tile_<kind>.png art, so the flat tiles below stay
 * on-palette with the rest of the (isometric-diamond) art set even though they don't reuse its pixels. */
const FLAT_TILE_COLORS: Record<TileKind, string> = {
  ground: '#50b764',
  path: '#f3c27d',
  blocked: '#484765',
  spawn: '#99e68e',
  exit: '#f48d90',
};

function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

const flatTileCache = new Map<TileKind, THREE.Texture>();

/** Flat, edge-to-edge square tile for the ground plane: solid fill plus a thin inset border, so
 * adjacent cells read as one connected floor with just enough delineation to tell cells apart.
 * The tile_<kind>.png art is drawn as an isometric diamond with a thick 3D bevel — correct for a
 * diamond-tiled isometric grid, but this game uses a flat top-down square grid, so stamping that
 * art edge-to-edge on square cells left visible gaps and read as separate tilted floating tiles. */
export function flatTileTexture(kind: TileKind): THREE.Texture | null {
  if (!hasDom) return null;
  const cached = flatTileCache.get(kind);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const color = FLAT_TILE_COLORS[kind];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = darken(color, 0.65);
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  flatTileCache.set(kind, tex);
  return tex;
}

/** Plain <img>-friendly URL (not a THREE.Texture) for DOM icons in HUD.ts / MainMenu.ts. */
export function iconUrl(name: string): string | null {
  return iconUrls.get(`icon_${name}.png`) ?? null;
}

/** <img> tag for a provided icon, or the emoji fallback if that icon wasn't part of the art
 * handoff (icon_lock/icon_play were never generated — see design_handoff_art_assets/README.md). */
export function iconHtml(name: string, fallbackEmoji: string, className = 'ui-icon'): string {
  const url = iconUrl(name);
  return url ? `<img class="${className}" src="${url}" alt="" />` : fallbackEmoji;
}
