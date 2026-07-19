import type { EconomyConfig } from '../sim/types';

/** All balance numbers live here — never hardcode combat constants in sim/render. */
export const ECONOMY: EconomyConfig = {
  gridCols: 6,
  gridRows: 8,
  manaMax: 10,
  manaRegenPerSec: 1.2, // full gauge from empty in ~8.3s
  manaStartValue: 7,
  summonBaseCost: 2,
  summonCostGrowth: 0.75,
  summonCostMax: 7,
};
