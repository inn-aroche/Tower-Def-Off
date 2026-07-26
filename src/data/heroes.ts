import type { HeroConfig, HeroPower, Rarity } from '../sim/types';

/**
 * Heroes — deployable champions with HP + a signature power. All balance lives here. A hero is
 * summoned onto the board once its energy bar fills; it fights, casts its power on a period, takes
 * contact damage from nearby enemies, and leaves on timeout or death (then the bar recharges).
 */
export interface HeroDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** One-line French description of the signature power. */
  powerText: string;
  base: {
    maxHp: number;
    damage: number;
    attackIntervalSec: number;
    range: number;
    rechargeSec: number;
    durationSec: number;
  };
  power: HeroPower;
}

export const HEROES: HeroDef[] = [
  {
    id: 'pyromancer',
    name: 'Pyromancien',
    rarity: 'rare',
    powerText: 'Nova de feu : explosion de zone périodique.',
    base: { maxHp: 120, damage: 20, attackIntervalSec: 0.7, range: 2.6, rechargeSec: 22, durationSec: 12 },
    power: { kind: 'nova', periodSec: 2.5, radius: 1.8, damage: 30 },
  },
  {
    id: 'frost_king',
    name: 'Roi de givre',
    rarity: 'epic',
    powerText: 'Nova de givre : gèle et ralentit les ennemis proches.',
    base: { maxHp: 150, damage: 12, attackIntervalSec: 0.8, range: 2.3, rechargeSec: 24, durationSec: 12 },
    power: { kind: 'frost_nova', periodSec: 3, radius: 2.2, slowFactor: 0.5, durationSec: 2 },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    rarity: 'epic',
    powerText: 'Cri de ralliement : soigne la base et encaisse.',
    base: { maxHp: 230, damage: 14, attackIntervalSec: 0.8, range: 1.9, rechargeSec: 26, durationSec: 14 },
    power: { kind: 'rally', periodSec: 4, radius: 0, healBase: 1 },
  },
];

export const HEROES_BY_ID = new Map(HEROES.map((h) => [h.id, h]));

/** The starter hero owned from first launch. */
export const STARTER_HERO = 'pyromancer';
export const HERO_MAX_LEVEL = 6;

/** Cards required to promote a hero from `level` to `level+1` (index by currentLevel), or null at max. */
const HERO_CARD_STEPS = [0, 2, 4, 8, 15, 25];
const HERO_GOLD_STEPS = [0, 300, 600, 1200, 2400, 4000];

export function heroPromoteCost(currentLevel: number): { cards: number; gold: number } | null {
  if (currentLevel >= HERO_MAX_LEVEL) return null;
  return { cards: HERO_CARD_STEPS[currentLevel] ?? 25, gold: HERO_GOLD_STEPS[currentLevel] ?? 4000 };
}

/** Builds the combat HeroConfig for a hero at a given meta-level (HP + damage scale ~12%/level). */
export function scaleHeroConfig(def: HeroDef, level: number): HeroConfig {
  const mult = Math.pow(1.12, level - 1);
  const power: HeroPower =
    def.power.kind === 'nova'
      ? { ...def.power, damage: Math.round(def.power.damage * mult) }
      : def.power; // frost/rally scale via HP/uptime, not raw damage
  return {
    name: def.name,
    maxHp: Math.round(def.base.maxHp * mult),
    damage: Math.round(def.base.damage * mult),
    attackIntervalSec: def.base.attackIntervalSec,
    range: def.base.range,
    rechargeSec: def.base.rechargeSec,
    durationSec: def.base.durationSec,
    power,
  };
}
