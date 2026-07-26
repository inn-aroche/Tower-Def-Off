/**
 * Perspective (2.5D) projection for the combat board — the board is tilted ~35° away from the
 * camera so far rows recede toward a horizon (see docs/design/asset-brief.md "board tilted ~35°").
 *
 * It is a *pure* function of the flat {@link BoardLayout} reference frame (same inputs the input
 * controller already has), so the renderer, the Effects layer and hit-testing all derive the SAME
 * projection and can never drift. Coordinates are continuous cell-space (x = col+0.5, y = row+0.5),
 * matching LiveEnemy/hero positions; integer cell corners are projected the same way.
 *
 * The mapping is closed-form and invertible:
 *   v = row / rows                       depth, 0 = far (top), 1 = near (bottom)
 *   scale(v) = MIN + (1-MIN)·v            horizontal + size foreshortening
 *   g(v)     = A·v + (1-A)·v²             vertical bunching toward the horizon
 *   x = cx + (col/cols - 0.5)·boardW·scale
 *   y = topY + boardH·g
 * unproject solves the quadratic g(v)=gy for v, then recovers the column — exact round-trip on
 * cell centres (see tests/board-projection.spec.ts).
 */

import type { BoardLayout } from './BoardLayout';

/** Width of the far (top) edge relative to the near (bottom) edge. Lower = stronger perspective. */
export const PERSP_MIN_SCALE = 0.56;
/** Vertical bunching. g'(0)=A (tight far rows), g'(1)=2-A (tall near rows); A<1 recedes the plane. */
export const PERSP_A = 0.44;

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Foreshortening factor at this depth (1 near, PERSP_MIN_SCALE far) — size sprites by this. */
  scale: number;
}

interface Frame {
  cx: number;
  topY: number;
  boardW: number;
  boardH: number;
  cols: number;
  rows: number;
}

function frame(layout: BoardLayout): Frame {
  const boardW = layout.cellSize * layout.cols;
  const boardH = layout.cellSize * layout.rows;
  return {
    cx: layout.originX + boardW / 2,
    topY: layout.originY,
    boardW,
    boardH,
    cols: layout.cols,
    rows: layout.rows,
  };
}

/** Projects a continuous cell-space point (col, row) to screen pixels + a depth scale. */
export function projectPoint(layout: BoardLayout, col: number, row: number): ProjectedPoint {
  const f = frame(layout);
  const v = row / f.rows;
  const scale = PERSP_MIN_SCALE + (1 - PERSP_MIN_SCALE) * v;
  const g = PERSP_A * v + (1 - PERSP_A) * v * v;
  return {
    x: f.cx + (col / f.cols - 0.5) * f.boardW * scale,
    y: f.topY + f.boardH * g,
    scale,
  };
}

/** The four outer corners of the board slab, far→near (TL, TR, BR, BL). */
export function boardCorners(layout: BoardLayout): [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint] {
  return [
    projectPoint(layout, 0, 0),
    projectPoint(layout, layout.cols, 0),
    projectPoint(layout, layout.cols, layout.rows),
    projectPoint(layout, 0, layout.rows),
  ];
}

/** Inverse projection for hit-testing: screen pixel → integer cell, or null if off the board. */
export function unprojectCell(layout: BoardLayout, sx: number, sy: number): { col: number; row: number } | null {
  const f = frame(layout);
  const gy = (sy - f.topY) / f.boardH;
  if (gy < -0.002 || gy > 1.002) return null;
  const g = Math.min(1, Math.max(0, gy));
  // Solve (1-A)v² + A·v - g = 0 for v ∈ [0,1].
  const a = 1 - PERSP_A;
  const v = a < 1e-9 ? g / PERSP_A : (-PERSP_A + Math.sqrt(PERSP_A * PERSP_A + 4 * a * g)) / (2 * a);
  const scale = PERSP_MIN_SCALE + (1 - PERSP_MIN_SCALE) * v;
  const ucol = (sx - f.cx) / (f.boardW * scale) + 0.5; // fraction of columns [0,1]
  const col = Math.floor(ucol * f.cols);
  const row = Math.floor(v * f.rows);
  if (col < 0 || col >= f.cols || row < 0 || row >= f.rows) return null;
  return { col, row };
}
