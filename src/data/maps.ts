import { GRID_COLS, GRID_ROWS } from './balance';

export interface Waypoint {
  col: number;
  row: number;
}

export interface MapDef {
  id: string;
  label: string;
  description: string;
  cols: number;
  rows: number;
  // Ordered waypoints; each consecutive pair must share a col OR a row (straight segment).
  waypoints: Waypoint[];
}

export const MAPS: MapDef[] = [
  {
    id: 'sentier-sinueux',
    label: 'Sentier Sinueux',
    description: 'Un long serpentin qui traverse tout le donjon d’un bord à l’autre.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    waypoints: [
      { col: 3, row: 0 },
      { col: 3, row: 3 },
      { col: 0, row: 3 },
      { col: 0, row: 6 },
      { col: 6, row: 6 },
      { col: 6, row: 9 },
      { col: 3, row: 9 },
      { col: 3, row: 11 },
    ],
  },
  {
    id: 'chemin-en-z',
    label: 'Chemin en Z',
    description: 'Trois grandes diagonales en escalier, plus direct mais plus exposé.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    waypoints: [
      { col: 1, row: 0 },
      { col: 1, row: 3 },
      { col: 5, row: 3 },
      { col: 5, row: 6 },
      { col: 1, row: 6 },
      { col: 1, row: 9 },
      { col: 5, row: 9 },
      { col: 5, row: 11 },
    ],
  },
  {
    id: 'chemin-serpentin',
    label: 'Chemin Serpentin',
    description: 'Une échelle serrée à 8 virages : plus de couloirs de tir, moins d’espace au sol.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    waypoints: [
      { col: 2, row: 0 },
      { col: 2, row: 2 },
      { col: 5, row: 2 },
      { col: 5, row: 4 },
      { col: 2, row: 4 },
      { col: 2, row: 6 },
      { col: 5, row: 6 },
      { col: 5, row: 8 },
      { col: 2, row: 8 },
      { col: 2, row: 11 },
    ],
  },
];
