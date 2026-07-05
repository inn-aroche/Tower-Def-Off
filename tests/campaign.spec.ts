import { describe, it, expect } from 'vitest';
import { buildCampaignLevels, TOTAL_CAMPAIGN_LEVELS } from '../src/data/campaign';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';

const MILESTONE_IDS = [15, 20, 25, 30, 35, 40, 45, 50];

describe('Full 50-level campaign assembly (main.ts wiring)', () => {
  const levels = buildCampaignLevels();

  it('has exactly 50 levels, ids 1-50 in order with no gaps or duplicates', () => {
    expect(levels).toHaveLength(TOTAL_CAMPAIGN_LEVELS);
    expect(levels.map((l) => l.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('every single level (hand-authored or procedural) has a reachable path with no towers placed', () => {
    for (const level of levels) {
      const grid = new Grid(level.grid);
      const flow = new FlowField(grid);
      expect(flow.allSpawnsReachable(), `level ${level.id} (${level.name}) should be reachable`).toBe(true);
    }
  });

  it('milestone levels are the hand-authored ones (named, not "Niveau N")', () => {
    for (const id of MILESTONE_IDS) {
      const level = levels.find((l) => l.id === id)!;
      expect(level.name).not.toBe(`Niveau ${id}`);
    }
  });

  it('non-milestone ids in 11-50 are procedurally generated ("Niveau N")', () => {
    for (let id = 11; id <= 50; id++) {
      if (MILESTONE_IDS.includes(id)) continue;
      const level = levels.find((l) => l.id === id)!;
      expect(level.name).toBe(`Niveau ${id}`);
    }
  });

  it('all 5 towers exist as allowed options somewhere past the tutorial arc', () => {
    const allTowersEverywhere = levels.slice(9).every((l) => l.allowedTowers.length === 5);
    expect(allTowersEverywhere).toBe(true);
  });

  it('rebuilding the campaign is deterministic (same object shape every call)', () => {
    const again = buildCampaignLevels();
    expect(again).toEqual(levels);
  });

  it('no map exceeds 15 cols x 10 rows (§ "pas plus de 10 case de largeur et 15 de longueur")', () => {
    for (const level of levels) {
      expect(level.grid.cols, `level ${level.id} cols`).toBeLessThanOrEqual(15);
      expect(level.grid.rows, `level ${level.id} rows`).toBeLessThanOrEqual(10);
    }
  });
});
