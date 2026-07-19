import { SELL_REFUND_PCT, STARTING_GOLD, WAVE_CLEAR_GOLD_BASE, WAVE_CLEAR_GOLD_PER_WAVE } from '../data/balance';
import type { SkillEffects } from '../data/classes';

export function startingGold(effects: SkillEffects): number {
  return Math.round(STARTING_GOLD * (1 + (effects.startingGoldPct ?? 0)));
}

export function towerCost(baseCost: number, effects: SkillEffects): number {
  return Math.max(1, Math.round(baseCost * (1 + (effects.towerCostPct ?? 0))));
}

export function sellRefund(totalInvested: number): number {
  return Math.floor(totalInvested * SELL_REFUND_PCT);
}

export function waveClearBonus(wave: number, effects: SkillEffects): number {
  const base = WAVE_CLEAR_GOLD_BASE + wave * WAVE_CLEAR_GOLD_PER_WAVE;
  return Math.round(base * (1 + (effects.waveClearGoldBonusPct ?? 0)));
}

export function killGold(baseGold: number, effects: SkillEffects): number {
  return baseGold + (effects.goldPerKillBonus ?? 0);
}
