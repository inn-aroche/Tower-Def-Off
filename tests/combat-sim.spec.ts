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

describe('CombatSim bestiary traits', () => {
  const flyer: EnemyDef = { id: 'flyer', name: 'Flyer', hp: 10, speed: 1, damageToBase: 1, flying: true };
  const summoner: EnemyDef = {
    id: 'summoner',
    name: 'Summoner',
    hp: 100,
    speed: 0.0001,
    damageToBase: 1,
    boss: true,
    ability: { kind: 'summon', periodSec: 1, enemyId: 'weak', count: 2 },
  };

  function simWith(enemyId: string, defs: EnemyDef[], lvl?: LevelDef) {
    const l = lvl ?? level({
      playerStartLife: 100,
      waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId, count: 1, intervalSec: 0, startDelaySec: 0 }] }],
    });
    return new CombatSim({ economy, level: l, deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [...defs, weakEnemy] });
  }

  it('flyers travel straight from spawn to base, ignoring the winding path', () => {
    // Path winds through column 1, but a flyer should track the straight spawn→base segment.
    const sim = simWith('flyer', [flyer]);
    sim.step(1 / 30);
    const e = sim.snapshot().enemies[0];
    // spawn (1.5, 0.5) → base (1.5, 3.5): straight line keeps x fixed at 1.5
    expect(e.x).toBeCloseTo(1.5, 5);
    expect(e.y).toBeGreaterThan(0.5);
  });

  it('a boss spawn emits a spawn event flagged boss', () => {
    const sim = simWith('summoner', [summoner]);
    sim.step(1 / 30);
    expect(sim.consumeEvents().some((ev) => ev.type === 'spawn' && ev.boss)).toBe(true);
  });

  it('a summoner boss adds enemies to the field over time', () => {
    const sim = simWith('summoner', [summoner]);
    run(sim, 2.5); // > 2 periods
    // 1 boss (nearly stationary) + at least 2 summoned minions still alive
    expect(sim.snapshot().enemies.length).toBeGreaterThanOrEqual(3);
  });

  it('a regenerating enemy retains more HP than an identical non-regenerating one under the same fire', () => {
    // Big HP so it survives the barrage; near-stationary so it stays in range the whole time.
    const tanky: EnemyDef = { id: 'tanky', name: 'Tanky', hp: 5000, speed: 0.0001, damageToBase: 1 };
    const tankyRegen: EnemyDef = { ...tanky, id: 'tankyRegen', regenPerSec: 50 };
    const mk = (id: string, def: EnemyDef) => {
      const l = level({
        playerStartLife: 100,
        waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: id, count: 1, intervalSec: 0, startDelaySec: 0 }] }],
      });
      const sim = new CombatSim({ economy, level: l, deck: ['strong'], unitDefs: [strongMelee], enemyDefs: [def, weakEnemy] });
      sim.summon('strong', 0, 0); // adjacent to the spawn cell, well within range
      return sim;
    };
    const plain = mk('tanky', tanky);
    const healing = mk('tankyRegen', tankyRegen);
    run(plain, 1.5);
    run(healing, 1.5);
    const plainHp = plain.snapshot().enemies[0]?.hp ?? 0;
    const healHp = healing.snapshot().enemies[0]?.hp ?? 0;
    expect(healHp).toBeGreaterThan(plainHp);
    expect(healHp).toBeLessThanOrEqual(5000);
  });
});
