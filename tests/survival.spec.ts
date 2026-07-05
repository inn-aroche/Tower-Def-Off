import { describe, it, expect } from 'vitest';
import { buildSurvivalLevelConfig, survivalScore, SURVIVAL_TIERS } from '../src/data/survival';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';
import { waveTotalEnemyCount } from '../src/sim/Wave';

describe('Survival mode', () => {
  it('is deterministic — building the same tier twice yields identical waves', () => {
    const a = buildSurvivalLevelConfig('bronze');
    const b = buildSurvivalLevelConfig('bronze');
    expect(a.waves).toEqual(b.waves);
  });

  it('has a reachable path with no towers placed', () => {
    for (const tier of ['bronze', 'silver', 'gold'] as const) {
      const level = buildSurvivalLevelConfig(tier);
      const grid = new Grid(level.grid);
      const flow = new FlowField(grid);
      expect(flow.allSpawnsReachable()).toBe(true);
    }
  });

  it('escalates difficulty: later waves in a tier have more enemies than earlier ones', () => {
    const level = buildSurvivalLevelConfig('bronze');
    const early = waveTotalEnemyCount(level.waves[0]);
    const later = waveTotalEnemyCount(level.waves[20]);
    expect(later).toBeGreaterThan(early);
  });

  it('higher tiers start further in and grant more starting gold', () => {
    expect(SURVIVAL_TIERS.silver.startWaveIndex).toBeGreaterThan(SURVIVAL_TIERS.bronze.startWaveIndex);
    expect(SURVIVAL_TIERS.gold.startWaveIndex).toBeGreaterThan(SURVIVAL_TIERS.silver.startWaveIndex);
    expect(SURVIVAL_TIERS.gold.startGold).toBeGreaterThan(SURVIVAL_TIERS.bronze.startGold);
  });

  it('scores as absolute wave reached times the tier multiplier', () => {
    expect(survivalScore('bronze', 9)).toBe(10);
    expect(survivalScore('silver', 19)).toBe(30);
    expect(survivalScore('gold', 39)).toBe(80);
  });

  it('every generated wave has a non-empty, well-formed spawn list', () => {
    const level = buildSurvivalLevelConfig('bronze');
    for (const wave of level.waves.slice(0, 50)) {
      expect(wave.spawns.length).toBeGreaterThan(0);
      for (const group of wave.spawns) {
        expect(group.count).toBeGreaterThan(0);
        expect(group.interval).toBeGreaterThan(0);
      }
    }
  });

  it('grid does not exceed 15 cols x 10 rows (§ "pas plus de 10 case de largeur et 15 de longueur")', () => {
    const level = buildSurvivalLevelConfig('bronze');
    expect(level.grid.cols).toBeLessThanOrEqual(15);
    expect(level.grid.rows).toBeLessThanOrEqual(10);
  });
});
