import type { Grid } from './Grid';

export const UNREACHABLE = Number.POSITIVE_INFINITY;

/**
 * Multi-source Dijkstra/BFS flow field computed once from all exits.
 * Ground enemies read a single direction per cell per frame (O(1)); recompute
 * only happens on tower placement/sale, never per-frame.
 */
export class FlowField {
  private readonly distance: Float64Array;
  private readonly dirCol: Int8Array;
  private readonly dirRow: Int8Array;

  constructor(private readonly grid: Grid) {
    const size = grid.cols * grid.rows;
    this.distance = new Float64Array(size).fill(UNREACHABLE);
    this.dirCol = new Int8Array(size);
    this.dirRow = new Int8Array(size);
    this.recompute();
  }

  recompute(): void {
    const { grid } = this;
    const size = grid.cols * grid.rows;
    this.distance.fill(UNREACHABLE);
    this.dirCol.fill(0);
    this.dirRow.fill(0);

    const queue: number[] = [];
    let head = 0;

    for (const [ec, er] of grid.exits) {
      if (!grid.inBounds(ec, er)) continue;
      const idx = grid.index(ec, er);
      this.distance[idx] = 0;
      queue.push(idx);
    }

    while (head < queue.length) {
      const idx = queue[head++];
      const col = idx % grid.cols;
      const row = Math.floor(idx / grid.cols);
      const dist = this.distance[idx];

      for (const [nc, nr] of grid.neighbors(col, row)) {
        if (!grid.isTraversable(nc, nr) && grid.kindAt(nc, nr) !== 'exit') continue;
        const nIdx = grid.index(nc, nr);
        if (this.distance[nIdx] !== UNREACHABLE) continue;
        this.distance[nIdx] = dist + 1;
        // Direction stored points from neighbor back toward this cell (i.e. toward the exit).
        this.dirCol[nIdx] = col - nc;
        this.dirRow[nIdx] = row - nr;
        queue.push(nIdx);
        if (queue.length > size) break; // defensive: should never exceed grid size
      }
    }
  }

  distanceAt(col: number, row: number): number {
    if (!this.grid.inBounds(col, row)) return UNREACHABLE;
    return this.distance[this.grid.index(col, row)];
  }

  isReachable(col: number, row: number): boolean {
    return this.distanceAt(col, row) !== UNREACHABLE;
  }

  /** Direction to move from (col,row) toward the nearest exit, or null if unreachable/at exit. */
  directionAt(col: number, row: number): [number, number] | null {
    if (!this.grid.inBounds(col, row)) return null;
    const idx = this.grid.index(col, row);
    if (this.distance[idx] === UNREACHABLE || this.distance[idx] === 0) return null;
    return [this.dirCol[idx], this.dirRow[idx]];
  }

  /** Every spawn must be able to reach an exit for the current topology. */
  allSpawnsReachable(): boolean {
    return this.grid.spawns.every(([c, r]) => this.isReachable(c, r));
  }
}
