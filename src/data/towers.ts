export type TowerKind = 'arrow' | 'cannon' | 'frost' | 'arcane';

export interface TowerTier {
  cost: number; // cost to reach THIS tier from the previous one (tier 1 = cost to build)
  dmg: number;
  rate: number; // shots per second
  range: number; // in tiles
  splash?: number; // AoE radius in tiles
  pierce?: number; // extra targets hit in a line
  chain?: number; // extra targets hit via chain lightning-style jump
  slow?: number; // fractional speed reduction applied to target
  slowDur?: number; // seconds
  nova?: boolean; // tier-3 Frost unique: periodic AoE pulse
}

export interface TowerDef {
  kind: TowerKind;
  label: string;
  icon: string;
  color: string;
  description: string;
  tiers: [TowerTier, TowerTier, TowerTier];
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  arrow: {
    kind: 'arrow',
    label: 'Flèche',
    icon: '🏹',
    color: '#5bc8f5',
    description: 'Cadence rapide, cible unique. Le pilier fiable de toute défense.',
    tiers: [
      { cost: 50, dmg: 8, rate: 1.2, range: 3 },
      { cost: 80, dmg: 14, rate: 1.2, range: 3 },
      { cost: 150, dmg: 24, rate: 1.2, range: 3, pierce: 1 },
    ],
  },
  cannon: {
    kind: 'cannon',
    label: 'Canon',
    icon: '💣',
    color: '#ff8a3d',
    description: 'Dégâts de zone lourds, cadence lente. Idéal contre les groupes.',
    tiers: [
      { cost: 90, dmg: 20, rate: 0.6, range: 2.5, splash: 1 },
      { cost: 120, dmg: 35, rate: 0.6, range: 2.5, splash: 1 },
      { cost: 200, dmg: 55, rate: 0.6, range: 2.5, splash: 1.5 },
    ],
  },
  frost: {
    kind: 'frost',
    label: 'Givre',
    icon: '❄️',
    color: '#7fe7e0',
    description: 'Ralentit les ennemis. Ne tue pas vite, mais gagne du temps.',
    tiers: [
      { cost: 70, dmg: 5, rate: 1.0, range: 2.5, slow: 0.3, slowDur: 1.5 },
      { cost: 100, dmg: 5, rate: 1.0, range: 2.5, slow: 0.45, slowDur: 1.5 },
      { cost: 160, dmg: 5, rate: 1.0, range: 2.5, slow: 0.6, slowDur: 1.5, nova: true },
    ],
  },
  arcane: {
    kind: 'arcane',
    label: 'Arcane',
    icon: '🔮',
    color: '#c58cff',
    description: 'Foudre en chaîne qui rebondit entre plusieurs cibles.',
    tiers: [
      { cost: 100, dmg: 12, rate: 0.8, range: 3, chain: 2 },
      { cost: 140, dmg: 12, rate: 0.8, range: 3, chain: 3 },
      { cost: 220, dmg: 15.6, rate: 0.8, range: 3, chain: 4 },
    ],
  },
};

export const TOWER_ORDER: TowerKind[] = ['arrow', 'cannon', 'frost', 'arcane'];

export const CHAIN_FALLOFF = 0.5; // each chain jump deals 50% of the previous hit's damage
