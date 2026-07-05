export type CellKind = 'empty' | 'blocked' | 'spawn' | 'exit' | 'occupied';

export interface GridConfig {
  cols: number;
  rows: number;
  blocked?: Array<[number, number]>;
  spawns: Array<[number, number]>;
  exits: Array<[number, number]>;
}

/** 4-directional neighbor offsets (no diagonals — required for clean flow-field pathing). */
export const NEIGHBOR_OFFSETS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly spawns: ReadonlyArray<[number, number]>;
  readonly exits: ReadonlyArray<[number, number]>;
  private kinds: CellKind[];

  constructor(config: GridConfig) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.spawns = config.spawns.map((p) => [...p] as [number, number]);
    this.exits = config.exits.map((p) => [...p] as [number, number]);
    this.kinds = new Array(this.cols * this.rows).fill('empty');

    for (const [c, r] of config.blocked ?? []) this.setKind(c, r, 'blocked');
    for (const [c, r] of this.spawns) this.setKind(c, r, 'spawn');
    for (const [c, r] of this.exits) this.setKind(c, r, 'exit');
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  index(col: number, row: number): number {
    return row * this.cols + col;
  }

  kindAt(col: number, row: number): CellKind {
    if (!this.inBounds(col, row)) return 'blocked';
    return this.kinds[this.index(col, row)];
  }

  setKind(col: number, row: number, kind: CellKind): void {
    if (!this.inBounds(col, row)) return;
    this.kinds[this.index(col, row)] = kind;
  }

  /** Traversable = anything the flow field / enemies can walk through (not blocked, not occupied by a tower). */
  isTraversable(col: number, row: number): boolean {
    const k = this.kindAt(col, row);
    return k !== 'blocked' && k !== 'occupied';
  }

  isBuildable(col: number, row: number): boolean {
    return this.kindAt(col, row) === 'empty';
  }

  *neighbors(col: number, row: number): Generator<[number, number]> {
    for (const [dc, dr] of NEIGHBOR_OFFSETS) {
      const nc = col + dc;
      const nr = row + dr;
      if (this.inBounds(nc, nr)) yield [nc, nr];
    }
  }
}
