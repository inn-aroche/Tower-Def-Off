export type EnemyType = 'soldier' | 'swarm' | 'golem' | 'drone' | 'kamikaze' | 'boss';
export type MovementKind = 'ground' | 'flying';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number; // cells/sec
  bounty: number;
  movement: MovementKind;
  /** Flat damage reduction applied per hit before mitigation floor (Golem). */
  armor: number;
  /** On death, disables the nearest tower within radius for `disableDuration` seconds (Kamikaze). */
  disablesNearestTower?: { radius: number; duration: number };
  /** Damage dealt to base lives if this enemy leaks. */
  leakDamage: number;
  radius: number; // for rendering/collision, in cells
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  soldier: { type: 'soldier', name: 'Soldat', hp: 30, speed: 1.0, bounty: 3, movement: 'ground', armor: 0, leakDamage: 20, radius: 0.3 },
  swarm: { type: 'swarm', name: 'Nuée', hp: 8, speed: 1.6, bounty: 1, movement: 'ground', armor: 0, leakDamage: 20, radius: 0.2 },
  golem: { type: 'golem', name: 'Golem', hp: 200, speed: 0.5, bounty: 12, movement: 'ground', armor: 3, leakDamage: 40, radius: 0.45 },
  drone: { type: 'drone', name: 'Drone', hp: 40, speed: 1.4, bounty: 5, movement: 'flying', armor: 0, leakDamage: 20, radius: 0.3 },
  kamikaze: {
    type: 'kamikaze',
    name: 'Kamikaze',
    hp: 25,
    speed: 1.2,
    bounty: 4,
    movement: 'ground',
    armor: 0,
    disablesNearestTower: { radius: 1.5, duration: 4 },
    leakDamage: 20,
    radius: 0.3,
  },
  boss: { type: 'boss', name: 'Boss', hp: 1500, speed: 0.4, bounty: 60, movement: 'ground', armor: 5, leakDamage: 200, radius: 0.7 },
};

/** Mitigation floor: even fully-armored hits deal at least this much damage. */
export const MIN_DAMAGE_AFTER_ARMOR = 1;

export function damageAfterArmor(rawDamage: number, armor: number, armorPierce: number): number {
  const effectiveArmor = Math.max(0, armor - armorPierce);
  return Math.max(MIN_DAMAGE_AFTER_ARMOR, rawDamage - effectiveArmor);
}
