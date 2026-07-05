import type { WaveConfig } from './Wave';
import type { EnemyType } from '../data/enemies';

export type SchedulerPhase = 'build' | 'spawning' | 'awaiting-clear' | 'complete';

interface SpawnCursor {
  groupIndex: number;
  spawnedInGroup: number;
  timeSinceLastSpawn: number;
}

/** Fallback build-phase length when a wave's own `delay` is unset. */
const DEFAULT_BUILD_PHASE_SECONDS = 15;

/**
 * Drives wave timing: build-phase countdown (with early-call support), then spaced spawns
 * within the current wave. Does not own Enemy instances — callers spawn via the onSpawn hook
 * and separately track when the wave's enemies are all dead/leaked to advance to the next wave.
 */
export class WaveScheduler {
  phase: SchedulerPhase = 'build';
  waveIndex = 0;
  buildTimeRemaining: number;
  private buildPhaseDuration: number;
  private cursor: SpawnCursor = { groupIndex: 0, spawnedInGroup: 0, timeSinceLastSpawn: 0 };
  private spawnRoundRobin = 0;

  constructor(private readonly waves: WaveConfig[]) {
    this.buildPhaseDuration = this.waves[0]?.delay ?? DEFAULT_BUILD_PHASE_SECONDS;
    this.buildTimeRemaining = this.buildPhaseDuration;
  }

  get currentWave(): WaveConfig | null {
    return this.waves[this.waveIndex] ?? null;
  }

  get isLastWave(): boolean {
    return this.waveIndex >= this.waves.length - 1;
  }

  /** Player-triggered early launch; returns the fraction of build time that was remaining (for bonus calc). */
  callEarly(): number {
    if (this.phase !== 'build') return 0;
    const fraction = this.buildTimeRemaining / this.buildPhaseDuration;
    this.startSpawning();
    return fraction;
  }

  private startSpawning(): void {
    this.phase = 'spawning';
    this.cursor = { groupIndex: 0, spawnedInGroup: 0, timeSinceLastSpawn: 0 };
  }

  /** Call once per sim tick. Emits enemy types to spawn (caller places them via spawnPoints round-robin). */
  update(dt: number, spawnPointCount: number, onSpawn: (type: EnemyType, spawnIndex: number) => void): void {
    if (this.phase === 'build') {
      this.buildTimeRemaining -= dt;
      if (this.buildTimeRemaining <= 0) this.startSpawning();
      return;
    }

    if (this.phase !== 'spawning') return;
    const wave = this.currentWave;
    if (!wave) {
      this.phase = 'complete';
      return;
    }

    this.cursor.timeSinceLastSpawn += dt;
    const group = wave.spawns[this.cursor.groupIndex];
    if (!group) {
      this.phase = 'awaiting-clear';
      return;
    }

    if (this.cursor.spawnedInGroup === 0 || this.cursor.timeSinceLastSpawn >= group.interval) {
      this.cursor.timeSinceLastSpawn = 0;
      onSpawn(group.type, this.spawnRoundRobin % Math.max(1, spawnPointCount));
      this.spawnRoundRobin++;
      this.cursor.spawnedInGroup++;
      if (this.cursor.spawnedInGroup >= group.count) {
        this.cursor.groupIndex++;
        this.cursor.spawnedInGroup = 0;
      }
    }
  }

  /** Called by GameState once all of this wave's enemies are dead/leaked. */
  advanceToNextWave(): void {
    this.waveIndex++;
    this.buildPhaseDuration = this.waves[this.waveIndex]?.delay ?? DEFAULT_BUILD_PHASE_SECONDS;
    this.buildTimeRemaining = this.buildPhaseDuration;
    this.phase = this.waveIndex < this.waves.length ? 'build' : 'complete';
  }
}
