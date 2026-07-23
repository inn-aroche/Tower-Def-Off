import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import type { Cell, EconomyConfig, EnemyDef, LevelDef, UnitDef } from '../src/sim/types';

const economy: EconomyConfig = {
  gridCols: 3,
  gridRows: 4,
  manaMax: 10,
  manaRegenPerSec: 5,
  manaStartValue: 10,
};

// Straight path down column 1; base at (1,3). Grass columns 0 and 2 are placeable.
const PATH: Cell[] = [
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 1, row: 2 },
  { col: 1, row: 3 },
];

const strongMelee: UnitDef = {
  id: 'strong',
  name: 'Strong',
  family: 'melee',
  rarity: 'common',
  cost: 2,
  levels: [
    { damage: 100, attackIntervalSec: 0.1, range: 5, slowFactor: 1 },
    { damage: 300, attackIntervalSec: 0.1, range: 5, slowFactor: 1 },
  ],
};

const weakEnemy: EnemyDef = { id: 'weak', name: 'Weak', hp: 10, speed: 1, damageToBase: 1 };

function level(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    name: 'Test',
    playerStartLife: 5,
    path: PATH,
    waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: 'weak', count: 1, intervalSec: 0, startDelaySec: 0 }] }],
    ...overrides,
  };
}

function makeSim(lvl: LevelDef = level(), eco: EconomyConfig = economy) {
  return new CombatSim({ economy: eco, level: lvl, deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [weakEnemy] });
}

function run(sim: CombatSim, seconds: number, dt = 1 / 30) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(dt);
}

describe('CombatSim summon', () => {
  it('rejects an unknown card', () => {
    expect(makeSim().summon('nope', 0, 0)).toEqual({ ok: false, reason: 'unknown-card' });
  });

  it('rejects an out-of-bounds cell', () => {
    expect(makeSim().summon('strong', 9, 0)).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('rejects placement on a path cell', () => {
    expect(makeSim().summon('strong', 1, 0)).toEqual({ ok: false, reason: 'on-path' });
  });

  it('rejects an occupied cell', () => {
    const sim = makeSim();
    expect(sim.summon('strong', 0, 0).ok).toBe(true);
    expect(sim.summon('strong', 0, 0)).toEqual({ ok: false, reason: 'cell-occupied' });
  });

  it('rejects when mana is insufficient and deducts the fixed cost otherwise', () => {
    const poor = makeSim(level(), { ...economy, manaStartValue: 1, manaRegenPerSec: 0 });
    expect(poor.summon('strong', 0, 0)).toEqual({ ok: false, reason: 'not-enough-mana' });

    const sim = makeSim();
    sim.summon('strong', 0, 0);
    expect(sim.snapshot().mana).toBe(8); // 10 - cost(2)
  });

  it('exposes affordability per card in the hand', () => {
    const sim = makeSim(level(), { ...economy, manaStartValue: 1, manaRegenPerSec: 0 });
    expect(sim.snapshot().hand).toEqual([{ unitId: 'strong', name: 'Strong', family: 'melee', cost: 2, affordable: false }]);
  });
});

describe('CombatSim merge', () => {
  it('merges two identical same-level units into a higher-level one', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 0);
    sim.summon('strong', 0, 1);
    expect(sim.snapshot().units).toHaveLength(2);

    expect(sim.merge({ col: 0, row: 0 }, { col: 0, row: 1 })).toEqual({ ok: true, newLevel: 2 });
    const units = sim.snapshot().units;
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ level: 2, col: 0, row: 1 });
  });

  it('refuses to merge at max level', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 0);
    sim.summon('strong', 0, 1);
    sim.merge({ col: 0, row: 0 }, { col: 0, row: 1 }); // -> level 2 (max defined)
    sim.summon('strong', 2, 0);
    sim.summon('strong', 2, 1);
    sim.merge({ col: 2, row: 0 }, { col: 2, row: 1 }); // another level 2
    expect(sim.merge({ col: 0, row: 1 }, { col: 2, row: 1 })).toEqual({ ok: false, reason: 'max-level' });
  });
});

describe('CombatSim outcomes', () => {
  it('a defender in range kills the enemy before the base -> victory', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 2); // grass beside the path, within range
    run(sim, 5);
    expect(sim.snapshot().outcome).toBe('victory');
    expect(sim.snapshot().life).toBe(5);
  });

  it('an undefended level ends in defeat once life reaches 0', () => {
    const sim = makeSim(level({ playerStartLife: 1 }));
    run(sim, 10);
    expect(sim.snapshot().outcome).toBe('defeat');
    expect(sim.snapshot().life).toBe(0);
  });

  it('emits feedback events (summon, attack/damage, kill) drained by consumeEvents', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 2);
    expect(sim.consumeEvents().some((e) => e.type === 'summon')).toBe(true);
    // events are cleared after draining
    expect(sim.consumeEvents()).toEqual([]);
    const types = new Set<string>();
    for (let i = 0; i < 90; i++) {
      sim.step(1 / 30);
      for (const e of sim.consumeEvents()) types.add(e.type);
    }
    expect(types.has('attack')).toBe(true);
    expect(types.has('damage')).toBe(true);
    expect(types.has('kill')).toBe(true);
  });

  it('emits a merge event on a successful merge', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 0);
    sim.summon('strong', 0, 1);
    sim.consumeEvents();
    sim.merge({ col: 0, row: 0 }, { col: 0, row: 1 });
    expect(sim.consumeEvents()).toEqual([{ type: 'merge', col: 0, row: 1, newLevel: 2 }]);
  });

  it('counts an enemy once even when two units land the finishing blow in the same tick', () => {
    const sim = makeSim();
    sim.summon('strong', 0, 0); // both flank the spawn cell (1,0); both fire on the first tick
    sim.summon('strong', 2, 0);
    run(sim, 3);
    expect(sim.snapshot().kills).toBe(1);
  });

  it('is deterministic: identical configs produce identical snapshots', () => {
    const a = makeSim();
    const b = makeSim();
    a.summon('strong', 0, 2);
    b.summon('strong', 0, 2);
    run(a, 3);
    run(b, 3);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('stops advancing once an outcome is reached', () => {
    const sim = makeSim(level({ playerStartLife: 1 }));
    run(sim, 10);
    const atDefeat = sim.snapshot();
    run(sim, 5);
    expect(sim.snapshot()).toEqual(atDefeat);
  });
});
