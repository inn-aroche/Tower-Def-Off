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
  /** Optional signature effect that fires on top of a normal attack (or, for boost_aura, passively). */
  ability?: UnitAbility;
}

/**
 * Signature unit effects, all deterministic (geometry + timers, no RNG):
 *  - splash: the attack also damages other enemies within `radius` of the target
 *  - chain: the attack arcs to up to `jumps` other enemies within `range` of the target
 *  - slow_on_hit: the struck enemy is chilled (movement ×`slowFactor`) for `durationSec`
 *  - boost_aura: passive — friendly damage-units within `radius` deal +`damageBonus` fraction
 */
export type UnitAbility =
  | { kind: 'splash'; radius: number; damageFactor: number }
  | { kind: 'chain'; jumps: number; range: number; damageFactor: number }
  | { kind: 'slow_on_hit'; slowFactor: number; durationSec: number }
  | { kind: 'boost_aura'; radius: number; damageBonus: number };

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
  /** Absolute elapsedSec until which this enemy is chilled (frost slow_on_hit). */
  chilledUntilSec: number;
  /** Movement multiplier applied while chilled (1 = none). */
  chillFactor: number;
}

/** A hero's signature power, cast periodically while it is deployed. Deterministic (no RNG). */
export type HeroPower =
  | { kind: 'nova'; periodSec: number; radius: number; damage: number }
  | { kind: 'frost_nova'; periodSec: number; radius: number; slowFactor: number; durationSec: number }
  | { kind: 'rally'; periodSec: number; radius: number; healBase: number };

/** Combat-time configuration of the active hero (built from meta level in AppState). */
export interface HeroConfig {
  name: string;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  range: number;
  /** Seconds for the energy bar to fill from empty to ready. */
  rechargeSec: number;
  /** How long the hero stays on the field once deployed. */
  durationSec: number;
  power: HeroPower;
}

/** Read-only hero state for the render/HUD layer. */
export interface HeroSnapshot {
  configured: boolean;
  deployed: boolean;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  /** 0..1 energy toward the next deployment. */
  energy: number;
  ready: boolean;
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
  /** Survival mode: waves are generated forever and the only end state is defeat. */
  endless: boolean;
  /** Active hero state (configured=false when this combat has no hero). */
  hero: HeroSnapshot;
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
  | { type: 'spawn'; x: number; y: number; boss: boolean }
  | { type: 'heroDeploy'; col: number; row: number }
  | { type: 'heroPower'; col: number; row: number; radius: number }
  | { type: 'heroDeath'; col: number; row: number };
