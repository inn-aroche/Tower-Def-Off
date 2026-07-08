import type { LevelConfig } from './LevelConfig';
import { waveCurve } from './waveGenerator';
import { waveTotalEnemyCount } from '../sim/Wave';

const WAVES_PER_LEVEL = 4;
/** Where the procedural curve starts — roughly the difficulty a player reaches by Survie's
 * "Argent" tier, so N11 doesn't feel like starting over after N10's boss gauntlet. */
const CURVE_BASE_OFFSET = 20;
/** How far each level advances along the curve. Deliberately smaller than WAVES_PER_LEVEL —
 * advancing a full window's worth per level would put N50 at curve-index ~215 (far past even
 * Survie Or's wave-40 start); this keeps N50 in "meaningfully harder than Survie Or, not absurd"
 * territory (~curve-index 59). */
const CURVE_ADVANCE_PER_LEVEL = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deterministic zigzag maze: `wallCount` single-column walls, evenly spaced, each spanning 60% of
 * the grid's rows with the open 40% alternating between the top and bottom edge. Column-only
 * blocking with a fully-open gap band guarantees a path always exists — no need to special-case
 * spawn/exit rows or run a solver, the construction itself can't produce a dead end.
 */
function generateZigzagWalls(cols: number, rows: number, wallCount: number): Array<[number, number]> {
  const blocked: Array<[number, number]> = [];
  const wallSpan = Math.floor(rows * 0.7);
  for (let i = 0; i < wallCount; i++) {
    const col = Math.round(((i + 1) * cols) / (wallCount + 1));
    const gapAtTop = i % 2 === 0;
    const startRow = gapAtTop ? rows - wallSpan : 0;
    for (let r = 0; r < wallSpan; r++) blocked.push([col, startRow + r]);
  }
  return blocked;
}

/**
 * Pure function of level id (11-50, excluding hand-authored milestones) — same level id always
 * yields the same config, no RNG involved. Grid size, obstacle density and gold scale gently with
 * id; waves are a non-overlapping slice of the shared curve so difficulty climbs monotonically
 * across the whole procedural range instead of resetting per level.
 */
export function generateProceduralLevel(id: number): LevelConfig {
  // Capped at 15x10 (§ "les maps ne doivent pas faire plus de 10 case de largeur et 15 de
  // longueur") — board size stays fixed once reached; difficulty keeps climbing via the wave
  // curve and wall count instead of an ever-larger grid.
  const cols = clamp(13 + Math.floor(id / 12), 13, 15);
  const rows = clamp(8 + Math.floor(id / 15), 8, 10);
  const wallCount = clamp(2 + Math.floor(id / 10), 2, 5);
  const midRow = Math.floor(rows / 2);

  const curveStart = CURVE_BASE_OFFSET + (id - 11) * CURVE_ADVANCE_PER_LEVEL;
  const waves = waveCurve(curveStart + WAVES_PER_LEVEL).slice(curveStart);
  const totalEnemies = waves.reduce((sum, w) => sum + waveTotalEnemyCount(w), 0);

  const startGold = 180 + id * 10;

  return {
    id,
    name: `Niveau ${id}`,
    grid: {
      cols,
      rows,
      blocked: generateZigzagWalls(cols, rows, wallCount),
      spawns: [[0, midRow]],
      exits: [[cols - 1, midRow]],
    },
    startGold,
    baseHp: 100,
    allowedTowers: ['wall', 'laser', 'mortar', 'tesla', 'cryo'],
    waves,
    starGoals: {
      noLeak: true,
      maxTowers: Math.round((cols * rows) / 18),
      maxGoldSpent: Math.round(startGold + totalEnemies * 8),
    },
  };
}
