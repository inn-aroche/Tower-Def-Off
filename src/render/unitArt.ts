import { UNITS } from '../data/units';
import { UNIT_SPRITES } from './sprites';
import type { Rarity, UnitFamily } from '../sim/types';

/**
 * Single source of truth for "which illustration belongs to this unit".
 *
 * Only the hand-cut core units own a sprite; the 85 generated roster units don't. Rather than
 * showing them as abstract pictograms (which made the Collection look unfinished next to the
 * battle board), every unit is mapped — deterministically, by id — onto a sprite of the same
 * family, preferring one of the same rarity. The board renderer and the meta screens both call
 * this, so a unit looks the same in the Collection, in the deck, in a chest and in combat.
 *
 * Offensive units are excluded from the fallback pool: their art is part of what distinguishes
 * them, so a defensive unit must never borrow it.
 */

const byFamily = new Map<UnitFamily, string[]>();
const byFamilyRarity = new Map<string, string[]>();

for (const def of UNITS) {
  if (!UNIT_SPRITES[def.id] || def.role === 'offense') continue;
  const fam = byFamily.get(def.family) ?? [];
  fam.push(def.id);
  byFamily.set(def.family, fam);
  const key = `${def.family}:${def.rarity}`;
  const fr = byFamilyRarity.get(key) ?? [];
  fr.push(def.id);
  byFamilyRarity.set(key, fr);
}
for (const list of byFamily.values()) list.sort();
for (const list of byFamilyRarity.values()) list.sort();

/** FNV-1a — a stable id→index hash (no ambient randomness, same result in sim, tests and browser). */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The sprite key to draw for a unit, or null when its family has no art at all. */
export function unitArtId(unitId: string, family: UnitFamily, rarity?: Rarity): string | null {
  if (UNIT_SPRITES[unitId]) return unitId;
  const pool = (rarity && byFamilyRarity.get(`${family}:${rarity}`)) || byFamily.get(family);
  if (!pool || pool.length === 0) return null;
  return pool[hash(unitId) % pool.length];
}

/** The data-URI illustration for a unit, ready for an `<img src>` or an `Image()`. */
export function unitArtUri(unitId: string, family: UnitFamily, rarity?: Rarity): string | null {
  const id = unitArtId(unitId, family, rarity);
  return id ? UNIT_SPRITES[id] ?? null : null;
}
