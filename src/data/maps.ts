import type { Cell } from '../sim/types';
import { CAMPAIGN_PATH } from './levels';

/**
 * Named enemy routes for the 6×10 board. Every path is 4-connected, stays in bounds, enters at the
 * top and ends at the bottom row (the base). Multiple maps give the campaign visual + tactical
 * variety (the render + placement rules already read `level.path`, so a new path "just works").
 *
 * Validated by `tests/maps.spec.ts` (connectivity, bounds, distinct cells) and re-balanced via
 * `npm run simulate` — longer routes give the defender more time, so difficulty only eases, never
 * breaks, when a node swaps to a longer map.
 */
export interface GameMap {
  id: string;
  name: string;
  path: Cell[];
}

/** Wide zig-zag sweeping the full width three times. */
const CASCADE: Cell[] = [
  { col: 2, row: 0 }, { col: 2, row: 1 }, { col: 2, row: 2 },
  { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 },
  { col: 5, row: 3 }, { col: 5, row: 4 },
  { col: 4, row: 4 }, { col: 3, row: 4 }, { col: 2, row: 4 }, { col: 1, row: 4 }, { col: 0, row: 4 },
  { col: 0, row: 5 }, { col: 0, row: 6 },
  { col: 1, row: 6 }, { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 5, row: 6 },
  { col: 5, row: 7 }, { col: 5, row: 8 },
  { col: 4, row: 8 }, { col: 3, row: 8 }, { col: 2, row: 8 }, { col: 2, row: 9 },
];

/** Tight spiral-ish route that hugs the left then reopens right. */
const HOLLOW: Cell[] = [
  { col: 3, row: 0 }, { col: 3, row: 1 },
  { col: 2, row: 1 }, { col: 1, row: 1 },
  { col: 1, row: 2 }, { col: 1, row: 3 },
  { col: 2, row: 3 }, { col: 3, row: 3 }, { col: 4, row: 3 },
  { col: 4, row: 4 }, { col: 4, row: 5 },
  { col: 3, row: 5 }, { col: 2, row: 5 }, { col: 1, row: 5 }, { col: 0, row: 5 },
  { col: 0, row: 6 }, { col: 0, row: 7 },
  { col: 1, row: 7 }, { col: 2, row: 7 }, { col: 3, row: 7 },
  { col: 3, row: 8 }, { col: 3, row: 9 },
];

/** Double-S entering from the left. */
const TWIN: Cell[] = [
  { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 },
  { col: 2, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 },
  { col: 4, row: 3 }, { col: 4, row: 4 },
  { col: 3, row: 4 }, { col: 2, row: 4 }, { col: 1, row: 4 },
  { col: 1, row: 5 }, { col: 1, row: 6 },
  { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 4, row: 6 },
  { col: 4, row: 7 }, { col: 4, row: 8 },
  { col: 3, row: 8 }, { col: 2, row: 8 }, { col: 2, row: 9 },
];

export const MAPS: GameMap[] = [
  { id: 'serpent', name: 'Serpent', path: CAMPAIGN_PATH },
  { id: 'cascade', name: 'Cascade', path: CASCADE },
  { id: 'hollow', name: 'Creux', path: HOLLOW },
  { id: 'twin', name: 'Double-S', path: TWIN },
];

export const MAPS_BY_ID = new Map(MAPS.map((m) => [m.id, m]));

/** The map a given campaign node runs on — cycled for variety across the saga. */
export function mapForNode(index: number): GameMap {
  return MAPS[index % MAPS.length];
}
