import { describe, expect, it } from 'vitest';
import { Grid, isInBounds } from '../src/sim/Grid';
import type { PlacedUnit } from '../src/sim/types';

describe('Grid', () => {
  const unit: PlacedUnit = { unitId: 'swordsman', level: 1, col: 2, row: 3, attackCooldownSec: 0 };

  it('reports occupied/empty correctly', () => {
    const grid = new Grid(6, 8, [unit]);
    expect(grid.isOccupied(2, 3)).toBe(true);
    expect(grid.isEmpty(2, 3)).toBe(false);
    expect(grid.isEmpty(0, 0)).toBe(true);
    expect(grid.at(2, 3)).toEqual(unit);
    expect(grid.at(0, 0)).toBeUndefined();
  });

  it('treats out-of-bounds cells as not empty', () => {
    const grid = new Grid(6, 8, []);
    expect(grid.isEmpty(-1, 0)).toBe(false);
    expect(grid.isEmpty(6, 0)).toBe(false);
    expect(grid.isEmpty(0, 8)).toBe(false);
  });

  it('isInBounds matches grid dimensions', () => {
    expect(isInBounds(0, 0, 6, 8)).toBe(true);
    expect(isInBounds(5, 7, 6, 8)).toBe(true);
    expect(isInBounds(6, 0, 6, 8)).toBe(false);
    expect(isInBounds(0, 8, 6, 8)).toBe(false);
    expect(isInBounds(-1, 0, 6, 8)).toBe(false);
  });
});
