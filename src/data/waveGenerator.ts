import type { WaveConfig } from '../sim/Wave';

/**
 * Pure function of an absolute wave index — deterministic and reproducible without needing
 * seeded RNG. Shared by Survival (which slices a long run of these) and the procedural campaign
 * levels 11+ (which each take a short slice at an offset tuned to their position in the
 * campaign), so both use the same tested difficulty curve instead of two divergent formulas.
 */
export function generateWave(index: number): WaveConfig {
  const n = index + 1; // 1-based wave number, easier to reason about in the formulas below
  const spawns: WaveConfig['spawns'] = [];

  const soldierCount = 4 + Math.floor(n * 0.8);
  spawns.push({ type: 'soldier', count: soldierCount, interval: Math.max(0.35, 0.9 - n * 0.01) });

  if (n % 3 === 0) {
    spawns.push({ type: 'swarm', count: 6 + Math.floor(n * 1.1), interval: Math.max(0.12, 0.3 - n * 0.002) });
  }
  if (n >= 4 && n % 4 === 0) {
    spawns.push({ type: 'golem', count: 1 + Math.floor(n / 8), interval: Math.max(1.2, 2.5 - n * 0.01) });
  }
  if (n >= 5 && n % 5 === 0) {
    spawns.push({ type: 'drone', count: 1 + Math.floor(n / 9), interval: Math.max(0.5, 1.3 - n * 0.008) });
  }
  if (n >= 7 && n % 6 === 0) {
    spawns.push({ type: 'kamikaze', count: 1 + Math.floor(n / 10), interval: Math.max(0.6, 1.2 - n * 0.006) });
  }
  if (n >= 15 && n % 15 === 0) {
    spawns.push({ type: 'boss', count: 1 + Math.floor(n / 30), interval: 2 });
  }

  const delay = Math.max(3, 8 - n * 0.04);
  return { delay, spawns };
}

let cachedWaves: WaveConfig[] | null = null;
/** Pre-generates and caches a long run of the curve — cheap since generateWave is pure arithmetic. */
export function waveCurve(length: number): WaveConfig[] {
  if (!cachedWaves || cachedWaves.length < length) {
    cachedWaves = Array.from({ length }, (_, i) => generateWave(i));
  }
  return cachedWaves.slice(0, length);
}
