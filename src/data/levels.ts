import type { LevelDef } from '../sim/types';

/**
 * First 5 PvE levels of the saga campaign (M3 expands the hub to 20 nodes).
 * Numbers are a first pass — validated (and re-tuned if needed) by
 * `npm run simulate`, never by feel alone. See decisions.md M1 entry.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 'level-01',
    name: 'Premières Lueurs',
    playerStartLife: 12,
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
        startDelaySec: 18,
        spawnGroups: [
          { enemyId: 'goblin', count: 6, intervalSec: 0.8, startDelaySec: 0 },
          { enemyId: 'brute', count: 1, intervalSec: 0, startDelaySec: 3 },
        ],
      },
    ],
  },
  {
    id: 'level-05',
    name: "L'Ombre du Troll",
    playerStartLife: 16,
    waves: [
      {
        startDelaySec: 3,
        spawnGroups: [
          { enemyId: 'goblin', count: 6, intervalSec: 0.9, startDelaySec: 0 },
          { enemyId: 'runner', count: 3, intervalSec: 1.2, startDelaySec: 1 },
        ],
      },
      {
        startDelaySec: 15,
        spawnGroups: [{ enemyId: 'brute', count: 3, intervalSec: 2.0, startDelaySec: 0 }],
      },
      {
        startDelaySec: 16,
        spawnGroups: [
          { enemyId: 'troll', count: 1, intervalSec: 0, startDelaySec: 0 },
          { enemyId: 'goblin', count: 5, intervalSec: 1.0, startDelaySec: 2 },
          { enemyId: 'runner', count: 3, intervalSec: 1.1, startDelaySec: 4 },
        ],
      },
    ],
  },
];
