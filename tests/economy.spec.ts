import { describe, expect, it } from 'vitest';
import { regenMana, summonCost } from '../src/sim/Economy';
import type { EconomyConfig } from '../src/sim/types';

const ECONOMY: EconomyConfig = {
  gridCols: 6,
  gridRows: 8,
  manaMax: 10,
  manaRegenPerSec: 1,
  manaStartValue: 5,
  summonBaseCost: 3,
  summonCostGrowth: 1,
  summonCostMax: 9,
};

describe('Economy', () => {
  it('summon cost grows with each summon and caps at summonCostMax', () => {
    expect(summonCost(ECONOMY, 0)).toBe(3);
    expect(summonCost(ECONOMY, 1)).toBe(4);
    expect(summonCost(ECONOMY, 5)).toBe(8);
    expect(summonCost(ECONOMY, 6)).toBe(9);
    expect(summonCost(ECONOMY, 100)).toBe(9);
  });

  it('regenMana adds mana over time and clamps at manaMax', () => {
    expect(regenMana(5, ECONOMY, 2)).toBe(7);
    expect(regenMana(9, ECONOMY, 5)).toBe(10);
    expect(regenMana(10, ECONOMY, 1)).toBe(10);
  });
});
