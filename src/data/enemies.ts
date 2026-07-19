export type EnemyKind = 'grunt' | 'speedster' | 'brute' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  label: string;
  icon: string;
  color: string;
  baseHp: number;
  hpGrowthPerWave: number; // fractional growth applied per wave number
  speed: number; // tiles per second
  dmgToKeep: number;
  baseGold: number;
  goldPerWave: number; // extra gold per wave index, floor(wave / this)
  minWave: number; // first wave this enemy can appear on
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    kind: 'grunt',
    label: 'Maraudeur',
    icon: '👹',
    color: '#8fd694',
    baseHp: 20,
    hpGrowthPerWave: 0.15,
    speed: 1,
    dmgToKeep: 5,
    baseGold: 3,
    goldPerWave: 5,
    minWave: 1,
  },
  speedster: {
    kind: 'speedster',
    label: 'Furtif',
    icon: '🦇',
    color: '#f5e26b',
    baseHp: 12,
    hpGrowthPerWave: 0.15,
    speed: 1.8,
    dmgToKeep: 4,
    baseGold: 2,
    goldPerWave: 5,
    minWave: 2,
  },
  brute: {
    kind: 'brute',
    label: 'Colosse',
    icon: '🗿',
    color: '#d97a7a',
    baseHp: 55,
    hpGrowthPerWave: 0.15,
    speed: 0.6,
    dmgToKeep: 10,
    baseGold: 6,
    goldPerWave: 5,
    minWave: 4,
  },
  boss: {
    kind: 'boss',
    label: 'Seigneur de Guerre',
    icon: '👑',
    color: '#ff5d7a',
    baseHp: 300,
    hpGrowthPerWave: 0.2,
    speed: 0.5,
    dmgToKeep: 25,
    baseGold: 40,
    goldPerWave: 1,
    minWave: 5,
  },
};

export function enemyHpAtWave(kind: EnemyKind, wave: number): number {
  const def = ENEMIES[kind];
  return Math.round(def.baseHp * (1 + def.hpGrowthPerWave * (wave - 1)));
}

export function enemyGoldAtWave(kind: EnemyKind, wave: number): number {
  const def = ENEMIES[kind];
  return def.baseGold + Math.floor(wave / def.goldPerWave);
}
