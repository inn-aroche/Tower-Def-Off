import { describe, expect, it } from 'vitest';
import { computeBoardLayout } from '../src/render/BoardLayout';
import { boardCorners, projectPoint, unprojectCell } from '../src/render/BoardProjection';

describe('BoardProjection (2.5D perspective)', () => {
  const layout = computeBoardLayout(390, 844, 6, 10, 84, 158);

  it('round-trips every cell centre back to the same cell (hit-testing never drifts)', () => {
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const p = projectPoint(layout, col + 0.5, row + 0.5);
        expect(unprojectCell(layout, p.x, p.y)).toEqual({ col, row });
      }
    }
  });

  it('foreshortens: far (top) rows are narrower and smaller than near (bottom) rows', () => {
    const far = projectPoint(layout, layout.cols / 2, 0.5);
    const near = projectPoint(layout, layout.cols / 2, layout.rows - 0.5);
    expect(far.scale).toBeLessThan(near.scale);
    const farWidth = projectPoint(layout, layout.cols, 0).x - projectPoint(layout, 0, 0).x;
    const nearWidth = projectPoint(layout, layout.cols, layout.rows).x - projectPoint(layout, 0, layout.rows).x;
    expect(farWidth).toBeLessThan(nearWidth);
  });

  it('keeps the board inside the flat reference band and centred', () => {
    const [tl, tr, br, bl] = boardCorners(layout);
    // vertical band matches the flat layout inset
    expect(tl.y).toBeCloseTo(layout.originY, 5);
    expect(bl.y).toBeCloseTo(layout.originY + layout.cellSize * layout.rows, 5);
    // symmetric about the board centre
    const cx = layout.originX + (layout.cellSize * layout.cols) / 2;
    expect((tl.x + tr.x) / 2).toBeCloseTo(cx, 5);
    expect((bl.x + br.x) / 2).toBeCloseTo(cx, 5);
    // near edge spans the full flat width; far edge is inset
    expect(bl.x).toBeCloseTo(layout.originX, 4);
    expect(tl.x).toBeGreaterThan(layout.originX);
  });

  it('rejects taps outside the board band', () => {
    expect(unprojectCell(layout, 195, 10)).toBeNull(); // in the top HUD
    expect(unprojectCell(layout, 195, 843)).toBeNull(); // in the bottom HUD
  });
});
