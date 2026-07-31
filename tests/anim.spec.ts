import { describe, expect, it } from 'vitest';
import { clipDuration, clipFinished, frameIndex, type AnimClip } from '../src/render/anim';
import { ANIMATIONS } from '../src/render/animations';

const clip = (n: number, fps: number, loop: boolean): AnimClip => ({
  fps,
  loop,
  frames: Array.from({ length: n }, (_, i) => `frame-${i}`),
  anchorX: 0.5,
  anchorY: 0.9,
  w: 100,
  h: 100,
});

describe('frame animation playback', () => {
  it('advances one frame per 1/fps second', () => {
    const c = clip(8, 10, true);
    expect(frameIndex(c, 0)).toBe(0);
    expect(frameIndex(c, 0.09)).toBe(0);
    expect(frameIndex(c, 0.1)).toBe(1);
    expect(frameIndex(c, 0.35)).toBe(3);
  });

  it('wraps a looping clip and holds the last frame of a one-shot', () => {
    expect(frameIndex(clip(8, 10, true), 0.8)).toBe(0); // wrapped
    expect(frameIndex(clip(8, 10, true), 1.7)).toBe(1);
    expect(frameIndex(clip(8, 10, false), 5)).toBe(7); // held
  });

  it('reports when a one-shot is done — looping clips never are', () => {
    const once = clip(12, 9, false);
    expect(clipDuration(once)).toBeCloseTo(12 / 9);
    expect(clipFinished(once, 1)).toBe(false);
    expect(clipFinished(once, 1.4)).toBe(true);
    expect(clipFinished(clip(6, 5, true), 999)).toBe(false);
  });

  it('never returns an out-of-range index', () => {
    for (const c of [clip(6, 5, true), clip(6, 5, false)]) {
      for (const t of [-5, 0, 0.001, 1, 7.77, 1e4]) {
        const i = frameIndex(c, t);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(c.frames.length);
      }
    }
  });
});

describe('shipped animation sets', () => {
  it('gives the goblin a full walk/idle/attack/death set with decodable frames', () => {
    const goblin = ANIMATIONS.goblin;
    expect(goblin).toBeDefined();
    for (const name of ['idle', 'walk', 'attack', 'death']) {
      const c = goblin[name];
      expect(c, name).toBeDefined();
      expect(c.frames.length).toBeGreaterThan(1);
      expect(c.fps).toBeGreaterThan(0);
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
      for (const f of c.frames) expect(f.startsWith('data:image/webp;base64,')).toBe(true);
    }
    expect(goblin.death.loop).toBe(false); // a corpse must not get back up
    expect(goblin.walk.loop).toBe(true);
  });

  it('anchors every clip inside its frame', () => {
    for (const set of Object.values(ANIMATIONS)) {
      for (const c of Object.values(set)) {
        expect(c.anchorX).toBeGreaterThanOrEqual(0);
        expect(c.anchorX).toBeLessThanOrEqual(1);
        expect(c.anchorY).toBeGreaterThanOrEqual(0);
        expect(c.anchorY).toBeLessThanOrEqual(1);
      }
    }
  });
});
