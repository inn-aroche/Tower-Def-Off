import type { LevelDef } from './types';

export interface ScheduledSpawn {
  atSec: number;
  enemyId: string;
  waveIndex: number;
  /** Per-enemy HP multiplier applied at spawn (survival mode ramp; campaign pre-scales its defs). */
  hpMult?: number;
}

/** Flattens a level's wave definitions into an absolute-time spawn schedule, sorted ascending. */
export function buildSpawnSchedule(level: LevelDef): ScheduledSpawn[] {
  const schedule: ScheduledSpawn[] = [];
  let waveStart = 0;
  level.waves.forEach((wave, waveIndex) => {
    waveStart += wave.startDelaySec;
    for (const group of wave.spawnGroups) {
      for (let i = 0; i < group.count; i++) {
        schedule.push({
          atSec: waveStart + group.startDelaySec + i * group.intervalSec,
          enemyId: group.enemyId,
          waveIndex,
        });
      }
    }
  });
  schedule.sort((a, b) => a.atSec - b.atSec);
  return schedule;
}
