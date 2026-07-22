import type { Rarity, UnitDef, UnitLevelStats } from '../sim/types';

export const DECK_MIN = 4;
export const DECK_MAX = 5;
export const META_MAX_LEVEL = 6;

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Commune', rare: 'Rare', epic: 'Épique' };
export const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2 };

const GOLD_BY_RARITY: Record<Rarity, number> = { common: 1, rare: 1.6, epic: 2.5 };
/** Duplicates + gold needed to go from `level` to `level+1`. */
const DUP_STEPS = [0, 2, 4, 8, 14, 22]; // index by target level-1 (level 1->2 uses DUP_STEPS[1])
const GOLD_STEPS = [0, 100, 250, 500, 1000, 2000];

export function upgradeCost(rarity: Rarity, currentLevel: number): { duplicates: number; gold: number } | null {
  if (currentLevel >= META_MAX_LEVEL) return null;
  const duplicates = DUP_STEPS[currentLevel] ?? DUP_STEPS[DUP_STEPS.length - 1];
  const gold = Math.round((GOLD_STEPS[currentLevel] ?? GOLD_STEPS[GOLD_STEPS.length - 1]) * GOLD_BY_RARITY[rarity]);
  return { duplicates, gold };
}

/** Persistent meta-level scaling applied to a unit's base tier stats at combat start. */
export function metaScale(level: number): { damageMult: number; rangeMult: number } {
  return { damageMult: 1 + 0.15 * (level - 1), rangeMult: 1 + 0.04 * (level - 1) };
}

/** Returns a copy of a UnitDef with its tier stats scaled by the given meta-level. */
export function scaleUnitDef(def: UnitDef, metaLevel: number): UnitDef {
  const { damageMult, rangeMult } = metaScale(metaLevel);
  const levels: UnitLevelStats[] = def.levels.map((s) => ({
    ...s,
    damage: Math.round(s.damage * damageMult),
    range: +(s.range * rangeMult).toFixed(3),
  }));
  return { ...def, levels };
}

export interface OwnedUnit {
  level: number;
  duplicates: number;
}

/** Owned at first launch, with spare duplicates so the player can try Amélioration immediately. */
export const STARTER_COLLECTION: Record<string, OwnedUnit> = {
  swordsman: { level: 1, duplicates: 6 },
  archer: { level: 1, duplicates: 4 },
  lancer: { level: 1, duplicates: 3 },
  scout: { level: 1, duplicates: 2 },
  catapult: { level: 1, duplicates: 2 },
  guardian: { level: 1, duplicates: 1 },
  gravity_well: { level: 1, duplicates: 2 },
};

export const STARTER_GOLD = 800;
export const STARTER_GEMS = 60;

/** Stars from remaining life fraction (3 = flawless, 2 = >50%, 1 = any win). */
export function starsFor(lifeRemaining: number, lifeStart: number): number {
  if (lifeRemaining >= lifeStart) return 3;
  if (lifeRemaining >= lifeStart * 0.5) return 2;
  return lifeRemaining > 0 ? 1 : 0;
}

/** Deterministic victory rewards (no RNG in the meta layer). */
export function computeRewards(
  nodeIndex: number,
  stars: number,
  deck: string[],
): { gold: number; gems: number; duplicates: Array<{ unitId: string; count: number }> } {
  const gold = 60 + nodeIndex * 20 + stars * 15;
  const gems = nodeIndex % 5 === 0 ? 5 : 0; // a small gem drop every 5th node
  const duplicates: Array<{ unitId: string; count: number }> = [];
  if (deck.length > 0) {
    duplicates.push({ unitId: deck[nodeIndex % deck.length], count: 1 + (stars >= 3 ? 1 : 0) });
    if (stars >= 2) duplicates.push({ unitId: deck[(nodeIndex + 1) % deck.length], count: 1 });
  }
  return { gold, gems, duplicates };
}
