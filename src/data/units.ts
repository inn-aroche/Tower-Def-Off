import type { UnitDef } from '../sim/types';

/**
 * M2 roster: 4 damage-family units + 1 gravity-family unit (the differentiator, wired in from
 * mission 1 so its usage can be tracked end to end — see decisions.md).
 * Collection expands to 12 units (incl. 3 gravity) in M3.
 *
 * `range` is a Euclidean radius in cells (enemies follow a path, so targeting is spatial, not
 * per-column). `cost` is the fixed mana cost of the card (M2 card-choice economy).
 */
export const UNITS: UnitDef[] = [
  {
    id: 'swordsman',
    name: 'Épéiste',
    family: 'melee',
    cost: 2,
    levels: [
      { damage: 9, attackIntervalSec: 0.6, range: 1.6, slowFactor: 1 },
      { damage: 16, attackIntervalSec: 0.55, range: 1.7, slowFactor: 1 },
      { damage: 28, attackIntervalSec: 0.5, range: 1.9, slowFactor: 1 },
    ],
  },
  {
    id: 'archer',
    name: 'Archère',
    family: 'ranged',
    cost: 3,
    levels: [
      { damage: 7, attackIntervalSec: 0.75, range: 3.2, slowFactor: 1 },
      { damage: 12, attackIntervalSec: 0.7, range: 3.4, slowFactor: 1 },
      { damage: 20, attackIntervalSec: 0.65, range: 3.7, slowFactor: 1 },
    ],
  },
  {
    id: 'lancer',
    name: 'Lancier',
    family: 'melee',
    cost: 3,
    levels: [
      { damage: 8, attackIntervalSec: 0.7, range: 2.3, slowFactor: 1 },
      { damage: 14, attackIntervalSec: 0.65, range: 2.4, slowFactor: 1 },
      { damage: 24, attackIntervalSec: 0.6, range: 2.6, slowFactor: 1 },
    ],
  },
  {
    id: 'catapult',
    name: 'Catapulte',
    family: 'ranged',
    cost: 5,
    levels: [
      { damage: 18, attackIntervalSec: 1.5, range: 4.8, slowFactor: 1 },
      { damage: 30, attackIntervalSec: 1.4, range: 5.0, slowFactor: 1 },
      { damage: 48, attackIntervalSec: 1.3, range: 5.3, slowFactor: 1 },
    ],
  },
  {
    id: 'gravity_well',
    name: 'Puits de gravité',
    family: 'gravity',
    cost: 4,
    levels: [
      { damage: 0, attackIntervalSec: 0, range: 2.2, slowFactor: 0.6 },
      { damage: 0, attackIntervalSec: 0, range: 2.6, slowFactor: 0.5 },
      { damage: 0, attackIntervalSec: 0, range: 3.0, slowFactor: 0.35 },
    ],
  },
];

/** Default M2 deck — full roster; deck-building UI arrives in M3. */
export const DEFAULT_DECK: string[] = UNITS.map((u) => u.id);
