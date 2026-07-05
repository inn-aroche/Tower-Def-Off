import { describe, it, expect } from 'vitest';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';

describe('FlowField', () => {
  it('routes every cell toward the single exit', () => {
    const grid = new Grid({ cols: 5, rows: 3, spawns: [[0, 1]], exits: [[4, 1]] });
    const flow = new FlowField(grid);
    expect(flow.allSpawnsReachable()).toBe(true);
    expect(flow.distanceAt(4, 1)).toBe(0);
    expect(flow.distanceAt(0, 1)).toBe(4);
  });

  it('reports unreachable spawns when fully walled off', () => {
    const grid = new Grid({
      cols: 5,
      rows: 3,
      blocked: [[1, 0], [1, 1], [1, 2]],
      spawns: [[0, 1]],
      exits: [[4, 1]],
    });
    const flow = new FlowField(grid);
    expect(flow.allSpawnsReachable()).toBe(false);
  });

  it('supports multi-source exits (Dijkstra from all exits)', () => {
    const grid = new Grid({ cols: 5, rows: 3, spawns: [[0, 1]], exits: [[4, 0], [4, 2]] });
    const flow = new FlowField(grid);
    expect(flow.distanceAt(4, 0)).toBe(0);
    expect(flow.distanceAt(4, 2)).toBe(0);
    expect(flow.allSpawnsReachable()).toBe(true);
  });

  it('recomputes cleanly after topology changes', () => {
    const grid = new Grid({ cols: 5, rows: 3, spawns: [[0, 1]], exits: [[4, 1]] });
    const flow = new FlowField(grid);
    grid.setKind(2, 1, 'occupied');
    flow.recompute();
    // Path must detour around the newly occupied cell.
    expect(flow.distanceAt(0, 1)).toBeGreaterThan(4);
    expect(flow.allSpawnsReachable()).toBe(true);
  });
});
