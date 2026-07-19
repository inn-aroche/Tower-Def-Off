/** Pure pixel<->cell math, shared by the renderer and the input controller so they never drift. */

export interface BoardLayout {
  originX: number;
  originY: number;
  cellSize: number;
  cols: number;
  rows: number;
}

export function computeBoardLayout(
  canvasWidth: number,
  canvasHeight: number,
  cols: number,
  rows: number,
  topInset: number,
  bottomInset: number,
): BoardLayout {
  const availW = canvasWidth;
  const availH = Math.max(0, canvasHeight - topInset - bottomInset);
  const cellSize = Math.max(1, Math.floor(Math.min(availW / cols, availH / rows)));
  const boardW = cellSize * cols;
  const boardH = cellSize * rows;
  const originX = (canvasWidth - boardW) / 2;
  const originY = topInset + (availH - boardH) / 2;
  return { originX, originY, cellSize, cols, rows };
}

export function cellToPixel(layout: BoardLayout, col: number, row: number): { x: number; y: number } {
  return { x: layout.originX + col * layout.cellSize, y: layout.originY + row * layout.cellSize };
}

export function pixelToCell(layout: BoardLayout, x: number, y: number): { col: number; row: number } | null {
  const localX = x - layout.originX;
  const localY = y - layout.originY;
  if (localX < 0 || localY < 0) return null;
  const col = Math.floor(localX / layout.cellSize);
  const row = Math.floor(localY / layout.cellSize);
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null;
  return { col, row };
}
