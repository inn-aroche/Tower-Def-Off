import type { UnitDef } from '../sim/types';

const noGravity = { influenceCols: 0, slowFactor: 1 };
const noDamage = { damage: 0, attackIntervalSec: 0 };

/**
 * M1 roster: 4 damage-family units + 1 gravity-family unit (the differentiator, wired in from
 * mission 1 so its usage can be tracked end to end — see decisions.md M1 entry).
 * Collection expands to 12 units (incl. 3 gravity) in M3.
 */
export const UNITS: UnitDef[] = [
  {
    id: 'swordsman',
    name: 'Épéiste',
    family: 'melee',
    levels: [
      { damage: 8, attackIntervalSec: 0.6, rangeRows: 2, ...noGravity },
      { damage: 14, attackIntervalSec: 0.55, rangeRows: 2, ...noGravity },
      { damage: 24, attackIntervalSec: 0.5, rangeRows: 3, ...noGravity },
    ],
  },
  {
    id: 'archer',
    name: 'Archère',
    family: 'ranged',
    levels: [
      { damage: 5, attackIntervalSec: 0.8, rangeRows: 4, ...noGravity },
      { damage: 9, attackIntervalSec: 0.75, rangeRows: 4, ...noGravity },
      { damage: 16, attackIntervalSec: 0.7, rangeRows: 5, ...noGravity },
    ],
  },
  {
    id: 'lancer',
    name: 'Lancier',
    family: 'melee',
    levels: [
      { damage: 6, attackIntervalSec: 0.7, rangeRows: 3, ...noGravity },
      { damage: 11, attackIntervalSec: 0.65, rangeRows: 3, ...noGravity },
      { damage: 19, attackIntervalSec: 0.6, rangeRows: 4, ...noGravity },
    ],
  },
  {
    id: 'catapult',
    name: 'Catapulte',
    family: 'ranged',
    levels: [
      { damage: 14, attackIntervalSec: 1.6, rangeRows: 6, ...noGravity },
      { damage: 24, attackIntervalSec: 1.5, rangeRows: 6, ...noGravity },
      { damage: 40, attackIntervalSec: 1.4, rangeRows: 7, ...noGravity },
    ],
  },
  {
    id: 'gravity_well',
    name: 'Puits de gravité',
    family: 'gravity',
    levels: [
      { rangeRows: 2, influenceCols: 1, slowFactor: 0.6, ...noDamage },
      { rangeRows: 3, influenceCols: 1, slowFactor: 0.5, ...noDamage },
      { rangeRows: 3, influenceCols: 2, slowFactor: 0.35, ...noDamage },
    ],
  },
];

/** Default M1 deck — full roster; deck-building UI arrives in M3. */
export const DEFAULT_DECK: string[] = UNITS.map((u) => u.id);
