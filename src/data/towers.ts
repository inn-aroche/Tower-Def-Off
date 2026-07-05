export type TowerId = 'wall' | 'laser' | 'mortar' | 'tesla' | 'cryo';
export type T3Branch = 'A' | 'B' | null;

export interface TowerTierStats {
  /** Cost to reach this tier from the previous one (T1 cost is from empty). */
  cost: number;
  damage: number;
  /** Splash radius in grid cells; 0 for single-target towers. */
  splashRadius: number;
  /** Slow multiplier applied to enemy speed (0 = no slow, 0.4 = -40% speed). */
  slowPct: number;
  /** Damage-over-time per second, applied on hit (cryo/mortar branches). */
  dotPerSecond: number;
  fireRatePerSec: number;
  range: number;
  chainTargets: number;
  targetsAir: boolean;
  targetsGround: boolean;
  /** Flat armor penetration — ignores this much of the target's armor (Laser T3-A). */
  armorPierce: number;
}

export interface T3BranchDef {
  id: Exclude<T3Branch, null>;
  name: string;
  description: string;
  /** Multiplicative/additive modifiers layered on top of the T3 base stats. */
  damageMul?: number;
  fireRateMul?: number;
  rangeAdd?: number;
  splashRadiusAdd?: number;
  slowPctAdd?: number;
  dotPerSecondAdd?: number;
  armorPierceOverride?: number;
  freezePulse?: { duration: number; interval: number };
  airPriority?: boolean;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  description: string;
  tiers: [TowerTierStats, TowerTierStats, TowerTierStats];
  t3Branches: [T3BranchDef, T3BranchDef];
  sellRefundPct: number;
  /** False for pure structural pieces (the Wall) — hides the upgrade path entirely. Defaults to true. */
  upgradable?: boolean;
}

const SELL_REFUND_PCT = 0.7;

/** A single inert tier reused for the Wall's 3 slots — upgradable:false means tier 2/3 are unreachable anyway. */
const WALL_TIER: TowerTierStats = {
  cost: 8,
  damage: 0,
  splashRadius: 0,
  slowPct: 0,
  dotPerSecond: 0,
  fireRatePerSec: 0.1,
  range: 0,
  chainTargets: 1,
  targetsAir: false,
  targetsGround: false, // both false — it never qualifies as a valid target for any enemy, so it never fires
  armorPierce: 0,
};

export const TOWERS: Record<TowerId, TowerDef> = {
  wall: {
    id: 'wall',
    name: 'Mur',
    description: "Bloc inerte, sans attaque — le moyen le moins cher de sculpter le chemin.",
    sellRefundPct: SELL_REFUND_PCT,
    upgradable: false,
    tiers: [WALL_TIER, WALL_TIER, WALL_TIER],
    t3Branches: [
      { id: 'A', name: '—', description: '—' },
      { id: 'B', name: '—', description: '—' },
    ],
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    description: 'Mono-cible, gros dégâts uniques — le contre du Golem blindé.',
    sellRefundPct: SELL_REFUND_PCT,
    tiers: [
      { cost: 50, damage: 8, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 2.0, range: 2.5, chainTargets: 1, targetsAir: true, targetsGround: true, armorPierce: 0 },
      { cost: 60, damage: 14, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 2.2, range: 2.8, chainTargets: 1, targetsAir: true, targetsGround: true, armorPierce: 0 },
      { cost: 90, damage: 22, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 2.5, range: 3.0, chainTargets: 1, targetsAir: true, targetsGround: true, armorPierce: 0 },
    ],
    t3Branches: [
      { id: 'A', name: 'Perce-armure', description: "Ignore l'armure des Golems.", armorPierceOverride: 999 },
      { id: 'B', name: 'Rafale', description: '+50% cadence, -20% dégâts.', fireRateMul: 1.5, damageMul: 0.8 },
    ],
  },
  mortar: {
    id: 'mortar',
    name: 'Mortier',
    description: 'Dégâts de zone au sol — le contre des Nuées. Ne touche pas les volants.',
    sellRefundPct: SELL_REFUND_PCT,
    tiers: [
      { cost: 90, damage: 20, splashRadius: 1.2, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 0.5, range: 3.0, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
      { cost: 80, damage: 30, splashRadius: 1.4, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 0.6, range: 3.2, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
      { cost: 110, damage: 42, splashRadius: 1.6, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 0.7, range: 3.4, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
    ],
    t3Branches: [
      { id: 'A', name: 'Nappe', description: '+rayon, applique une brûlure (DoT léger).', splashRadiusAdd: 0.4, dotPerSecondAdd: 3 },
      { id: 'B', name: 'Frappe lourde', description: '+80% dégâts, cadence -30%.', damageMul: 1.8, fireRateMul: 0.7 },
    ],
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla',
    description: 'Multi-cible en chaîne — seule tour anti-air native.',
    sellRefundPct: SELL_REFUND_PCT,
    tiers: [
      { cost: 80, damage: 6, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 1.5, range: 3.0, chainTargets: 3, targetsAir: true, targetsGround: true, armorPierce: 0 },
      { cost: 70, damage: 9, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 1.6, range: 3.2, chainTargets: 4, targetsAir: true, targetsGround: true, armorPierce: 0 },
      { cost: 100, damage: 13, splashRadius: 0, slowPct: 0, dotPerSecond: 0, fireRatePerSec: 1.8, range: 3.5, chainTargets: 5, targetsAir: true, targetsGround: true, armorPierce: 0 },
    ],
    t3Branches: [
      { id: 'A', name: 'Foudre', description: '+dégâts, priorité volants.', damageMul: 1.3, airPriority: true },
      { id: 'B', name: 'Surcharge', description: 'Applique un slow court à chaque touche.', slowPctAdd: 0.25 },
    ],
  },
  cryo: {
    id: 'cryo',
    name: 'Générateur Cryo',
    description: "Utilitaire de ralentissement — multiplie la valeur des autres tours, ne tue pas seul.",
    sellRefundPct: SELL_REFUND_PCT,
    tiers: [
      { cost: 70, damage: 0, splashRadius: 1.5, slowPct: 0.4, dotPerSecond: 0, fireRatePerSec: 1.0, range: 1.5, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
      { cost: 60, damage: 1, splashRadius: 1.8, slowPct: 0.5, dotPerSecond: 0, fireRatePerSec: 1.0, range: 1.8, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
      { cost: 90, damage: 2, splashRadius: 2.1, slowPct: 0.6, dotPerSecond: 0, fireRatePerSec: 1.0, range: 2.1, chainTargets: 1, targetsAir: false, targetsGround: true, armorPierce: 0 },
    ],
    t3Branches: [
      { id: 'A', name: 'Gel', description: 'Fige 0.5s les ennemis normaux périodiquement.', freezePulse: { duration: 0.5, interval: 4 } },
      { id: 'B', name: 'Champ étendu', description: '+rayon, +slow, aucun dégât.', splashRadiusAdd: 0.6, slowPctAdd: 0.15, damageMul: 0 },
    ],
  },
};

export const TOWER_LIST: TowerDef[] = Object.values(TOWERS);
