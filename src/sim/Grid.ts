import type { PlacedUnit } from './types';

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function isInBounds(col: number, row: number, cols: number, rows: number): boolean {
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

/** Occupancy lookup over the placed units, keyed by cell. Rebuilt cheaply each query site needs it. */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  private byCell = new Map<string, PlacedUnit>();

  constructor(cols: number, rows: number, units: PlacedUnit[] = []) {
    this.cols = cols;
    this.rows = rows;
    for (const u of units) this.byCell.set(cellKey(u.col, u.row), u);
  }

  at(col: number, row: number): PlacedUnit | undefined {
    return this.byCell.get(cellKey(col, row));
  }

  isEmpty(col: number, row: number): boolean {
    return isInBounds(col, row, this.cols, this.rows) && !this.byCell.has(cellKey(col, row));
  }

  isOccupied(col: number, row: number): boolean {
    return this.byCell.has(cellKey(col, row));
  }
}
