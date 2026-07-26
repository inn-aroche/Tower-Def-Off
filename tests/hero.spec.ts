import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import type { Cell, EconomyConfig, EnemyDef, HeroConfig, LevelDef, UnitDef } from '../src/sim/types';
import { HEROES_BY_ID, heroPromoteCost, scaleHeroConfig, STARTER_HERO } from '../src/data/heroes';
import { AppState } from '../src/app/AppState';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from '../src/platform/NullProviders';
import type { SaveProvider } from '../src/platform/types';
import { createDefaultSaveData, migrateSaveData, type SaveData } from '../src/meta/SaveData';

function makeApp() {
  let stored: SaveData | null = null;
  const save: SaveProvider<SaveData> = { load: () => stored, save: (d) => void (stored = structuredClone(d)), clear: () => void (stored = null) };
  return new AppState(createDefaultSaveData(), save, new NullAnalyticsProvider(), new NullAdProvider(), new NullIapProvider());
}

const economy: EconomyConfig = { gridCols: 3, gridRows: 4, manaMax: 10, manaRegenPerSec: 5, manaStartValue: 10 };
const PATH: Cell[] = [
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 1, row: 2 },
  { col: 1, row: 3 },
];
const weak: EnemyDef = { id: 'weak', name: 'Weak', hp: 30, speed: 0.0001, damageToBase: 4 };
const dummyUnit: UnitDef = { id: 'u', name: 'U', family: 'melee', rarity: 'common', cost: 2, levels: [{ damage: 0, attackIntervalSec: 1, range: 1, slowFactor: 1 }] };

function level(): LevelDef {
  return {
    id: 't',
    name: 'T',
    playerStartLife: 20,
    path: PATH,
    waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: 'weak', count: 1, intervalSec: 0, startDelaySec: 0 }] }],
  };
}

const hero: HeroConfig = {
  name: 'H',
  maxHp: 100,
  damage: 40,
  attackIntervalSec: 0.5,
  range: 4,
  rechargeSec: 2,
  durationSec: 3,
  power: { kind: 'nova', periodSec: 1, radius: 2, damage: 25 },
};

function makeSim(h: HeroConfig = hero) {
  return new CombatSim({ economy, level: level(), deck: ['u'], unitDefs: [dummyUnit], enemyDefs: [weak], hero: h });
}
const step = (sim: CombatSim, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) sim.step(1 / 30);
};

describe('CombatSim hero', () => {
  it('reports a configured hero and fills energy over the recharge window', () => {
    const sim = makeSim();
    expect(sim.snapshot().hero.configured).toBe(true);
    expect(sim.snapshot().hero.ready).toBe(false);
    step(sim, 1); // rechargeSec 2 → ~50%
    expect(sim.snapshot().hero.energy).toBeGreaterThan(0.4);
    expect(sim.snapshot().hero.energy).toBeLessThan(0.6);
    step(sim, 1.1);
    expect(sim.snapshot().hero.ready).toBe(true);
  });

  it('refuses to deploy before ready, then deploys onto a grass cell', () => {
    const sim = makeSim();
    expect(sim.deployHero(0, 1)).toEqual({ ok: false, reason: 'not-ready' });
    step(sim, 2.1);
    expect(sim.deployHero(1, 0)).toEqual({ ok: false, reason: 'on-path' });
    expect(sim.deployHero(0, 1)).toEqual({ ok: true });
    expect(sim.snapshot().hero.deployed).toBe(true);
  });

  it('deals damage to enemies in range once deployed', () => {
    const sim = makeSim();
    step(sim, 2.1);
    sim.deployHero(0, 1); // beside the path at (0.5,1.5); the weak enemy sits near (1.5,~0.5→) in range
    const before = sim.snapshot().enemies[0]?.hp ?? 0;
    step(sim, 1);
    const after = sim.snapshot().enemies[0]?.hp ?? 0;
    // either damaged or already killed (hp gone)
    expect(after < before || sim.snapshot().enemies.length === 0).toBe(true);
  });

  it('takes contact damage from an adjacent enemy and eventually leaves', () => {
    // Slow, hard-hitting enemy parked next to the hero drains its HP.
    const bruiser: EnemyDef = { id: 'bruiser', name: 'B', hp: 100000, speed: 0.0001, damageToBase: 30 };
    const sim = new CombatSim({
      economy,
      level: { ...level(), waves: [{ startDelaySec: 0, spawnGroups: [{ enemyId: 'bruiser', count: 1, intervalSec: 0, startDelaySec: 0 }] }] },
      deck: ['u'],
      unitDefs: [dummyUnit],
      enemyDefs: [bruiser],
      hero: { ...hero, damage: 0, power: { kind: 'nova', periodSec: 100, radius: 0, damage: 0 }, durationSec: 100 },
    });
    step(sim, 2.1);
    // Enemy spawns at (1.5,0.5) and barely moves; deploy the hero adjacent at col 1? path — use (0,0)? dist to (1.5,0.5) ~1.1
    sim.deployHero(0, 0); // (0.5,0.5), enemy near (1.5,0.5) → within contact 1.15
    const hp0 = sim.snapshot().hero.hp;
    step(sim, 1);
    const hp1 = sim.snapshot().hero.hp;
    expect(hp1).toBeLessThan(hp0); // chipped by contact
  });

  it('expires after its duration and resets its energy to recharge', () => {
    // Non-damaging hero so the lone enemy survives and the combat stays ongoing to observe expiry.
    const sim = makeSim({ ...hero, damage: 0, durationSec: 1, power: { kind: 'nova', periodSec: 100, radius: 0, damage: 0 } });
    step(sim, 2.1);
    sim.deployHero(0, 1);
    expect(sim.snapshot().hero.deployed).toBe(true);
    step(sim, 1.1);
    const h = sim.snapshot().hero;
    expect(h.deployed).toBe(false);
    expect(h.energy).toBeLessThan(1); // recharging again
  });

  it('is deterministic across two identical runs', () => {
    const a = makeSim();
    const b = makeSim();
    step(a, 2.1);
    step(b, 2.1);
    a.deployHero(0, 1);
    b.deployHero(0, 1);
    step(a, 2);
    step(b, 2);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});

describe('hero data + progression', () => {
  it('scales HP and damage with level', () => {
    const def = HEROES_BY_ID.get('pyromancer')!;
    const l1 = scaleHeroConfig(def, 1);
    const l3 = scaleHeroConfig(def, 3);
    expect(l3.maxHp).toBeGreaterThan(l1.maxHp);
    expect(l3.damage).toBeGreaterThan(l1.damage);
  });

  it('promote cost grows and caps at max level', () => {
    expect(heroPromoteCost(1)).toEqual({ cards: 2, gold: 300 });
    expect(heroPromoteCost(6)).toBeNull();
  });
});

describe('AppState heroes', () => {
  it('owns the starter hero and can activate an unlocked one', () => {
    const app = makeApp();
    expect(app.activeHeroId).toBe(STARTER_HERO);
    expect(app.isHeroOwned(STARTER_HERO)).toBe(true);
    expect(app.activeHeroConfig()).not.toBeNull();
    // A locked hero can't be activated until unlocked via cards.
    const locked = HEROES_BY_ID.get('frost_king')!;
    expect(app.selectHero(locked.id)).toBe(false);
    app.addHeroCards(locked.id, 1); // first card unlocks at level 1
    expect(app.isHeroOwned(locked.id)).toBe(true);
    expect(app.selectHero(locked.id)).toBe(true);
    expect(app.activeHeroId).toBe(locked.id);
  });

  it('promotes a hero by spending cards + gold', () => {
    const app = makeApp();
    app.addHeroCards(STARTER_HERO, 100);
    app.addGold(100000);
    const before = app.heroLevel(STARTER_HERO);
    expect(app.promoteHero(STARTER_HERO)).toBe(before + 1);
  });

  it('migrates a v7 save by seeding the heroes block', () => {
    const fresh = createDefaultSaveData();
    const v7 = { ...fresh } as unknown;
    delete (v7 as { heroes?: unknown }).heroes;
    const migrated = migrateSaveData({ schemaVersion: 7, data: v7 });
    expect(migrated.heroes.active).toBe(STARTER_HERO);
    expect(migrated.heroes.owned[STARTER_HERO]).toEqual({ level: 1, cards: 0 });
  });
});
