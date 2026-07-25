import { describe, expect, it } from 'vitest';
import { gravitySlowFactor, resolveAttacks } from '../src/sim/Combat';
import type { EnemyDef, LiveEnemy, PlacedUnit, UnitDef } from '../src/sim/types';

const meleeDef: UnitDef = {
  id: 'm',
  name: 'Melee',
  family: 'melee',
  rarity: 'common',
  cost: 2,
  levels: [{ damage: 10, attackIntervalSec: 1, range: 1.6, slowFactor: 1 }],
};

const gravityDef: UnitDef = {
  id: 'g',
  name: 'Gravity',
  family: 'gravity',
  rarity: 'common',
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
  return { instanceId: 1, enemyId: 'e', pathProgress: 0, x: 0.5, y: 4.5, hp: 20, maxHp: 20, shieldedUntilSec: 0, abilityTimerSec: 0, chilledUntilSec: 0, chillFactor: 1, ...overrides };
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
    const result = resolveAttacks(deps, units, enemies, 0.1, 0);
    expect(enemies[0].hp).toBe(10);
    expect(units[0].attackCooldownSec).toBeCloseTo(1);
    expect(result.killedEnemyInstanceIds).toEqual([]);
  });

  it('does not attack while on cooldown', () => {
    const units = [unit({ col: 0, row: 5, attackCooldownSec: 0.5 })];
    const enemies = [enemy({ x: 0.5, y: 4.5 })];
    resolveAttacks(deps, units, enemies, 0.2, 0);
    expect(enemies[0].hp).toBe(20);
    expect(units[0].attackCooldownSec).toBeCloseTo(0.3);
  });

  it('reports kills when hp drops to 0 or below', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ instanceId: 42, x: 0.5, y: 4.5, hp: 5 })];
    expect(resolveAttacks(deps, units, enemies, 0.1, 0).killedEnemyInstanceIds).toEqual([42]);
  });

  it('picks the enemy with the highest pathProgress among those in range', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [
      enemy({ instanceId: 1, x: 0.5, y: 4.6, pathProgress: 3, hp: 20 }),
      enemy({ instanceId: 2, x: 0.5, y: 4.4, pathProgress: 7, hp: 20 }),
    ];
    resolveAttacks(deps, units, enemies, 0.1, 0);
    expect(enemies[0].hp).toBe(20); // less advanced, untouched
    expect(enemies[1].hp).toBe(10); // most advanced, targeted
  });

  it('ignores enemies outside the radius', () => {
    const units = [unit({ col: 0, row: 5 })]; // centre (0.5, 5.5), range 1.6
    const enemies = [enemy({ x: 3.5, y: 5.5 }), enemy({ x: 0.5, y: 2.5 })];
    resolveAttacks(deps, units, enemies, 0.1, 0);
    expect(enemies[0].hp).toBe(20);
    expect(enemies[1].hp).toBe(20);
  });

  it('subtracts armor from damage (floored at 1)', () => {
    const armored: EnemyDef = { id: 'armored', name: 'Armored', hp: 40, speed: 1, damageToBase: 1, armor: 6 };
    const heavy: EnemyDef = { id: 'heavy', name: 'Heavy', hp: 40, speed: 1, damageToBase: 1, armor: 50 };
    const d = { unitDefs: deps.unitDefs, enemyDefs: new Map([['armored', armored], ['heavy', heavy]]) };
    const units = [unit({ col: 0, row: 5 })]; // 10 damage
    const a = [enemy({ enemyId: 'armored', x: 0.5, y: 4.5, hp: 40, maxHp: 40 })];
    resolveAttacks(d, units, a, 0.1, 0);
    expect(a[0].hp).toBe(36); // 40 - (10 - 6)

    const h = [enemy({ enemyId: 'heavy', x: 0.5, y: 4.5, hp: 40, maxHp: 40 })];
    resolveAttacks(d, [unit({ col: 0, row: 5 })], h, 0.1, 0);
    expect(h[0].hp).toBe(39); // 40 - max(1, 10 - 50)
  });

  it('cannot target a shielded enemy', () => {
    const units = [unit({ col: 0, row: 5 })];
    const enemies = [enemy({ x: 0.5, y: 4.5, shieldedUntilSec: 5 })];
    resolveAttacks(deps, units, enemies, 0.1, 2); // elapsed 2 < shield 5
    expect(enemies[0].hp).toBe(20); // untouched
    // once the shield lapses it can be hit again
    resolveAttacks(deps, [unit({ col: 0, row: 5 })], enemies, 0.1, 6);
    expect(enemies[0].hp).toBe(10);
  });

  it('a stunned unit does not attack', () => {
    const units = [unit({ col: 0, row: 5, stunnedUntilSec: 5 })];
    const enemies = [enemy({ x: 0.5, y: 4.5 })];
    resolveAttacks(deps, units, enemies, 0.1, 2); // elapsed 2 < stun 5
    expect(enemies[0].hp).toBe(20);
    // recovers after the stun expires
    resolveAttacks(deps, units, enemies, 0.1, 6);
    expect(enemies[0].hp).toBe(10);
  });
});

describe('unit abilities', () => {
  const base = { name: 'X', family: 'ranged' as const, rarity: 'common' as const, cost: 3 };
  const lvl = [{ damage: 10, attackIntervalSec: 1, range: 5, slowFactor: 1 }];

  it('splash also damages other enemies near the target', () => {
    const splasher: UnitDef = { ...base, id: 's', ability: { kind: 'splash', radius: 1.5, damageFactor: 0.5 }, levels: lvl };
    const d = { unitDefs: new Map([['s', splasher]]), enemyDefs: new Map([['e', enemyDef]]) };
    const units = [unit({ unitId: 's', col: 0, row: 5 })];
    const enemies = [
      enemy({ instanceId: 1, x: 0.6, y: 4.5, pathProgress: 5, hp: 20, maxHp: 20 }), // primary (most advanced)
      enemy({ instanceId: 2, x: 1.0, y: 4.5, pathProgress: 1, hp: 20, maxHp: 20 }), // within splash of primary
      enemy({ instanceId: 3, x: 5.5, y: 4.5, pathProgress: 1, hp: 20, maxHp: 20 }), // far — unaffected
    ];
    resolveAttacks(d, units, enemies, 0.1, 0);
    expect(enemies[0].hp).toBe(10); // full hit
    expect(enemies[1].hp).toBe(15); // splash: 10 * 0.5 = 5
    expect(enemies[2].hp).toBe(20); // out of splash radius
  });

  it('chain arcs to up to `jumps` nearby enemies', () => {
    const caster: UnitDef = { ...base, id: 'c', ability: { kind: 'chain', jumps: 1, range: 2, damageFactor: 0.5 }, levels: lvl };
    const d = { unitDefs: new Map([['c', caster]]), enemyDefs: new Map([['e', enemyDef]]) };
    const units = [unit({ unitId: 'c', col: 0, row: 5 })];
    const enemies = [
      enemy({ instanceId: 1, x: 0.6, y: 4.5, pathProgress: 5, hp: 20, maxHp: 20 }), // primary
      enemy({ instanceId: 2, x: 1.2, y: 4.5, pathProgress: 1, hp: 20, maxHp: 20 }), // nearest jump
      enemy({ instanceId: 3, x: 1.6, y: 4.5, pathProgress: 1, hp: 20, maxHp: 20 }), // 2nd nearest — beyond 1 jump
    ];
    resolveAttacks(d, units, enemies, 0.1, 0);
    expect(enemies[0].hp).toBe(10); // primary full
    expect(enemies[1].hp).toBe(15); // 1 jump: 5
    expect(enemies[2].hp).toBe(20); // only 1 jump allowed
  });

  it('slow_on_hit chills the struck enemy', () => {
    const froster: UnitDef = { ...base, id: 'f', ability: { kind: 'slow_on_hit', slowFactor: 0.5, durationSec: 1.5 }, levels: lvl };
    const d = { unitDefs: new Map([['f', froster]]), enemyDefs: new Map([['e', enemyDef]]) };
    const units = [unit({ unitId: 'f', col: 0, row: 5 })];
    const target = enemy({ x: 0.6, y: 4.5 });
    resolveAttacks(d, units, [target], 0.1, 2);
    expect(target.chillFactor).toBe(0.5);
    expect(target.chilledUntilSec).toBeCloseTo(3.5); // 2 + 1.5
  });

  it('boost_aura raises the damage of nearby friendly units', () => {
    const shooter: UnitDef = { ...base, id: 'sh', levels: lvl };
    // Gravity family so the booster only buffs and doesn't also attack — isolates the aura effect.
    const booster: UnitDef = { ...base, id: 'bo', family: 'gravity', ability: { kind: 'boost_aura', radius: 1.6, damageBonus: 0.5 }, levels: lvl };
    const d = { unitDefs: new Map([['sh', shooter], ['bo', booster]]), enemyDefs: new Map([['e', enemyDef]]) };
    // Shooter alone: 10 damage.
    const solo = [enemy({ x: 0.6, y: 4.5, hp: 20, maxHp: 20 })];
    resolveAttacks(d, [unit({ unitId: 'sh', col: 0, row: 5 })], solo, 0.1, 0);
    expect(solo[0].hp).toBe(10);
    // Shooter next to a booster: 10 * 1.5 = 15.
    const buffed = [enemy({ x: 0.6, y: 4.5, hp: 20, maxHp: 20 })];
    resolveAttacks(d, [unit({ unitId: 'sh', col: 0, row: 5 }), unit({ unitId: 'bo', col: 1, row: 5 })], buffed, 0.1, 0);
    expect(buffed[0].hp).toBe(5);
  });
});
