import type { Cell } from './types';

/** True if every consecutive pair of waypoints is 4-connected (differs by 1 in exactly one axis). */
export function isPathConnected(path: Cell[]): boolean {
  if (path.length < 2) return path.length === 1;
  for (let i = 1; i < path.length; i++) {
    const dc = Math.abs(path[i].col - path[i - 1].col);
    const dr = Math.abs(path[i].row - path[i - 1].row);
    if (dc + dr !== 1) return false;
  }
  return true;
}

/** Cell-center coordinates (x = col+0.5, y = row+0.5) at a fractional position along the path. */
export function pathPosition(path: Cell[], progress: number): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 };
  const clamped = Math.max(0, Math.min(path.length - 1, progress));
  const i = Math.floor(clamped);
  const frac = clamped - i;
  const a = path[i];
  const b = path[Math.min(path.length - 1, i + 1)];
  return { x: a.col + (b.col - a.col) * frac + 0.5, y: a.row + (b.row - a.row) * frac + 0.5 };
}

/** Membership test for a cell in the path (used to forbid unit placement on path cells). */
export function isPathCell(path: Cell[], col: number, row: number): boolean {
  return path.some((c) => c.col === col && c.row === row);
}

export function pathEndProgress(path: Cell[]): number {
  return Math.max(0, path.length - 1);
}
