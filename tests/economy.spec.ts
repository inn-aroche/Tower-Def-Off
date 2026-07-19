import { describe, expect, it } from 'vitest';
import { regenMana } from '../src/sim/Economy';
import type { EconomyConfig } from '../src/sim/types';

const ECONOMY: EconomyConfig = {
  gridCols: 6,
  gridRows: 8,
  manaMax: 10,
  manaRegenPerSec: 1,
  manaStartValue: 6,
};

describe('Economy', () => {
  it('regenMana adds mana over time and clamps at manaMax', () => {
    expect(regenMana(5, ECONOMY, 2)).toBe(7);
    expect(regenMana(9, ECONOMY, 5)).toBe(10);
    expect(regenMana(10, ECONOMY, 1)).toBe(10);
  });
});
