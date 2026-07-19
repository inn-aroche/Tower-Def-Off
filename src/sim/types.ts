/** Pure domain types for the combat simulation. No DOM, no rendering. */

export type UnitFamily = 'melee' | 'ranged' | 'gravity';

/** Per-level stats for a unit. Index 0 = level 1. */
export interface UnitLevelStats {
  /** Damage per attack. Unused (0) for gravity-family units. */
  damage: number;
  /** Seconds between attacks. Unused (0) for gravity-family units. */
  attackIntervalSec: number;
  /** How many rows ahead (toward spawn) the unit can act, from its own row. */
  rangeRows: number;
  /** Gravity only: extra columns of influence to each side of the unit's column. */
  influenceCols: number;
  /** Gravity only: enemy speed multiplier while inside the influence field (e.g. 0.5 = -50%). */
  slowFactor: number;
}

export interface UnitDef {
  id: string;
  name: string;
  family: UnitFamily;
  /** Stats for level 1..maxLevel, index 0 = level 1. */
  levels: UnitLevelStats[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** Rows per second, before gravity slow effects. */
  speed: number;
  /** Life lost by the player base if this enemy reaches the bottom row. */
  damageToBase: number;
}

export interface WaveSpawnGroup {
  enemyId: string;
  count: number;
  /** Seconds between spawns within this group. */
  intervalSec: number;
  /** Seconds after wave start before this group begins spawning. */
  startDelaySec: number;
}

export interface WaveDef {
  spawnGroups: WaveSpawnGroup[];
  /** Seconds after the previous wave started before this wave starts (wave 0 starts at t=0). */
  startDelaySec: number;
}

export interface LevelDef {
  id: string;
  name: string;
  waves: WaveDef[];
  playerStartLife: number;
}

export interface EconomyConfig {
  gridCols: number;
  gridRows: number;
  manaMax: number;
  manaRegenPerSec: number;
  manaStartValue: number;
  summonBaseCost: number;
  summonCostGrowth: number;
  summonCostMax: number;
}

export interface PlacedUnit {
  unitId: string;
  level: number; // 1-based
  col: number;
  row: number;
  attackCooldownSec: number;
}

export interface LiveEnemy {
  instanceId: number;
  enemyId: string;
  col: number;
  /** Continuous row position: 0 = top spawn edge, gridRows = base breach. */
  rowPos: number;
  hp: number;
}

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat';

export interface CombatEvent {
  type: 'summon' | 'merge' | 'enemy-killed' | 'base-hit' | 'wave-cleared' | 'victory' | 'defeat';
  atSec: number;
  detail?: Record<string, unknown>;
}

export interface CombatSnapshot {
  elapsedSec: number;
  mana: number;
  life: number;
  outcome: CombatOutcome;
  units: PlacedUnit[];
  enemies: LiveEnemy[];
  summonCount: number;
  nextSummonCost: number;
  currentWaveIndex: number;
  totalWaves: number;
  kills: number;
}
