import { describe, it, expect } from 'vitest';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';
import { waveTotalEnemyCount } from '../src/sim/Wave';
import type { LevelConfig } from '../src/data/LevelConfig';
import level01 from '../src/data/levels/level-01.json';
import level02 from '../src/data/levels/level-02.json';
import level03 from '../src/data/levels/level-03.json';
import level04 from '../src/data/levels/level-04.json';
import level05 from '../src/data/levels/level-05.json';
import level06 from '../src/data/levels/level-06.json';
import level07 from '../src/data/levels/level-07.json';
import level08 from '../src/data/levels/level-08.json';
import level09 from '../src/data/levels/level-09.json';
import level10 from '../src/data/levels/level-10.json';

const LEVELS = [level01, level02, level03, level04, level05, level06, level07, level08, level09, level10] as unknown as LevelConfig[];

describe('Level content sanity', () => {
  it('has exactly 10 levels numbered 1-10 in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  for (const level of LEVELS) {
    describe(`Level ${level.id} - ${level.name}`, () => {
      it('has every spawn able to reach an exit before any tower is placed', () => {
        const grid = new Grid(level.grid);
        const flow = new FlowField(grid);
        expect(flow.allSpawnsReachable()).toBe(true);
      });

      it('has at least one wave with at least one enemy', () => {
        expect(level.waves.length).toBeGreaterThan(0);
        const total = level.waves.reduce((sum, w) => sum + waveTotalEnemyCount(w), 0);
        expect(total).toBeGreaterThan(0);
      });

      it('only allows towers that exist and starts with non-negative gold/hp', () => {
        const validTowers = ['laser', 'mortar', 'tesla', 'cryo'];
        for (const t of level.allowedTowers) expect(validTowers).toContain(t);
        expect(level.startGold).toBeGreaterThanOrEqual(0);
        expect(level.baseHp).toBeGreaterThan(0);
      });

      it('places spawns/exits/blocked cells within grid bounds', () => {
        const { cols, rows } = level.grid;
        const inBounds = ([c, r]: [number, number]) => c >= 0 && c < cols && r >= 0 && r < rows;
        for (const s of level.grid.spawns) expect(inBounds(s)).toBe(true);
        for (const e of level.grid.exits) expect(inBounds(e)).toBe(true);
        for (const b of level.grid.blocked) expect(inBounds(b)).toBe(true);
      });
    });
  }

  it('unlocks each threat\'s counter tower on or before its introduction level (garde-fou)', () => {
    const byId = new Map(LEVELS.map((l) => [l.id, l]));
    // Mortar (anti-swarm) must be available by N3 (Golem/Mortier intro).
    expect(byId.get(3)!.allowedTowers).toContain('mortar');
    // Tesla (anti-air) must be available by N5 (Drone intro).
    expect(byId.get(5)!.allowedTowers).toContain('tesla');
    // Cryo must be available by N8 (its own intro level).
    expect(byId.get(8)!.allowedTowers).toContain('cryo');
  });

  it('grows overall scale from N1 to the endgame, peaking at N6 "Le Labyrinthe Géant"', () => {
    const first = LEVELS[0];
    const last = LEVELS[LEVELS.length - 1];
    const n6 = LEVELS.find((l) => l.id === 6)!;
    const area = (l: LevelConfig) => l.grid.cols * l.grid.rows;
    expect(area(last)).toBeGreaterThan(area(first));
    expect(last.startGold).toBeGreaterThan(first.startGold);
    for (const level of LEVELS) expect(area(n6)).toBeGreaterThanOrEqual(area(level));
  });
});
