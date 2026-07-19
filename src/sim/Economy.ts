import type { EconomyConfig } from './types';

export function regenMana(current: number, economy: EconomyConfig, dtSec: number): number {
  return Math.min(economy.manaMax, current + economy.manaRegenPerSec * dtSec);
}
