import { BOSS_WAVE_INTERVAL } from './balance';
import type { EnemyKind } from './enemies';
import { ENEMIES } from './enemies';

export interface SpawnEntry {
  kind: EnemyKind;
  delay: number; // seconds after wave start
}

export interface WavePlan {
  wave: number;
  isBossWave: boolean;
  spawns: SpawnEntry[];
}

const SPAWN_INTERVAL = 0.55; // seconds between individual spawns

export function generateWave(wave: number): WavePlan {
  const isBossWave = wave % BOSS_WAVE_INTERVAL === 0;
  const totalMinions = Math.round((6 + wave * 1.2) * (isBossWave ? 0.5 : 1));

  const unlocked: EnemyKind[] = (['grunt', 'speedster', 'brute'] as EnemyKind[]).filter(
    (k) => wave >= ENEMIES[k].minWave,
  );
  const weights: Record<string, number> = { grunt: 0.5, speedster: 0.3, brute: 0.2 };
  const totalWeight = unlocked.reduce((s, k) => s + weights[k], 0);

  const counts: Partial<Record<EnemyKind, number>> = {};
  let assigned = 0;
  for (const k of unlocked) {
    const c = Math.round((weights[k] / totalWeight) * totalMinions);
    counts[k] = c;
    assigned += c;
  }
  // Reconcile rounding drift onto the first unlocked kind (always 'grunt').
  const drift = totalMinions - assigned;
  if (unlocked.length > 0) counts[unlocked[0]] = (counts[unlocked[0]] ?? 0) + drift;

  // Interleave kinds round-robin so the wave reads as a mixed group, not clumped blocks.
  const queue: EnemyKind[] = [];
  const remaining = { ...counts };
  while (unlocked.some((k) => (remaining[k] ?? 0) > 0)) {
    for (const k of unlocked) {
      if ((remaining[k] ?? 0) > 0) {
        queue.push(k);
        remaining[k] = (remaining[k] ?? 0) - 1;
      }
    }
  }

  const spawns: SpawnEntry[] = queue.map((kind, i) => ({ kind, delay: i * SPAWN_INTERVAL }));
  if (isBossWave) {
    spawns.push({ kind: 'boss', delay: spawns.length * SPAWN_INTERVAL + 1 });
  }

  return { wave, isBossWave, spawns };
}
