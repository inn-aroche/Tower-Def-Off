import { describe, it, expect } from 'vitest';
import { ScoreTracker } from '../src/sim/Score';
import { BALANCE } from '../src/data/balance';
import { EventBus } from '../src/core/EventBus';
import { GameState } from '../src/sim/GameState';
import { Tower } from '../src/sim/Tower';
import type { LevelConfig } from '../src/data/LevelConfig';

describe('ScoreTracker', () => {
  it('accrues points every second at the base rate when multiplier is x1', () => {
    const tracker = new ScoreTracker();
    tracker.tick(1);
    expect(tracker.score).toBeCloseTo(BALANCE.scorePerSecondBase, 5);
  });

  it('each kill raises the multiplier, which scales future point gains', () => {
    const tracker = new ScoreTracker();
    tracker.registerKill();
    expect(tracker.multiplier).toBeCloseTo(1 + BALANCE.scoreMultiplierPerKill, 5);
    tracker.tick(1);
    expect(tracker.score).toBeCloseTo(BALANCE.scorePerSecondBase * (1 + BALANCE.scoreMultiplierPerKill), 5);
  });

  it('caps the multiplier so a long run cannot run away to absurd numbers', () => {
    const tracker = new ScoreTracker();
    for (let i = 0; i < 1000; i++) tracker.registerKill();
    expect(tracker.multiplier).toBe(BALANCE.scoreMultiplierMax);
  });

  it('reset() zeroes score and multiplier back to x1', () => {
    const tracker = new ScoreTracker();
    tracker.tick(5);
    tracker.registerKill();
    tracker.reset();
    expect(tracker.score).toBe(0);
    expect(tracker.multiplier).toBe(1);
  });
});

describe('GameState + ScoreTracker integration', () => {
  function makeLevel(): LevelConfig {
    return {
      id: 999,
      name: 'Score test',
      grid: { cols: 5, rows: 3, blocked: [], spawns: [[0, 1]], exits: [[4, 1]] },
      startGold: 200,
      baseHp: 20,
      allowedTowers: ['laser'],
      waves: [{ delay: 1, spawns: [{ type: 'soldier', count: 1, interval: 1 }] }],
      starGoals: { noLeak: true },
    };
  }

  it('ticks score forward as the sim steps, and resets on a new level load', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel());
    expect(gs.scoreTracker.score).toBe(0);
    for (let i = 0; i < 30; i++) gs.step(1 / 30);
    expect(gs.scoreTracker.score).toBeGreaterThan(0);

    gs.loadLevel(makeLevel());
    expect(gs.scoreTracker.score).toBe(0);
    expect(gs.scoreTracker.multiplier).toBe(1);
  });

  it('bumps the multiplier automatically when a kill happens during step()', () => {
    const gs = new GameState(new EventBus());
    gs.loadLevel(makeLevel());
    gs.towers.push(new Tower('laser', 2, 1)); // tier 1 laser is enough to kill a 30hp soldier in a couple hits
    gs.towers[0].tier = 3;

    for (let i = 0; i < 300 && gs.scoreTracker.multiplier === 1; i++) gs.step(1 / 30);

    expect(gs.scoreTracker.multiplier).toBeGreaterThan(1);
  });
});
