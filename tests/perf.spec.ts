import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { GameState } from '../src/sim/GameState';
import type { LevelConfig } from '../src/data/LevelConfig';

describe('Performance sanity: ~150 concurrent enemies + several towers', () => {
  it('steps the simulation for a full second of ticks well within budget (no O(n^2) blowup)', () => {
    const level: LevelConfig = {
      id: 999,
      name: 'Perf Stress',
      grid: { cols: 22, rows: 14, blocked: [], spawns: [[0, 7]], exits: [[21, 7]] },
      startGold: 5000,
      baseHp: 9999,
      allowedTowers: ['laser', 'mortar', 'tesla', 'cryo'],
      waves: [{ delay: 0, spawns: [{ type: 'swarm', count: 160, interval: 0.01 }] }],
      starGoals: { noLeak: false },
    };

    const gs = new GameState(new EventBus());
    gs.loadLevel(level);

    // Ring several towers of every type around the corridor so combat (splash/chain/targeting) is exercised.
    const towerTypes: Array<'laser' | 'mortar' | 'tesla' | 'cryo'> = ['laser', 'mortar', 'tesla', 'cryo'];
    let placed = 0;
    for (let row = 4; row <= 10 && placed < 20; row += 2) {
      for (let col = 2; col <= 18 && placed < 20; col += 4) {
        const result = gs.tryPlaceTower(towerTypes[placed % towerTypes.length], col, row);
        if (result.ok) placed++;
      }
    }
    expect(placed).toBeGreaterThan(10);

    // Spawn-in period (interval 0.01s) then a stretch of steady-state combat with everyone on the field.
    const start = performance.now();
    for (let i = 0; i < 30 * 8; i++) gs.step(1 / 30); // 8 sim-seconds
    const elapsedMs = performance.now() - start;

    expect(gs.enemies.length).toBeGreaterThan(0); // sanity: the stress actually had enemies on the field
    // Generous budget for a Node/Vitest environment (no JIT warmup guarantees, shared CI hardware).
    expect(elapsedMs).toBeLessThan(3000);
  });
});
