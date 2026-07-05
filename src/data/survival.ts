import type { WaveConfig } from '../sim/Wave';
import type { LevelConfig } from './LevelConfig';

export type SurvivalTier = 'bronze' | 'silver' | 'gold';

export interface SurvivalTierDef {
  id: SurvivalTier;
  label: string;
  /** 0-based wave index this tier starts the player at (i.e. "vague 1/20/40"). */
  startWaveIndex: number;
  startGold: number;
  /** Score multiplier applied to the absolute wave number reached. */
  scoreMultiplier: number;
}

export const SURVIVAL_TIERS: Record<SurvivalTier, SurvivalTierDef> = {
  bronze: { id: 'bronze', label: 'Bronze (vague 1)', startWaveIndex: 0, startGold: 100, scoreMultiplier: 1 },
  silver: { id: 'silver', label: 'Argent (vague 20)', startWaveIndex: 19, startGold: 420, scoreMultiplier: 1.5 },
  gold: { id: 'gold', label: 'Or (vague 40)', startWaveIndex: 39, startGold: 720, scoreMultiplier: 2 },
};

/** How many waves to pre-generate. Escalating difficulty makes this "quasi-infinite" in practice
 * (see §11) without needing an open-ended generator — no real run reaches wave 200. */
const SURVIVAL_WAVE_COUNT = 200;

/** Pure function of wave index — deterministic and reproducible without needing seeded RNG. */
function generateWave(index: number): WaveConfig {
  const n = index + 1; // 1-based wave number, easier to reason about in the formulas below
  const spawns: WaveConfig['spawns'] = [];

  const soldierCount = 4 + Math.floor(n * 0.8);
  spawns.push({ type: 'soldier', count: soldierCount, interval: Math.max(0.35, 0.9 - n * 0.01) });

  if (n % 3 === 0) {
    spawns.push({ type: 'swarm', count: 6 + Math.floor(n * 1.1), interval: Math.max(0.12, 0.3 - n * 0.002) });
  }
  if (n >= 4 && n % 4 === 0) {
    spawns.push({ type: 'golem', count: 1 + Math.floor(n / 8), interval: Math.max(1.2, 2.5 - n * 0.01) });
  }
  if (n >= 5 && n % 5 === 0) {
    spawns.push({ type: 'drone', count: 1 + Math.floor(n / 9), interval: Math.max(0.5, 1.3 - n * 0.008) });
  }
  if (n >= 7 && n % 6 === 0) {
    spawns.push({ type: 'kamikaze', count: 1 + Math.floor(n / 10), interval: Math.max(0.6, 1.2 - n * 0.006) });
  }
  if (n >= 15 && n % 15 === 0) {
    spawns.push({ type: 'boss', count: 1 + Math.floor(n / 30), interval: 2 });
  }

  const delay = Math.max(3, 8 - n * 0.04);
  return { delay, spawns };
}

let cachedWaves: WaveConfig[] | null = null;
function allSurvivalWaves(): WaveConfig[] {
  if (!cachedWaves) cachedWaves = Array.from({ length: SURVIVAL_WAVE_COUNT }, (_, i) => generateWave(i));
  return cachedWaves;
}

const SURVIVAL_GRID: LevelConfig['grid'] = {
  cols: 18,
  rows: 11,
  blocked: [
    [6, 3], [6, 4], [6, 5], [6, 6], [6, 7],
    [12, 3], [12, 4], [12, 5], [12, 6], [12, 7],
  ],
  spawns: [[0, 5]],
  exits: [[17, 5]],
};

/** Survival ids live outside the 1-10 campaign range so they never collide with SaveManager star keys. */
export const SURVIVAL_LEVEL_ID_BASE = 1000;

export function buildSurvivalLevelConfig(tier: SurvivalTier): LevelConfig {
  const def = SURVIVAL_TIERS[tier];
  const waves = allSurvivalWaves().slice(def.startWaveIndex);
  return {
    id: SURVIVAL_LEVEL_ID_BASE + def.startWaveIndex,
    name: `Survie — ${def.label}`,
    grid: SURVIVAL_GRID,
    startGold: def.startGold,
    baseHp: 20,
    allowedTowers: ['laser', 'mortar', 'tesla', 'cryo'],
    waves,
    starGoals: { noLeak: false },
  };
}

export function survivalScore(tier: SurvivalTier, absoluteWaveIndexReached: number): number {
  return Math.round((absoluteWaveIndexReached + 1) * SURVIVAL_TIERS[tier].scoreMultiplier);
}
