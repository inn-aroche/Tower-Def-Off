// Central tuning knobs. Keep every "magic number" here so design and the
// economy simulation (scripts/economy-sim.mjs) stay in sync with the real game.

export const GRID_COLS = 7;
export const GRID_ROWS = 12;

export const STARTING_GOLD = 150;
export const KEEP_BASE_MAX_HP = 100;
export const KEEP_REGEN_PER_WAVE_PCT = 0.05; // fraction of max HP healed between waves

export const SELL_REFUND_PCT = 0.8;

export const WAVE_CLEAR_GOLD_BASE = 20;
export const WAVE_CLEAR_GOLD_PER_WAVE = 3;

// Essence (persistent meta-currency) earned at the end of a run.
export function essenceEarned(wavesSurvived: number, bossKills: number): number {
  return Math.floor(wavesSurvived / 2) + bossKills * 2 + 1;
}

export const BOSS_WAVE_INTERVAL = 5;

export const SKILL_TIER_COSTS = [1, 2, 3, 5] as const; // essence cost for tiers 1..4 of a branch
export const FULL_CLASS_TREE_COST = SKILL_TIER_COSTS.reduce((a, b) => a + b, 0) * 3; // 3 branches
