import { describe, expect, it } from 'vitest';
import { isPathCell, isPathConnected, pathEndProgress, pathPosition } from '../src/sim/Path';
import { CAMPAIGN_PATH } from '../src/data/levels';
import type { Cell } from '../src/sim/types';

describe('Path', () => {
  it('accepts a 4-connected path and rejects a jumping one', () => {
    const good: Cell[] = [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];
    const diagonal: Cell[] = [
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    ];
    const gap: Cell[] = [
      { col: 0, row: 0 },
      { col: 0, row: 2 },
    ];
    expect(isPathConnected(good)).toBe(true);
    expect(isPathConnected(diagonal)).toBe(false);
    expect(isPathConnected(gap)).toBe(false);
  });

  it('the campaign path is 4-connected', () => {
    expect(isPathConnected(CAMPAIGN_PATH)).toBe(true);
  });

  it('pathPosition returns cell-centres at integer progress and interpolates between', () => {
    const path: Cell[] = [
      { col: 0, row: 0 },
      { col: 0, row: 2 }, // not connected, but fine for pure interpolation math
    ];
    expect(pathPosition(path, 0)).toEqual({ x: 0.5, y: 0.5 });
    expect(pathPosition(path, 1)).toEqual({ x: 0.5, y: 2.5 });
    expect(pathPosition(path, 0.5)).toEqual({ x: 0.5, y: 1.5 });
  });

  it('pathPosition clamps out-of-range progress', () => {
    const path: Cell[] = [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
    ];
    expect(pathPosition(path, -3)).toEqual({ x: 1.5, y: 0.5 });
    expect(pathPosition(path, 99)).toEqual({ x: 1.5, y: 1.5 });
  });

  it('isPathCell / pathEndProgress reflect the path contents', () => {
    expect(isPathCell(CAMPAIGN_PATH, CAMPAIGN_PATH[0].col, CAMPAIGN_PATH[0].row)).toBe(true);
    expect(isPathCell(CAMPAIGN_PATH, 5, 0)).toBe(false);
    expect(pathEndProgress(CAMPAIGN_PATH)).toBe(CAMPAIGN_PATH.length - 1);
  });
});
