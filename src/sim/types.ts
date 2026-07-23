/** Pure domain types for the combat simulation. No DOM, no rendering. */

export type UnitFamily = 'melee' | 'ranged' | 'gravity';

export type Rarity = 'common' | 'rare' | 'epic';

export interface Cell {
  col: number;
  row: number;
}

/** Per-level stats for a unit. Index 0 = level 1. */
export interface UnitLevelStats {
  /** Damage per attack. 0 for gravity-family units. */
  damage: number;
  /** Seconds between attacks. 0 for gravity-family units. */
  attackIntervalSec: number;
  /** Radius of effect in cells (Euclidean), measured cell-center to cell-center.
   * Damage units attack enemies within it; gravity units slow enemies within it. */
  range: number;
  /** Enemy speed multiplier while inside a gravity field (e.g. 0.5 = -50%). 1 for damage units. */
  slowFactor: number;
}

export interface UnitDef {
  id: string;
  name: string;
  family: UnitFamily;
  rarity: Rarity;
  /** Fixed mana cost to summon this unit (Clash-style economy, per the M2 card-choice model). */
  cost: number;
  /** Board-merge tiers 1..maxLevel (index 0 = tier 1). Scaled by the unit's meta-level at combat start. */
  levels: UnitLevelStats[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** Cells per second travelled along the path, before gravity slow effects. */
  speed: number;
  /** Life lost by the player base if this enemy reaches the end of the path. */
  damageToBase: number;
  /** Flyers cut straight from spawn to base (ignoring the winding path) and ignore gravity. */
  flying?: boolean;
  /** Flat damage reduction per hit (a hit always deals at least 1). */
  armor?: number;
  /** HP regenerated per second, up to the enemy's max HP. */
  regenPerSec?: number;
  /** Bosses render larger with a prominent HP bar. */
  boss?: boolean;
  /** Optional special behaviour (bosses and elites). */
  ability?: EnemyAbility;
  /** Saboteurs "explode" on death, stunning player units in radius (cells). */
  stunOnDeath?: { radius: number; stunSec: number };
}

export type EnemyAbility =
  | { kind: 'heal_aura'; radius: number; healPerSec: number }
  | { kind: 'shield'; periodSec: number; durationSec: number }
  | { kind: 'summon'; periodSec: number; enemyId: string; count: number }
  | { kind: 'stun_units'; periodSec: number; radius: number; stunSec: number };

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
  /** Ordered, 4-connected waypoints from spawn (index 0, top) to base (last index). Enemies
   * follow it; units may only be placed on non-path cells. */
  path: Cell[];
}

export interface EconomyConfig {
  gridCols: number;
  gridRows: number;
  manaMax: number;
  manaRegenPerSec: number;
  manaStartValue: number;
}

export interface PlacedUnit {
  unitId: string;
  level: number; // 1-based
  col: number;
  row: number;
  attackCooldownSec: number;
  /** Absolute elapsedSec until which this unit is stunned (can't attack). */
  stunnedUntilSec?: number;
}

export interface LiveEnemy {
  instanceId: number;
  enemyId: string;
  /** Position along the path, in waypoint units (0 = spawn, path.length-1 = base). */
  pathProgress: number;
  /** Cached cell-center coordinates derived from pathProgress each step (x = col+0.5, y = row+0.5). */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Absolute elapsedSec until which incoming damage is blocked (boss shield). */
  shieldedUntilSec: number;
  /** Accumulates for periodic abilities. */
  abilityTimerSec: number;
}

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat';

/** A card in the player's hand this combat — one per deck entry, in fixed order. */
export interface HandCard {
  unitId: string;
  name: string;
  family: UnitFamily;
  cost: number;
  affordable: boolean;
}

export interface CombatSnapshot {
  elapsedSec: number;
  mana: number;
  life: number;
  outcome: CombatOutcome;
  units: PlacedUnit[];
  enemies: LiveEnemy[];
  hand: HandCard[];
  currentWaveIndex: number;
  totalWaves: number;
  kills: number;
}

/**
 * Transient, pure-data signals the sim emits so the render layer can play feedback (numbers,
 * particles, shake, haptics) without the sim ever touching the DOM. Coordinates are in cell-centre
 * units (x = col+0.5), matching LiveEnemy.x/y. Drained once per frame via CombatSim.consumeEvents.
 */
export type CombatEvent =
  | { type: 'attack'; fromCol: number; fromRow: number; toX: number; toY: number; family: UnitFamily }
  | { type: 'damage'; enemyInstanceId: number; x: number; y: number; amount: number }
  | { type: 'kill'; x: number; y: number; enemyId: string }
  | { type: 'merge'; col: number; row: number; newLevel: number }
  | { type: 'summon'; col: number; row: number; family: UnitFamily }
  | { type: 'baseHit'; amount: number }
  | { type: 'stun'; col: number; row: number }
  | { type: 'spawn'; x: number; y: number; boss: boolean };
