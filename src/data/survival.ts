import type { LevelConfig } from './LevelConfig';
import { waveCurve } from './waveGenerator';

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

const SURVIVAL_GRID: LevelConfig['grid'] = {
  cols: 15,
  rows: 10,
  blocked: [
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6],
    [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9],
    [11, 0], [11, 1], [11, 2], [11, 3], [11, 4], [11, 5], [11, 6],
  ],
  spawns: [[0, 5]],
  exits: [[14, 5]],
};

/** Survival ids live outside the 1-10 campaign range so they never collide with SaveManager star keys. */
export const SURVIVAL_LEVEL_ID_BASE = 1000;

export function buildSurvivalLevelConfig(tier: SurvivalTier): LevelConfig {
  const def = SURVIVAL_TIERS[tier];
  const waves = waveCurve(SURVIVAL_WAVE_COUNT).slice(def.startWaveIndex);
  return {
    id: SURVIVAL_LEVEL_ID_BASE + def.startWaveIndex,
    name: `Survie — ${def.label}`,
    grid: SURVIVAL_GRID,
    startGold: def.startGold,
    baseHp: 100,
    allowedTowers: ['wall', 'laser', 'mortar', 'tesla', 'cryo'],
    waves,
    starGoals: { noLeak: false },
  };
}

export function survivalScore(tier: SurvivalTier, absoluteWaveIndexReached: number): number {
  return Math.round((absoluteWaveIndexReached + 1) * SURVIVAL_TIERS[tier].scoreMultiplier);
}
