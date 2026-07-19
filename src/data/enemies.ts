import type { EnemyDef } from '../sim/types';

export const ENEMIES: EnemyDef[] = [
  { id: 'goblin', name: 'Gobelin', hp: 20, speed: 0.7, damageToBase: 1 },
  { id: 'runner', name: 'Coureur', hp: 12, speed: 1.3, damageToBase: 1 },
  { id: 'brute', name: 'Brute', hp: 50, speed: 0.5, damageToBase: 2 },
  { id: 'troll', name: 'Troll', hp: 160, speed: 0.35, damageToBase: 3 },
];
