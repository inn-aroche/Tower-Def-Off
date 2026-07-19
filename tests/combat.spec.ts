import { describe, expect, it } from 'vitest';
import { gravitySlowFactor, resolveAttacks } from '../src/sim/Combat';
import type { EnemyDef, LiveEnemy, PlacedUnit, UnitDef } from '../src/sim/types';

const meleeDef: UnitDef = {
  id: 'm',
  name: 'Melee',
  family: 'melee',
  cost: 2,
  levels: [{ damage: 10, attackIntervalSec: 1, range: 1.6, slowFactor: 1 }],
};

const gravityDef: UnitDef = {
  id: 'g',
  name: 'Gravity',
  family: 'gravity',
  cost: 4,
  levels: [{ damage: 0, attackIntervalSec: 0, range: 2.2, slowFactor: 0.5 }],
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

/** Enemy at cell-centre (x, y). pathProgress defaults so "more advanced" ordering is testable. */
function enemy(overrides: Partial<LiveEnemy>): LiveEnemy {
  return { instanceId: 1, enemyId: 'e', pathProgress: 0, x: 0.5, y: 4.5, hp: 20, ...overrides };
}

describe('gravitySlowFactor', () => {
  const g = unit({ unitId: 'g', col: 2, row: 5 }); // centre (2.5, 5.5), range 2.2

  it('slows an enemy within the radius', () => {
    expect(gravitySlowFactor(deps, enemy({ x: 2.5, y: 4.5 }), [g])).toBe(0.5); // dist 1.0
    expect(gravitySlowFactor(deps, enemy({ x: 3.5, y: 5.5 }), [g])).toBe(0.5); // dist 1.0
  });

  it('does not affect enemies beyond the radius', () => {
    expect(gravitySlowFactor(deps, enemy({ x: 5.5, y: 5.5 }), [g])).toBe(1); // dist 3.0
  });

  it('ignores damage-family units entirely', () => {
    expect(gravitySlowFactor(deps, enemy({ x: 0.5, y: 5.0 }), [unit({ col: 0, row: 5 })])).toBe(1);
  });
});

describe('resolveAttacks', () => {
  it('damages the most-advanced enemy in range and resets cooldown', () => {
    const units = [unit({ col: 0, row: 5 })]; // centre (0.5, 5.5)
    const enemies = [enemy({ instanceId: 1, x: 0.5, y: 4.5, pathProgress: 5 })];
    const result = resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(10);
    expect(units[0].attackCooldownSec).toBeCloseTo(1);
    expect(result.killedEnemyInstanceIds).toEqual([]);
  });

  it('does not attack while on cooldown', () => {
    const units = [unit({ col: 0, row: 5, attackCooldownSec: 0.5 })];
    const enemies = [enemy({ x: 0.5, y: 4.5 })];
    resolveAttacks(deps, units, enemies, 0.2);
    expect(enemies[0].hp).toBe(20);
    expect(units[0].attackCooldownSec).toBeCloseTo(0.3);
  });

  it('reports kills when hp drops to 0 or below', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ instanceId: 42, x: 0.5, y: 4.5, hp: 5 })];
    expect(resolveAttacks(deps, units, enemies, 0.1).killedEnemyInstanceIds).toEqual([42]);
  });

  it('picks the enemy with the highest pathProgress among those in range', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [
      enemy({ instanceId: 1, x: 0.5, y: 4.6, pathProgress: 3, hp: 20 }),
      enemy({ instanceId: 2, x: 0.5, y: 4.4, pathProgress: 7, hp: 20 }),
    ];
    resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(20); // less advanced, untouched
    expect(enemies[1].hp).toBe(10); // most advanced, targeted
  });

  it('ignores enemies outside the radius', () => {
    const units = [unit({ col: 0, row: 5 })]; // centre (0.5, 5.5), range 1.6
    const enemies = [enemy({ x: 3.5, y: 5.5 }), enemy({ x: 0.5, y: 2.5 })];
    resolveAttacks(deps, units, enemies, 0.1);
    expect(enemies[0].hp).toBe(20);
    expect(enemies[1].hp).toBe(20);
  });
});
