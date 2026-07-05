import type { TowerId } from './towers';
import type { WaveConfig } from '../sim/Wave';

export interface StarGoals {
  /** 2nd star: survive without any leaks. */
  noLeak: boolean;
  /** 2nd/3rd star: finish using at most this many towers built. */
  maxTowers?: number;
  /** 3rd star: finish having spent at most this much gold. */
  maxGoldSpent?: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  grid: {
    cols: number;
    rows: number;
    blocked: Array<[number, number]>;
    spawns: Array<[number, number]>;
    exits: Array<[number, number]>;
  };
  startGold: number;
  baseHp: number;
  allowedTowers: TowerId[];
  waves: WaveConfig[];
  starGoals: StarGoals;
  /** Contextual tutorial hints shown only on level 1. */
  tutorial?: boolean;
}
