/**
 * Frame-animation runtime, render-only.
 *
 * A clip is a list of pre-decoded frames plus a playback rate and an anchor — the point of the
 * image that sits on the character's feet, so a frame whose silhouette grows (a raised sword, a
 * body falling over) doesn't make the character slide around. Nothing here touches the sim: the
 * clip to play and the time to play it at are both derived from the snapshot, so combats stay
 * reproducible.
 */

export interface AnimClip {
  fps: number;
  loop: boolean;
  /** Frame images as data URIs (see src/render/animations.ts). */
  frames: string[];
  /** Anchor within the frame, 0..1 — the character's ground contact point. */
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
}

/** All the clips of one character, keyed by state name ('idle', 'walk', 'attack', 'death'). */
export type AnimSet = Record<string, AnimClip>;

const imgCache = new Map<string, HTMLImageElement | null>();
function frameImage(uri: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const cached = imgCache.get(uri);
  if (cached !== undefined) return cached;
  const img = new Image();
  img.src = uri;
  imgCache.set(uri, img);
  return img;
}

/** Frame index at time `t` seconds into the clip. Looping clips wrap; one-shots hold their last. */
export function frameIndex(clip: AnimClip, t: number): number {
  const n = clip.frames.length;
  if (n === 0) return 0;
  const raw = Math.floor(Math.max(0, t) * clip.fps);
  return clip.loop ? raw % n : Math.min(raw, n - 1);
}

/** Seconds a one-shot clip needs to reach its last frame. */
export function clipDuration(clip: AnimClip): number {
  return clip.frames.length / clip.fps;
}

export function clipFinished(clip: AnimClip, t: number): boolean {
  return !clip.loop && t >= clipDuration(clip);
}

/**
 * Draws the clip so its anchor lands on (groundX, groundY) and the frame stands `height` pixels
 * tall. Returns false when the frame hasn't decoded yet, so callers can fall back to a static
 * sprite instead of leaving a hole.
 */
export function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: AnimClip,
  t: number,
  groundX: number,
  groundY: number,
  height: number,
): boolean {
  const uri = clip.frames[frameIndex(clip, t)];
  if (!uri) return false;
  const img = frameImage(uri);
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  const scale = height / clip.h;
  const w = clip.w * scale;
  const h = clip.h * scale;
  ctx.drawImage(img, groundX - clip.anchorX * w, groundY - clip.anchorY * h, w, h);
  return true;
}
