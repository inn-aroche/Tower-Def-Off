import { describe, expect, it } from 'vitest';
import { Grid, expandPath } from '../src/sim/Grid';
import { MAPS } from '../src/data/maps';

describe('expandPath', () => {
  it('expands sparse waypoints into every unit cell in order', () => {
    const cells = expandPath([{ col: 0, row: 0 }, { col: 0, row: 2 }, { col: 2, row: 2 }]);
    expect(cells).toEqual([
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ]);
  });
});

describe('Grid', () => {
  it('every map path stays within grid bounds', () => {
    for (const map of MAPS) {
      const grid = new Grid(map);
      for (const cell of grid.pathPolyline) {
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeLessThan(map.cols);
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(map.rows);
      }
    }
  });

  it('path cells are never buildable, and non-path cells are', () => {
    const grid = new Grid(MAPS[0]);
    for (const cell of grid.pathPolyline) {
      expect(grid.isBuildable(cell.col, cell.row)).toBe(false);
    }
    // (0,0) is off the "Sentier Sinueux" path entirely.
    expect(grid.isBuildable(0, 0)).toBe(true);
  });

  it('isBuildable rejects out-of-bounds cells', () => {
    const grid = new Grid(MAPS[0]);
    expect(grid.isBuildable(-1, 0)).toBe(false);
    expect(grid.isBuildable(0, 999)).toBe(false);
  });

  it('cellCenter and pixelToCell round-trip after layout', () => {
    const grid = new Grid(MAPS[0]);
    grid.layout(700, 1200);
    const center = grid.cellCenter(2, 5);
    const back = grid.pixelToCell(center.x, center.y);
    expect(back).toEqual({ col: 2, row: 5 });
  });

  it('pointAtDistance(0) matches the spawn cell center', () => {
    const grid = new Grid(MAPS[0]);
    grid.layout(700, 1200);
    const p = grid.pointAtDistance(0);
    const spawnCenter = grid.cellCenter(grid.spawnCell.col, grid.spawnCell.row);
    expect(p).toEqual(spawnCenter);
  });

  it('pointAtDistance at the max path length matches the keep cell center', () => {
    const grid = new Grid(MAPS[0]);
    grid.layout(700, 1200);
    const p = grid.pointAtDistance(grid.pathLengthTiles);
    const keepCenter = grid.cellCenter(grid.keepCell.col, grid.keepCell.row);
    expect(p.x).toBeCloseTo(keepCenter.x, 5);
    expect(p.y).toBeCloseTo(keepCenter.y, 5);
  });
});
