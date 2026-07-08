import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { GameState } from '../src/sim/GameState';
import { Tower } from '../src/sim/Tower';
import { Enemy } from '../src/sim/Enemy';
import { EnemySpatialIndex, stepCombat } from '../src/sim/Combat';
import { FlowField } from '../src/sim/FlowField';
import { Grid } from '../src/sim/Grid';
import { TOWERS } from '../src/data/towers';
import type { LevelConfig } from '../src/data/LevelConfig';

describe('Wall — cheap, inert path-shaper', () => {
  it('costs a fraction of the cheapest attack tower', () => {
    const wallCost = TOWERS.wall.tiers[0].cost;
    const cheapestAttackTower = Math.min(...['laser', 'mortar', 'tesla', 'cryo'].map((id) => TOWERS[id as keyof typeof TOWERS].tiers[0].cost));
    expect(wallCost).toBeLessThan(cheapestAttackTower);
    expect(wallCost).toBeGreaterThanOrEqual(5);
    expect(wallCost).toBeLessThanOrEqual(10);
  });

  it('has no upgrade path', () => {
    const wall = new Tower('wall', 0, 0);
    expect(wall.canUpgrade()).toBe(false);
    expect(wall.costForNextTier()).toBeNull();
  });

  it('never fires, even standing right next to enemies for a long time', () => {
    const grid = new Grid({ cols: 5, rows: 1, spawns: [[0, 0]], exits: [[4, 0]] });
    const flow = new FlowField(grid);
    const bus = new EventBus();
    const index = new EnemySpatialIndex();
    const wall = new Tower('wall', 2, 0);
    const enemy = new Enemy('soldier', [2, 0]); // sitting exactly on top of the wall's cell

    let projectileFired = false;
    bus.on('projectileFired', () => (projectileFired = true));

    for (let i = 0; i < 300; i++) stepCombat([wall], [enemy], flow, index, 1 / 30, bus);

    expect(projectileFired).toBe(false);
    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it('blocks placement of a new tower on its cell but can itself be placed and sold like any tower', () => {
    const gs = new GameState(new EventBus());
    const level: LevelConfig = {
      id: 999,
      name: 'Wall test',
      grid: { cols: 5, rows: 3, blocked: [], spawns: [[0, 1]], exits: [[4, 1]] },
      startGold: 100,
      baseHp: 20,
      allowedTowers: ['wall', 'laser'],
      waves: [{ delay: 1, spawns: [{ type: 'soldier', count: 1, interval: 1 }] }],
      starGoals: { noLeak: true },
    };
    gs.loadLevel(level);

    const goldBefore = gs.economy.gold;
    const placed = gs.tryPlaceTower('wall', 2, 1);
    expect(placed.ok).toBe(true);
    expect(gs.economy.gold).toBe(goldBefore - TOWERS.wall.tiers[0].cost);

    const second = gs.tryPlaceTower('laser', 2, 1);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('not-buildable');

    const wall = gs.towers.find((t) => t.towerId === 'wall')!;
    const goldAfterBuild = gs.economy.gold;
    gs.sellTower(wall.id);
    expect(gs.economy.gold).toBe(goldAfterBuild + Math.round(TOWERS.wall.tiers[0].cost * TOWERS.wall.sellRefundPct));
  });
});
