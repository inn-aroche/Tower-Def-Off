import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import type { EconomyConfig, EnemyDef, LevelDef, UnitDef } from '../src/sim/types';

const economy: EconomyConfig = {
  gridCols: 3,
  gridRows: 4,
  manaMax: 10,
  manaRegenPerSec: 5,
  manaStartValue: 10,
  summonBaseCost: 2,
  summonCostGrowth: 1,
  summonCostMax: 8,
};

const strongMelee: UnitDef = {
  id: 'strong',
  name: 'Strong',
  family: 'melee',
  levels: [
    { damage: 100, attackIntervalSec: 0.1, rangeRows: 4, influenceCols: 0, slowFactor: 1 },
    { damage: 300, attackIntervalSec: 0.1, rangeRows: 4, influenceCols: 0, slowFactor: 1 },
  ],
};

const weakEnemy: EnemyDef = { id: 'weak', name: 'Weak', hp: 10, speed: 1, damageToBase: 1 };

function easyLevel(): LevelDef {
  return {
    id: 'easy',
    name: 'Easy',
    playerStartLife: 5,
    waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: 'weak', count: 1, intervalSec: 0, startDelaySec: 0 }] }],
  };
}

function noDefenderLevel(): LevelDef {
  return {
    id: 'undefended',
    name: 'Undefended',
    playerStartLife: 1,
    waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: 'weak', count: 1, intervalSec: 0, startDelaySec: 0 }] }],
  };
}

function run(sim: CombatSim, seconds: number, dt = 1 / 30) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(dt);
}

describe('CombatSim', () => {
  it('rejects summon on an out-of-bounds cell', () => {
    const sim = new CombatSim({ economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] }, 1);
    const result = sim.summon(99, 0);
    expect(result).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('rejects summon without enough mana', () => {
    const poorEconomy = { ...economy, manaStartValue: 0, manaRegenPerSec: 0 };
    const sim = new CombatSim(
      { economy: poorEconomy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] },
      1,
    );
    const result = sim.summon(0, 0);
    expect(result).toEqual({ ok: false, reason: 'not-enough-mana' });
  });

  it('rejects summon on an occupied cell', () => {
    const sim = new CombatSim({ economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] }, 1);
    expect(sim.summon(0, 0).ok).toBe(true);
    expect(sim.summon(0, 0)).toEqual({ ok: false, reason: 'cell-occupied' });
  });

  it('summon cost grows and deducts mana', () => {
    const sim = new CombatSim({ economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] }, 1);
    sim.summon(0, 0);
    expect(sim.snapshot().mana).toBe(8); // 10 - baseCost(2)
    expect(sim.snapshot().nextSummonCost).toBe(3); // baseCost(2) + growth(1)*1
  });

  it('merges two identical same-level units into one higher-level unit', () => {
    const sim = new CombatSim({ economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] }, 1);
    sim.summon(0, 0);
    sim.summon(1, 0);
    let units = sim.snapshot().units;
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.level === 1)).toBe(true);

    const result = sim.merge({ col: 0, row: 0 }, { col: 1, row: 0 });
    expect(result).toEqual({ ok: true, newLevel: 2 });
    units = sim.snapshot().units;
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ level: 2, col: 1, row: 0 });
  });

  it('refuses to merge units at max level', () => {
    const cheapEconomy = { ...economy, manaStartValue: 100, manaRegenPerSec: 0, summonCostGrowth: 0, summonBaseCost: 1 };
    const sim = new CombatSim(
      { economy: cheapEconomy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] },
      1,
    );
    sim.summon(0, 0);
    sim.summon(1, 0);
    sim.merge({ col: 0, row: 0 }, { col: 1, row: 0 }); // now level 2, the def's max (2 levels defined)
    sim.summon(0, 0);
    sim.summon(2, 0);
    sim.merge({ col: 0, row: 0 }, { col: 2, row: 0 }); // another level 2
    const result = sim.merge({ col: 1, row: 0 }, { col: 2, row: 0 });
    expect(result).toEqual({ ok: false, reason: 'max-level' });
  });

  it('a defender in range kills the enemy before it reaches the base -> victory', () => {
    const sim = new CombatSim({ economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] }, 1);
    sim.summon(0, 3); // last row, directly in the enemy's path
    run(sim, 5);
    expect(sim.snapshot().outcome).toBe('victory');
    expect(sim.snapshot().life).toBe(5);
  });

  it('an undefended level ends in defeat once life reaches 0', () => {
    const sim = new CombatSim(
      { economy, level: noDefenderLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] },
      1,
    );
    run(sim, 10);
    expect(sim.snapshot().outcome).toBe('defeat');
    expect(sim.snapshot().life).toBe(0);
  });

  it('is deterministic: same seed produces the same outcome and summon unit ids', () => {
    const config = { economy, level: easyLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] };
    const simA = new CombatSim(config, 123);
    const simB = new CombatSim(config, 123);
    const resA = simA.summon(0, 0);
    const resB = simB.summon(0, 0);
    expect(resA).toEqual(resB);
    run(simA, 3);
    run(simB, 3);
    expect(simA.snapshot()).toEqual(simB.snapshot());
  });

  it('stops advancing once an outcome is reached', () => {
    const sim = new CombatSim(
      { economy, level: noDefenderLevel(), deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] },
      1,
    );
    run(sim, 10);
    const snapshotAtDefeat = sim.snapshot();
    run(sim, 5);
    expect(sim.snapshot()).toEqual(snapshotAtDefeat);
  });
});
