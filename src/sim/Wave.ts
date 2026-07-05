import type { EnemyType } from '../data/enemies';

export interface WaveSpawnGroup {
  type: EnemyType;
  count: number;
  /** Seconds between individual spawns within this group. */
  interval: number;
}

export interface WaveConfig {
  /** Seconds of build-phase before this wave auto-starts (used for early-call bonus timing). */
  delay: number;
  spawns: WaveSpawnGroup[];
}

export function waveTotalEnemyCount(wave: WaveConfig): number {
  return wave.spawns.reduce((sum, g) => sum + g.count, 0);
}
