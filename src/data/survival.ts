import type { WaveDef, WaveSpawnGroup } from '../sim/types';

/**
 * Endless "Survie" mode — deterministic, escalating waves that never stop until the base falls.
 * ALL survival balancing lives here (per the architecture rule). No RNG: the wave for a given index
 * is a pure function, so the headless survival sim (`npm run simulate:survival`) is trustworthy and
 * two runs of the same skill always match.
 *
 * Design intent:
 *  - a gentle on-ramp (waves 0–1 are pure fodder) so the mode teaches itself,
 *  - new bestiary threats fold in on a schedule (runner→brute→flyer→saboteur→juggernaut→ogre→troll),
 *  - a boss every 5th wave, cycling the four bosses and doubling up in the deep end,
 *  - counts and HP creep upward so a run always ends — the question is only *which* wave.
 */

/** Seconds of breathing room inserted between the last spawn of a wave and the start of the next. */
export const SURVIVAL_WAVE_GAP_SEC = 5.5;
/** Base life for a survival run (a touch more than a campaign node — you're meant to go deep). */
export const SURVIVAL_START_LIFE = 20;
/** Survie has NO emplacements cap on purpose: the mode's skill expression is precisely how fast
 * you fill and merge a big board (the headless sim shows a hard cap flattens the depth ramp to a
 * single value for every skill level). Campaign and PvP carry the cap instead. */

/** Per-enemy HP multiplier for a given wave. Compounds exponentially so that — however good the
 * defense — an unbeatable wall always arrives; the only question is which wave you reach.
 * Gentle early (wave 5 ≈ ×1.4, wave 10 ≈ ×2.0) then unforgiving (wave 25 ≈ ×5.4, wave 35 ≈ ×10.7). */
export function survivalHpMult(waveIndex: number): number {
  return +Math.pow(1.075, waveIndex).toFixed(3);
}

const BOSS_CYCLE = ['warlord', 'necromancer', 'high_priestess', 'stone_colossus'];

/** Pure wave generator. `waveIndex` is 0-based. */
export function survivalWave(waveIndex: number): WaveDef {
  const n = waveIndex;
  const groups: WaveSpawnGroup[] = [];
  const isBoss = n > 0 && n % 5 === 0;

  if (isBoss) {
    const boss = BOSS_CYCLE[(Math.floor(n / 5) - 1) % BOSS_CYCLE.length];
    // A second boss joins from wave 20 (index), then a third from 40 — genuine deep-end pressure.
    groups.push({ enemyId: boss, count: 1 + Math.floor(n / 20), intervalSec: 3, startDelaySec: 0 });
  }

  // Core fodder — always present, scales with depth, and speeds up its cadence a little.
  groups.push({
    enemyId: 'goblin',
    count: 4 + Math.floor(n * 0.8),
    intervalSec: Math.max(0.35, 1.1 - n * 0.02),
    startDelaySec: isBoss ? 4 : 0,
  });

  if (n >= 2) groups.push({ enemyId: 'runner', count: 2 + Math.floor(n / 3), intervalSec: 0.6, startDelaySec: 1.5 });
  if (n >= 4) groups.push({ enemyId: 'brute', count: 1 + Math.floor(n / 5), intervalSec: 1.3, startDelaySec: 2 });
  if (n >= 6 && n % 2 === 0) groups.push({ enemyId: 'wraith', count: 1 + Math.floor(n / 8), intervalSec: 1.1, startDelaySec: 2.5 });
  if (n >= 8 && n % 3 === 0) groups.push({ enemyId: 'saboteur', count: 1 + Math.floor(n / 10), intervalSec: 1.4, startDelaySec: 3 });
  if (n >= 10 && n % 2 === 1) groups.push({ enemyId: 'juggernaut', count: 1 + Math.floor(n / 12), intervalSec: 1.7, startDelaySec: 3 });
  if (n >= 12 && n % 4 === 0) groups.push({ enemyId: 'ogre', count: 1 + Math.floor(n / 14), intervalSec: 1.7, startDelaySec: 3.5 });
  if (n >= 14 && n % 5 === 2) groups.push({ enemyId: 'troll', count: 1, intervalSec: 2, startDelaySec: 4 });

  // Per-wave startDelay is 0: the sim schedules each wave at an absolute time (gap handled there).
  return { startDelaySec: 0, spawnGroups: groups };
}

/** Gold/gems earned for reaching a given wave (honest, generous, no dark patterns). */
export function survivalRewards(wavesReached: number): { gold: number; gems: number } {
  return { gold: wavesReached * 12, gems: Math.floor(wavesReached / 5) };
}
