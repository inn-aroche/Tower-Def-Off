import type { EconomyConfig } from './types';

/** Mana cost of the Nth summon this run (0-indexed: summonCount already made before this one). */
export function summonCost(economy: EconomyConfig, summonCount: number): number {
  const raw = economy.summonBaseCost + economy.summonCostGrowth * summonCount;
  return Math.min(economy.summonCostMax, raw);
}

export function regenMana(current: number, economy: EconomyConfig, dtSec: number): number {
  return Math.min(economy.manaMax, current + economy.manaRegenPerSec * dtSec);
}
