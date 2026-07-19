import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resolveTowerFire, resolveFrostNova } from '../src/sim/Combat';
import { Grid } from '../src/sim/Grid';
import { Tower } from '../src/sim/Tower';
import { Enemy } from '../src/sim/Enemy';
import { MAPS } from '../src/data/maps';

const map = MAPS[0]; // Sentier Sinueux: straight vertical run col=3, rows 0..3 at the start

function makeGrid(): Grid {
  const grid = new Grid(map);
  grid.layout(700, 1200);
  return grid;
}

function enemyAt(distanceTiles: number, wave = 1): Enemy {
  const e = new Enemy('grunt', wave);
  e.distanceTiles = distanceTiles;
  return e;
}

describe('Combat: targeting', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.99)); // never crit unless forced

  it('targets the enemy furthest along the path within range', () => {
    const grid = makeGrid();
    const tower = new Tower('arrow', 3, 1, 50); // sits on col3,row1 — inside the early vertical path segment
    const near = enemyAt(0.2);
    const far = enemyAt(1.8);
    const result = resolveTowerFire(tower, grid, [near, far], {});
    expect(result).not.toBeNull();
    expect(result!.hitEnemies[0]).toBe(far);
  });

  it('returns null when nothing is in range', () => {
    const grid = makeGrid();
    const tower = new Tower('arrow', 3, 1, 50);
    const distant = enemyAt(9); // far down the path, outside the arrow's 3-tile range
    expect(resolveTowerFire(tower, grid, [distant], {})).toBeNull();
  });

  it('applies elemental damage bonus to Frost and Arcane but not Arrow/Cannon', () => {
    const grid = makeGrid();
    const arrow = new Tower('arrow', 3, 1, 50);
    const target1 = enemyAt(0.5);
    resolveTowerFire(arrow, grid, [target1], { elementalDmgPct: 0.5 });
    expect(target1.hp).toBe(target1.maxHp - 8); // base arrow tier-1 dmg, unaffected

    const frost = new Tower('frost', 3, 1, 70);
    const target2 = enemyAt(0.5);
    resolveTowerFire(frost, grid, [target2], { elementalDmgPct: 0.5 });
    expect(target2.hp).toBe(target2.maxHp - 5 * 1.5);
  });
});

describe('Combat: area and multi-hit effects', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.99));

  it('cannon splash damages nearby enemies too', () => {
    const grid = makeGrid();
    const cannon = new Tower('cannon', 3, 1, 90);
    // Targeting picks whichever is furthest along as primary; the other falls within splash radius either way.
    const a = enemyAt(0.5);
    const b = enemyAt(0.6);
    resolveTowerFire(cannon, grid, [a, b], {});
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('frost applies a slow that reduces effective speed', () => {
    const grid = makeGrid();
    const frost = new Tower('frost', 3, 1, 70);
    const target = enemyAt(0.5);
    resolveTowerFire(frost, grid, [target], {});
    expect(target.slowFactor).toBeCloseTo(0.7, 5);
    expect(target.slowTimer).toBeGreaterThan(0);
  });

  it('arcane chains to additional nearby targets with falloff damage', () => {
    const grid = makeGrid();
    const arcane = new Tower('arcane', 3, 1, 100);
    // Targeting always picks the furthest-along enemy as primary (full dmg); the chain jump
    // then reaches the other one at reduced (falloff) damage.
    const chainTarget = enemyAt(0.5);
    const primaryTarget = enemyAt(0.55);
    resolveTowerFire(arcane, grid, [chainTarget, primaryTarget], {});
    expect(chainTarget.hp).toBeLessThan(chainTarget.maxHp);
    const chainDmg = chainTarget.maxHp - chainTarget.hp;
    const primaryDmg = primaryTarget.maxHp - primaryTarget.hp;
    expect(chainDmg).toBeLessThan(primaryDmg);
  });

  it('tier-3 Frost nova hits everyone in radius around the tower regardless of fire cooldown', () => {
    const grid = makeGrid();
    const frost = new Tower('frost', 3, 1, 70);
    frost.tier = 3;
    const target = enemyAt(0.3);
    const result = resolveFrostNova(frost, grid, [target], {});
    expect(result.hitEnemies).toContain(target);
  });
});

describe('Combat: critical hits', () => {
  it('Ranger crit chance can roughly double damage on a forced crit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // always crit
    const grid = makeGrid();
    const arrow = new Tower('arrow', 3, 1, 50);
    const target = enemyAt(0.5);
    resolveTowerFire(arrow, grid, [target], { critChanceBonus: 1, critMultiplierBonus: 1 });
    expect(target.maxHp - target.hp).toBe(8 * 2);
    vi.restoreAllMocks();
  });
});
