import type { EconomyConfig } from '../sim/types';

/** All balance numbers live here — never hardcode combat constants in sim/render.
 * M2 economy: continuous mana regen + fixed per-card cost (Clash-style), replacing M1's
 * growing global summon cost. Per-card costs live on each UnitDef in units.ts. */
export const ECONOMY: EconomyConfig = {
  gridCols: 6,
  gridRows: 8,
  manaMax: 10,
  manaRegenPerSec: 1.1,
  manaStartValue: 6,
};
