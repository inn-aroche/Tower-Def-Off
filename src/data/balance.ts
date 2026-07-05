/** Global tunable economy/balance constants. Single source of truth for iteration during playtest. */
export const BALANCE = {
  startGoldDefault: 100,
  baseLivesDefault: 20,
  baseLivesBoss: 10,
  waveBonusBase: 10,
  waveBonusPerWaveIndex: 2,
  earlyCallBonusPct: 0.25,
  sellRefundPct: 0.7,
  simHz: 30,
} as const;

export function waveCompletionBonus(waveIndex: number): number {
  return BALANCE.waveBonusBase + waveIndex * BALANCE.waveBonusPerWaveIndex;
}

/** Bonus gold for calling the next wave early, scaled by the fraction of prep time remaining. */
export function earlyCallBonus(nextWaveBaseBonus: number, remainingFraction: number): number {
  return Math.round(nextWaveBaseBonus * BALANCE.earlyCallBonusPct * Math.max(0, Math.min(1, remainingFraction)));
}
