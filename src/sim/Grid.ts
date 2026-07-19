import type { MapDef, Waypoint } from '../data/maps';

export interface PixelPoint {
  x: number;
  y: number;
}

/** Expands sparse straight-segment waypoints into every unit cell the path occupies, in order. */
export function expandPath(waypoints: Waypoint[]): Waypoint[] {
  const cells: Waypoint[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const dCol = Math.sign(to.col - from.col);
    const dRow = Math.sign(to.row - from.row);
    let cur = { ...from };
    while (cur.col !== to.col || cur.row !== to.row) {
      cur = { col: cur.col + dCol, row: cur.row + dRow };
      cells.push(cur);
    }
  }
  return cells;
}

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly pathCells: Set<string>;
  readonly pathPolyline: Waypoint[];
  readonly keepCell: Waypoint;
  readonly spawnCell: Waypoint;
  tileSize = 1;
  originX = 0;
  originY = 0;

  constructor(map: MapDef) {
    this.cols = map.cols;
    this.rows = map.rows;
    this.pathPolyline = expandPath(map.waypoints);
    this.pathCells = new Set(this.pathPolyline.map((c) => key(c.col, c.row)));
    this.spawnCell = map.waypoints[0];
    this.keepCell = map.waypoints[map.waypoints.length - 1];
  }

  layout(canvasWidth: number, canvasHeight: number): void {
    this.tileSize = Math.floor(Math.min(canvasWidth / this.cols, canvasHeight / this.rows));
    this.originX = (canvasWidth - this.tileSize * this.cols) / 2;
    this.originY = (canvasHeight - this.tileSize * this.rows) / 2;
  }

  isPath(col: number, row: number): boolean {
    return this.pathCells.has(key(col, row));
  }

  isBuildable(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows && !this.isPath(col, row);
  }

  cellCenter(col: number, row: number): PixelPoint {
    return {
      x: this.originX + (col + 0.5) * this.tileSize,
      y: this.originY + (row + 0.5) * this.tileSize,
    };
  }

  pixelToCell(x: number, y: number): Waypoint {
    return {
      col: Math.floor((x - this.originX) / this.tileSize),
      row: Math.floor((y - this.originY) / this.tileSize),
    };
  }

  /** Distance-along-path (in tiles) -> pixel position, for enemy movement. */
  pointAtDistance(distanceTiles: number): PixelPoint {
    const clamped = Math.max(0, Math.min(distanceTiles, this.pathPolyline.length - 1));
    const i = Math.floor(clamped);
    const frac = clamped - i;
    const a = this.pathPolyline[i];
    const b = this.pathPolyline[Math.min(i + 1, this.pathPolyline.length - 1)];
    const col = a.col + (b.col - a.col) * frac;
    const row = a.row + (b.row - a.row) * frac;
    return { x: this.originX + (col + 0.5) * this.tileSize, y: this.originY + (row + 0.5) * this.tileSize };
  }

  get pathLengthTiles(): number {
    return this.pathPolyline.length - 1;
  }
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}
