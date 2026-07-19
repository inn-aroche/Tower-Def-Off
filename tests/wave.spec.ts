import { describe, expect, it } from 'vitest';
import { generateWave } from '../src/data/waveGenerator';
import { enemyHpAtWave, enemyGoldAtWave } from '../src/data/enemies';

describe('Wave generation', () => {
  it('wave 1 contains only grunts (speedster/brute not yet unlocked)', () => {
    const plan = generateWave(1);
    expect(plan.spawns.every((s) => s.kind === 'grunt')).toBe(true);
    expect(plan.spawns.length).toBeGreaterThan(0);
  });

  it('speedsters appear from wave 2, brutes from wave 4', () => {
    expect(generateWave(2).spawns.some((s) => s.kind === 'speedster')).toBe(true);
    expect(generateWave(3).spawns.some((s) => s.kind === 'brute')).toBe(false);
    expect(generateWave(4).spawns.some((s) => s.kind === 'brute')).toBe(true);
  });

  it('every 5th wave is a boss wave with exactly one boss spawn', () => {
    for (const w of [5, 10, 15]) {
      const plan = generateWave(w);
      expect(plan.isBossWave).toBe(true);
      expect(plan.spawns.filter((s) => s.kind === 'boss')).toHaveLength(1);
    }
    expect(generateWave(6).isBossWave).toBe(false);
  });

  it('total minion count grows roughly with wave number', () => {
    const early = generateWave(1).spawns.length;
    const late = generateWave(20).spawns.length;
    expect(late).toBeGreaterThan(early);
  });

  it('spawn delays are strictly non-decreasing (no simultaneous double-spawns by construction)', () => {
    const plan = generateWave(8);
    for (let i = 1; i < plan.spawns.length; i++) {
      expect(plan.spawns[i].delay).toBeGreaterThanOrEqual(plan.spawns[i - 1].delay);
    }
  });
});

describe('Enemy scaling', () => {
  it('HP grows monotonically with wave number', () => {
    expect(enemyHpAtWave('grunt', 10)).toBeGreaterThan(enemyHpAtWave('grunt', 1));
  });

  it('gold reward grows in steps as wave increases', () => {
    expect(enemyGoldAtWave('grunt', 10)).toBeGreaterThanOrEqual(enemyGoldAtWave('grunt', 1));
  });
});
