import { describe, it, expect } from 'vitest';
import { generateProceduralLevel } from '../src/data/proceduralLevels';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';
import { waveTotalEnemyCount } from '../src/sim/Wave';

const SAMPLE_IDS = Array.from({ length: 40 }, (_, i) => i + 11); // exhaustive: every id 11-50

describe('Procedural campaign levels (11-50 filler range)', () => {
  it('is deterministic — same id always yields an identical config', () => {
    const a = generateProceduralLevel(23);
    const b = generateProceduralLevel(23);
    expect(a).toEqual(b);
  });

  for (const id of SAMPLE_IDS) {
    it(`level ${id}: has a reachable path with no towers placed`, () => {
      const level = generateProceduralLevel(id);
      const grid = new Grid(level.grid);
      const flow = new FlowField(grid);
      expect(flow.allSpawnsReachable()).toBe(true);
    });
  }

  it('grid area grows (non-strictly) across the range, staying within a sane cap', () => {
    const early = generateProceduralLevel(11);
    const late = generateProceduralLevel(49);
    expect(late.grid.cols * late.grid.rows).toBeGreaterThan(early.grid.cols * early.grid.rows);
    expect(late.grid.cols).toBeLessThanOrEqual(26);
    expect(late.grid.rows).toBeLessThanOrEqual(16);
  });

  it('adjacent levels use distinct (if overlapping) curve slices', () => {
    const l11 = generateProceduralLevel(11);
    const l12 = generateProceduralLevel(12);
    expect(l11.waves).not.toEqual(l12.waves);
  });

  it('difficulty trends upward over the full range (local modulo bonuses can wobble level-to-level)', () => {
    const early = generateProceduralLevel(11);
    const late = generateProceduralLevel(45);
    const countEarly = early.waves.reduce((s, w) => s + waveTotalEnemyCount(w), 0);
    const countLate = late.waves.reduce((s, w) => s + waveTotalEnemyCount(w), 0);
    expect(countLate).toBeGreaterThan(countEarly);
  });

  it('starting gold increases with level id', () => {
    expect(generateProceduralLevel(20).startGold).toBeGreaterThan(generateProceduralLevel(11).startGold);
  });

  it('unlocks all 5 towers (fully unlocked well before N11 in the hand-authored campaign)', () => {
    const level = generateProceduralLevel(30);
    expect(level.allowedTowers.sort()).toEqual(['cryo', 'laser', 'mortar', 'tesla', 'wall']);
  });

  it('produces sane star goals scaled to the level\'s own budget', () => {
    const level = generateProceduralLevel(25);
    expect(level.starGoals.maxTowers).toBeGreaterThan(0);
    expect(level.starGoals.maxGoldSpent).toBeGreaterThan(level.startGold);
  });
});
