/** Global tunable economy/balance constants. Single source of truth for iteration during playtest. */
export const BALANCE = {
  startGoldDefault: 100,
  /** Base HP pool — no purchasable extra HP in this build. */
  baseLivesDefault: 100,
  baseLivesBoss: 60,
  waveBonusBase: 10,
  waveBonusPerWaveIndex: 2,
  earlyCallBonusPct: 0.25,
  sellRefundPct: 0.7,
  simHz: 30,
  /** Passive points earned per second at multiplier x1 — ticks constantly during a run. */
  scorePerSecondBase: 10,
  /** Each kill raises the multiplier, so points-per-second escalates as the run heats up. */
  scoreMultiplierPerKill: 0.1,
  /** Soft cap so the multiplier can't run away to absurd numbers over a long Survie run. */
  scoreMultiplierMax: 10,
} as const;

export function waveCompletionBonus(waveIndex: number): number {
  return BALANCE.waveBonusBase + waveIndex * BALANCE.waveBonusPerWaveIndex;
}

/** Bonus gold for calling the next wave early, scaled by the fraction of prep time remaining. */
export function earlyCallBonus(nextWaveBaseBonus: number, remainingFraction: number): number {
  return Math.round(nextWaveBaseBonus * BALANCE.earlyCallBonusPct * Math.max(0, Math.min(1, remainingFraction)));
}
