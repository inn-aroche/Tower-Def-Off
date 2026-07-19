import type { Cell, LevelDef } from '../sim/types';

/**
 * Shared serpentine path for the 6x8 board (enemies enter top-centre, wind down to the base at
 * the bottom). 4-connected. Leaves ~33 grass cells for unit placement. Per-level distinct paths
 * arrive with the 20-node hub in M3; M2 reuses one well-shaped route across the first 5 levels.
 */
export const CAMPAIGN_PATH: Cell[] = [
  { col: 2, row: 0 },
  { col: 2, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 4, row: 3 },
  { col: 4, row: 4 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 1, row: 4 },
  { col: 1, row: 5 },
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 3, row: 7 },
];

/**
 * First 5 PvE levels of the saga campaign (M3 expands the hub to 20 nodes).
 * Numbers are a first pass — validated (and re-tuned if needed) by
 * `npm run simulate`, never by feel alone. See decisions.md.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 'level-01',
    name: 'Premières Lueurs',
    playerStartLife: 12,
    path: CAMPAIGN_PATH,
    waves: [
      { startDelaySec: 3, spawnGroups: [{ enemyId: 'goblin', count: 5, intervalSec: 1.2, startDelaySec: 0 }] },
      { startDelaySec: 14, spawnGroups: [{ enemyId: 'goblin', count: 7, intervalSec: 1.0, startDelaySec: 0 }] },
      {
        startDelaySec: 16,
        spawnGroups: [
          { enemyId: 'goblin', count: 6, intervalSec: 0.9, startDelaySec: 0 },
          { enemyId: 'runner', count: 3, intervalSec: 1.5, startDelaySec: 2 },
        ],
      },
    ],
  },
  {
    id: 'level-02',
    name: 'Sentier des Coureurs',
    playerStartLife: 12,
    path: CAMPAIGN_PATH,
    waves: [
      { startDelaySec: 3, spawnGroups: [{ enemyId: 'goblin', count: 6, intervalSec: 1.0, startDelaySec: 0 }] },
      {
        startDelaySec: 13,
        spawnGroups: [
          { enemyId: 'runner', count: 4, intervalSec: 1.1, startDelaySec: 0 },
          { enemyId: 'goblin', count: 4, intervalSec: 1.2, startDelaySec: 1 },
        ],
      },
      {
        startDelaySec: 16,
        spawnGroups: [{ enemyId: 'runner', count: 6, intervalSec: 0.9, startDelaySec: 0 }],
      },
    ],
  },
  {
    id: 'level-03',
    name: 'Marche des Brutes',
    playerStartLife: 13,
    path: CAMPAIGN_PATH,
    waves: [
      { startDelaySec: 3, spawnGroups: [{ enemyId: 'goblin', count: 6, intervalSec: 0.9, startDelaySec: 0 }] },
      {
        startDelaySec: 12,
        spawnGroups: [{ enemyId: 'brute', count: 2, intervalSec: 2.4, startDelaySec: 0 }],
      },
      {
        startDelaySec: 16,
        spawnGroups: [
          { enemyId: 'brute', count: 2, intervalSec: 2.6, startDelaySec: 0 },
          { enemyId: 'runner', count: 4, intervalSec: 1.1, startDelaySec: 1 },
        ],
      },
    ],
  },
  {
    id: 'level-04',
    name: 'Convergence',
    playerStartLife: 15,
    path: CAMPAIGN_PATH,
    waves: [
      {
        startDelaySec: 3,
        spawnGroups: [
          { enemyId: 'goblin', count: 6, intervalSec: 0.9, startDelaySec: 0 },
          { enemyId: 'runner', count: 3, intervalSec: 1.3, startDelaySec: 1 },
        ],
      },
      {
        startDelaySec: 14,
        spawnGroups: [
          { enemyId: 'brute', count: 2, intervalSec: 2.2, startDelaySec: 0 },
          { enemyId: 'runner', count: 3, intervalSec: 1.1, startDelaySec: 2 },
        ],
      },
      {
        startDelaySec: 15,
        spawnGroups: [
          { enemyId: 'goblin', count: 9, intervalSec: 0.65, startDelaySec: 0 },
          { enemyId: 'brute', count: 2, intervalSec: 2.0, startDelaySec: 2 },
        ],
      },
    ],
  },
  {
    id: 'level-05',
    name: "L'Ombre du Troll",
    playerStartLife: 15,
    path: CAMPAIGN_PATH,
    waves: [
      {
        startDelaySec: 3,
        spawnGroups: [
          { enemyId: 'goblin', count: 8, intervalSec: 0.7, startDelaySec: 0 },
          { enemyId: 'runner', count: 5, intervalSec: 0.9, startDelaySec: 1 },
        ],
      },
      {
        startDelaySec: 12,
        spawnGroups: [
          { enemyId: 'brute', count: 4, intervalSec: 1.5, startDelaySec: 0 },
          { enemyId: 'runner', count: 5, intervalSec: 0.8, startDelaySec: 1 },
        ],
      },
      {
        startDelaySec: 12,
        spawnGroups: [
          { enemyId: 'troll', count: 2, intervalSec: 3.0, startDelaySec: 0 },
          { enemyId: 'goblin', count: 10, intervalSec: 0.6, startDelaySec: 2 },
          { enemyId: 'runner', count: 6, intervalSec: 0.7, startDelaySec: 3 },
        ],
      },
    ],
  },
];
