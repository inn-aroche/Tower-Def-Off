import { describe, expect, it } from 'vitest';
import { gravitySlowFactor, resolveAttacks } from '../src/sim/Combat';
import type { EnemyDef, LiveEnemy, PlacedUnit, UnitDef } from '../src/sim/types';

const meleeDef: UnitDef = {
  id: 'm',
  name: 'Melee',
  family: 'melee',
  levels: [{ damage: 10, attackIntervalSec: 1, rangeRows: 1, influenceCols: 0, slowFactor: 1 }],
};

const gravityDef: UnitDef = {
  id: 'g',
  name: 'Gravity',
  family: 'gravity',
  levels: [{ damage: 0, attackIntervalSec: 0, rangeRows: 2, influenceCols: 1, slowFactor: 0.5 }],
};

const enemyDef: EnemyDef = { id: 'e', name: 'Enemy', hp: 20, speed: 1, damageToBase: 1 };

const deps = {
  unitDefs: new Map([
    ['m', meleeDef],
    ['g', gravityDef],
  ]),
  enemyDefs: new Map([['e', enemyDef]]),
};

function unit(overrides: Partial<PlacedUnit>): PlacedUnit {
  return { unitId: 'm', level: 1, col: 0, row: 5, attackCooldownSec: 0, ...overrides };
}

function enemy(overrides: Partial<LiveEnemy>): LiveEnemy {
  return { instanceId: 1, enemyId: 'e', col: 0, rowPos: 4, hp: 20, ...overrides };
}

describe('gravitySlowFactor', () => {
  const gravityUnit = unit({ unitId: 'g', col: 2, row: 5 });

  it('slows an enemy directly ahead within range and influence', () => {
    const e = enemy({ col: 2, rowPos: 4 });
    expect(gravitySlowFactor(deps, e, [gravityUnit])).toBe(0.5);
  });

  it('slows an enemy in an adjacent column within influenceCols', () => {
    const e = enemy({ col: 3, rowPos: 4 });
    expect(gravitySlowFactor(deps, e, [gravityUnit])).toBe(0.5);
  });

  it('does not affect enemies beyond influenceCols', () => {
    const e = enemy({ col: 4, rowPos: 4 });
    expect(gravitySlowFactor(deps, e, [gravityUnit])).toBe(1);
  });

  it('does not affect enemies already behind the unit (rowDist < 0)', () => {
    const e = enemy({ col: 2, rowPos: 6 });
    expect(gravitySlowFactor(deps, e, [gravityUnit])).toBe(1);
  });

  it('ignores damage-family units entirely', () => {
    const e = enemy({ col: 0, rowPos: 4.5 });
    expect(gravitySlowFactor(deps, e, [unit({ col: 0, row: 5 })])).toBe(1);
  });
});

describe('resolveAttacks', () => {
  it('deals damage to the most advanced in-range enemy and resets cooldown', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ instanceId: 1, col: 0, rowPos: 4.5 })];
    const result = resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(10);
    expect(units[0].attackCooldownSec).toBeCloseTo(1);
    expect(result.killedEnemyInstanceIds).toEqual([]);
  });

  it('does not attack while on cooldown', () => {
    const units = [unit({ col: 0, row: 5, attackCooldownSec: 0.5 })];
    const enemies = [enemy({ col: 0, rowPos: 4.5 })];
    resolveAttacks(deps, units, enemies, 0.2);
    expect(enemies[0].hp).toBe(20);
    expect(units[0].attackCooldownSec).toBeCloseTo(0.3);
  });

  it('reports kills when hp drops to 0 or below', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ instanceId: 42, col: 0, rowPos: 4.5, hp: 5 })];
    const result = resolveAttacks(deps, units, enemies, 0.1);
    expect(result.killedEnemyInstanceIds).toEqual([42]);
  });

  it('never damages gravity-family units targets (no-op) and picks the most advanced enemy in range', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ instanceId: 1, col: 0, rowPos: 4.2, hp: 20 }), enemy({ instanceId: 2, col: 0, rowPos: 4.8, hp: 20 })];
    resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(20); // untouched, less advanced
    expect(enemies[1].hp).toBe(10); // targeted, most advanced within range
  });

  it('ignores enemies outside rangeRows or in a different column', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ col: 1, rowPos: 4.5 }), enemy({ col: 0, rowPos: 2 })];
    resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(20);
    expect(enemies[1].hp).toBe(20);
  });
});
