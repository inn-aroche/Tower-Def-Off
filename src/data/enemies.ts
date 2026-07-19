import type { EnemyDef } from '../sim/types';

/** speed = cells/sec along the path. Tuned against `npm run simulate` for a graded difficulty
 * curve (early levels forgiving, later ones threatening a slow player). */
export const ENEMIES: EnemyDef[] = [
  { id: 'goblin', name: 'Gobelin', hp: 26, speed: 0.95, damageToBase: 1 },
  { id: 'runner', name: 'Coureur', hp: 16, speed: 1.7, damageToBase: 1 },
  { id: 'brute', name: 'Brute', hp: 85, speed: 0.7, damageToBase: 2 },
  { id: 'troll', name: 'Troll', hp: 320, speed: 0.5, damageToBase: 3 },
];
