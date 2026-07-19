import { describe, expect, it } from 'vitest';
import { cellToPixel, computeBoardLayout, pixelToCell } from '../src/render/BoardLayout';

describe('computeBoardLayout / cellToPixel / pixelToCell', () => {
  it('round-trips a pixel back to the same cell it was computed from', () => {
    const layout = computeBoardLayout(390, 844, 6, 8, 76, 110);
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const { x, y } = cellToPixel(layout, col, row);
        const cell = pixelToCell(layout, x + layout.cellSize / 2, y + layout.cellSize / 2);
        expect(cell).toEqual({ col, row });
      }
    }
  });

  it('returns null for points outside the board (in the HUD areas)', () => {
    const layout = computeBoardLayout(390, 844, 6, 8, 76, 110);
    expect(pixelToCell(layout, 10, 10)).toBeNull(); // top HUD
    expect(pixelToCell(layout, 10, 840)).toBeNull(); // bottom HUD
    expect(pixelToCell(layout, -5, 200)).toBeNull(); // left of board
  });

  it('centers the board horizontally when cell size is capped by height', () => {
    const layout = computeBoardLayout(390, 844, 6, 8, 76, 110);
    const boardW = layout.cellSize * layout.cols;
    expect(layout.originX).toBeCloseTo((390 - boardW) / 2, 5);
  });
});
