import { describe, expect, it } from 'vitest';
import { MAPS, mapForNode } from '../src/data/maps';
import { ECONOMY } from '../src/data/economy';
import { CAMPAIGN } from '../src/data/campaign';

const { gridCols, gridRows } = ECONOMY;

describe('game maps', () => {
  it('every map path is well-formed (in-bounds, 4-connected, distinct cells)', () => {
    for (const map of MAPS) {
      expect(map.path.length).toBeGreaterThanOrEqual(2);
      const seen = new Set<string>();
      for (let i = 0; i < map.path.length; i++) {
        const c = map.path[i];
        expect(c.col, `${map.id} col in bounds`).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeLessThan(gridCols);
        expect(c.row).toBeGreaterThanOrEqual(0);
        expect(c.row).toBeLessThan(gridRows);
        const key = `${c.col},${c.row}`;
        expect(seen.has(key), `${map.id} has a duplicate cell at ${key}`).toBe(false);
        seen.add(key);
        if (i > 0) {
          const p = map.path[i - 1];
          const step = Math.abs(c.col - p.col) + Math.abs(c.row - p.row);
          expect(step, `${map.id} step ${i} must be 4-connected`).toBe(1);
        }
      }
    }
  });

  it('every map enters at the top row and ends at the bottom row (base)', () => {
    for (const map of MAPS) {
      expect(map.path[0].row, `${map.id} enters top`).toBe(0);
      expect(map.path[map.path.length - 1].row, `${map.id} base at bottom`).toBe(gridRows - 1);
    }
  });

  it('leaves enough grass for unit placement (path covers under half the board)', () => {
    for (const map of MAPS) {
      expect(map.path.length).toBeLessThan((gridCols * gridRows) / 2);
    }
  });

  it('cycles maps across campaign nodes for variety', () => {
    expect(mapForNode(0).id).toBe(MAPS[0].id);
    expect(mapForNode(1).id).toBe(MAPS[1].id);
    // The saga uses more than one distinct route.
    const used = new Set(CAMPAIGN.map((n) => n.mapName));
    expect(used.size).toBeGreaterThan(1);
    // Each node's level actually runs on its assigned map path.
    for (const node of CAMPAIGN) {
      expect(node.level.path).toBe(mapForNode(node.index).path);
    }
  });
});
