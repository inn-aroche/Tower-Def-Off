import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { GameState } from '../src/sim/GameState';
import type { LevelConfig } from '../src/data/LevelConfig';

function makeLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 99,
    name: 'Test',
    grid: { cols: 5, rows: 1, blocked: [], spawns: [[0, 0]], exits: [[4, 0]] },
    startGold: 200,
    baseHp: 20,
    allowedTowers: ['laser'],
    waves: [{ delay: 1, spawns: [{ type: 'soldier', count: 1, interval: 1 }] }],
    starGoals: { noLeak: true },
    ...overrides,
  };
}

describe('GameState placement rules', () => {
  it('refuses a placement that would fully block the only path, and spends no gold', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel({ grid: { cols: 3, rows: 1, blocked: [], spawns: [[0, 0]], exits: [[2, 0]] } }));
    const goldBefore = gs.economy.gold;
    const result = gs.tryPlaceTower('laser', 1, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('would-block-path');
    expect(gs.economy.gold).toBe(goldBefore);
    expect(gs.flowField.allSpawnsReachable()).toBe(true);
  });

  it('allows a placement that leaves at least one path open', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel({ grid: { cols: 5, rows: 3, blocked: [], spawns: [[0, 1]], exits: [[4, 1]] } }));
    const result = gs.tryPlaceTower('laser', 2, 1);
    expect(result.ok).toBe(true);
    expect(gs.economy.gold).toBe(200 - 50);
    expect(gs.flowField.allSpawnsReachable()).toBe(true);
  });

  it('rejects towers not in the level allow-list', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel({ allowedTowers: ['laser'] }));
    const result = gs.tryPlaceTower('mortar', 2, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not-allowed');
  });

  it('refunds 70% of cumulative spend on sell', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel({ grid: { cols: 5, rows: 3, blocked: [], spawns: [[0, 1]], exits: [[4, 1]] } }));
    gs.tryPlaceTower('laser', 2, 1);
    const tower = gs.towers[0];
    const goldAfterBuild = gs.economy.gold;
    gs.sellTower(tower.id);
    expect(gs.economy.gold).toBe(goldAfterBuild + Math.round(50 * 0.7));
  });

  it('credits gold for kills made during step() — regression for the dropped stepCombat bounty', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(
      makeLevel({
        grid: { cols: 5, rows: 3, blocked: [], spawns: [[0, 1]], exits: [[4, 1]] },
        waves: [{ delay: 0, spawns: [{ type: 'soldier', count: 1, interval: 1 }] }],
      }),
    );
    gs.tryPlaceTower('laser', 2, 1);
    const tower = gs.towers[0];
    tower.tier = 3; // one-shots the 30hp soldier so the kill happens deterministically within a few ticks
    const goldAfterBuild = gs.economy.gold;

    for (let i = 0; i < 300 && gs.enemies.length === 0 && gs.waveScheduler.phase !== 'awaiting-clear'; i++) gs.step(1 / 30);
    for (let i = 0; i < 300 && gs.enemies.some((e) => e.alive); i++) gs.step(1 / 30);

    expect(gs.economy.gold).toBeGreaterThan(goldAfterBuild);
  });
});
