import { describe, expect, it } from 'vitest';
import { killGold, sellRefund, startingGold, towerCost, waveClearBonus } from '../src/sim/Economy';
import { STARTING_GOLD, WAVE_CLEAR_GOLD_BASE, WAVE_CLEAR_GOLD_PER_WAVE, SELL_REFUND_PCT } from '../src/data/balance';

describe('Economy', () => {
  it('starting gold is unaffected with no skill effects', () => {
    expect(startingGold({})).toBe(STARTING_GOLD);
  });

  it('starting gold bonus applies percentage from skill tree', () => {
    expect(startingGold({ startingGoldPct: 0.15 })).toBe(Math.round(STARTING_GOLD * 1.15));
  });

  it('tower cost discount stacks additively and rounds', () => {
    expect(towerCost(100, { towerCostPct: -0.2 })).toBe(80);
  });

  it('tower cost never drops to zero or below', () => {
    expect(towerCost(1, { towerCostPct: -5 })).toBeGreaterThanOrEqual(1);
  });

  it('sell refund is a fixed percentage of total invested, floored', () => {
    expect(sellRefund(100)).toBe(Math.floor(100 * SELL_REFUND_PCT));
    expect(sellRefund(53)).toBe(Math.floor(53 * SELL_REFUND_PCT));
  });

  it('wave clear bonus grows with wave number', () => {
    const w1 = waveClearBonus(1, {});
    const w5 = waveClearBonus(5, {});
    expect(w1).toBe(WAVE_CLEAR_GOLD_BASE + WAVE_CLEAR_GOLD_PER_WAVE);
    expect(w5).toBeGreaterThan(w1);
  });

  it('wave clear bonus skill node adds a percentage on top', () => {
    const base = waveClearBonus(3, {});
    const boosted = waveClearBonus(3, { waveClearGoldBonusPct: 0.5 });
    expect(boosted).toBe(Math.round(base * 1.5));
  });

  it('kill gold adds the Ranger flat gold-per-kill bonus', () => {
    expect(killGold(3, {})).toBe(3);
    expect(killGold(3, { goldPerKillBonus: 1 })).toBe(4);
  });
});
