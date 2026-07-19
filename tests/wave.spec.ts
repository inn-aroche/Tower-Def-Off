import { describe, expect, it } from 'vitest';
import { buildSpawnSchedule } from '../src/sim/Wave';
import type { LevelDef } from '../src/sim/types';

describe('buildSpawnSchedule', () => {
  it('flattens waves into an absolute-time, sorted schedule', () => {
    const level: LevelDef = {
      id: 'test',
      name: 'Test',
      playerStartLife: 10,
      waves: [
        { startDelaySec: 2, spawnGroups: [{ enemyId: 'goblin', count: 3, intervalSec: 1, startDelaySec: 0 }] },
        { startDelaySec: 5, spawnGroups: [{ enemyId: 'runner', count: 2, intervalSec: 0.5, startDelaySec: 1 }] },
      ],
    };

    const schedule = buildSpawnSchedule(level);
    expect(schedule).toHaveLength(5);
    // wave 0 starts at t=2, spawns goblins at 2, 3, 4
    expect(schedule[0]).toEqual({ atSec: 2, enemyId: 'goblin', waveIndex: 0 });
    expect(schedule[1]).toEqual({ atSec: 3, enemyId: 'goblin', waveIndex: 0 });
    expect(schedule[2]).toEqual({ atSec: 4, enemyId: 'goblin', waveIndex: 0 });
    // wave 1 starts at t=2+5=7, group startDelay 1 -> runners at 8, 8.5
    expect(schedule[3]).toEqual({ atSec: 8, enemyId: 'runner', waveIndex: 1 });
    expect(schedule[4]).toEqual({ atSec: 8.5, enemyId: 'runner', waveIndex: 1 });

    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].atSec).toBeGreaterThanOrEqual(schedule[i - 1].atSec);
    }
  });

  it('returns an empty schedule for a level with no waves', () => {
    const level: LevelDef = { id: 'empty', name: 'Empty', playerStartLife: 10, waves: [] };
    expect(buildSpawnSchedule(level)).toEqual([]);
  });
});
