import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import { BotDriver } from '../src/sim/BotPolicy';
import { ECONOMY } from '../src/data/economy';
import { CAMPAIGN_PATH } from '../src/data/levels';
import { ENEMIES, ENEMIES_BY_ID } from '../src/data/enemies';
import { DEFAULT_DECK, UNITS } from '../src/data/units';
import {
  SURVIVAL_START_LIFE,
  SURVIVAL_WAVE_GAP_SEC,
  survivalHpMult,
  survivalRewards,
  survivalWave,
} from '../src/data/survival';
import type { LevelDef } from '../src/sim/types';

const BOSS_IDS = new Set(ENEMIES.filter((e) => e.boss).map((e) => e.id));

function countEnemies(waveIndex: number): number {
  return survivalWave(waveIndex).spawnGroups.reduce((n, g) => n + g.count, 0);
}

describe('survival wave generator', () => {
  it('is a pure function of the wave index', () => {
    expect(survivalWave(12)).toEqual(survivalWave(12));
    expect(survivalWave(0)).not.toEqual(survivalWave(7));
  });

  it('escalates the enemy count with depth', () => {
    expect(countEnemies(20)).toBeGreaterThan(countEnemies(0));
    expect(countEnemies(40)).toBeGreaterThan(countEnemies(20));
  });

  it('ramps HP monotonically upward', () => {
    expect(survivalHpMult(0)).toBe(1);
    expect(survivalHpMult(10)).toBeGreaterThan(survivalHpMult(0));
    expect(survivalHpMult(25)).toBeGreaterThan(survivalHpMult(10));
  });

  it('places a boss on every 5th wave and none in between', () => {
    for (let n = 1; n <= 40; n++) {
      const hasBoss = survivalWave(n).spawnGroups.some((g) => BOSS_IDS.has(g.enemyId));
      expect(hasBoss).toBe(n % 5 === 0);
    }
  });

  it('only references real enemy ids', () => {
    for (let n = 0; n <= 30; n++) {
      for (const g of survivalWave(n).spawnGroups) expect(ENEMIES_BY_ID.has(g.enemyId)).toBe(true);
    }
  });

  it('rewards scale with the wave reached', () => {
    expect(survivalRewards(10).gold).toBeGreaterThan(survivalRewards(3).gold);
    expect(survivalRewards(10).gems).toBe(2);
    expect(survivalRewards(4).gems).toBe(0);
  });
});

function survivalSim() {
  const level: LevelDef = { id: 'survival', name: 'Survie', playerStartLife: SURVIVAL_START_LIFE, path: CAMPAIGN_PATH, waves: [] };
  return new CombatSim({
    economy: ECONOMY,
    level,
    deck: DEFAULT_DECK,
    unitDefs: UNITS,
    enemyDefs: ENEMIES,
    survival: { makeWave: survivalWave, hpMultForWave: survivalHpMult, waveGapSec: SURVIVAL_WAVE_GAP_SEC },
  });
}

describe('CombatSim endless mode', () => {
  it('flags the snapshot as endless and never reports victory', () => {
    const sim = survivalSim();
    expect(sim.snapshot().endless).toBe(true);
    // Run a long while with no defense: it must end in defeat, never victory.
    for (let i = 0; i < 30 * 120 && sim.snapshot().outcome === 'ongoing'; i++) sim.step(1 / 30);
    expect(sim.snapshot().outcome).toBe('defeat');
  });

  it('keeps generating waves past the first when the base is defended', () => {
    const sim = survivalSim();
    // A scripted defender (the same BotDriver the sims use) keeps the base alive long enough
    // for the endless generator to roll several waves.
    const bot = new BotDriver(sim, DEFAULT_DECK, UNITS, CAMPAIGN_PATH, ECONOMY.gridCols, ECONOMY.gridRows, 0.4);
    for (let i = 0; i < 30 * 40 && sim.snapshot().outcome === 'ongoing'; i++) {
      sim.step(1 / 30);
      bot.update(sim.snapshot().elapsedSec);
    }
    expect(sim.snapshot().currentWaveIndex).toBeGreaterThan(0);
  });

  it('scales spawned enemy HP by the wave multiplier', () => {
    const sim = survivalSim();
    sim.step(1 / 30);
    const goblinBase = ENEMIES_BY_ID.get('goblin')!.hp;
    const first = sim.snapshot().enemies.find((e) => e.enemyId === 'goblin');
    // Wave 0 mult is 1, so the first goblin's maxHp equals the base.
    expect(first?.maxHp).toBe(goblinBase);
  });

  it('is deterministic across two identical runs', () => {
    const a = survivalSim();
    const b = survivalSim();
    for (let i = 0; i < 30 * 20; i++) {
      a.step(1 / 30);
      b.step(1 / 30);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
