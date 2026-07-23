import type { CombatEvent, EnemyDef, LiveEnemy, PlacedUnit, UnitDef } from './types';

export interface CombatDeps {
  unitDefs: Map<string, UnitDef>;
  enemyDefs: Map<string, EnemyDef>;
}

function levelStats(deps: CombatDeps, unit: PlacedUnit) {
  const def = deps.unitDefs.get(unit.unitId);
  if (!def) throw new Error(`Unknown unit id: ${unit.unitId}`);
  const stats = def.levels[unit.level - 1];
  if (!stats) throw new Error(`Unit ${unit.unitId} has no stats for level ${unit.level}`);
  return { def, stats };
}

/** Euclidean distance in cell units between a placed unit's centre and an enemy's cached centre. */
function distance(unit: PlacedUnit, enemy: LiveEnemy): number {
  const dx = unit.col + 0.5 - enemy.x;
  const dy = unit.row + 0.5 - enemy.y;
  return Math.hypot(dx, dy);
}

/** Effective speed multiplier for an enemy this tick, from all gravity fields touching it. Strongest slow wins (no stacking). */
export function gravitySlowFactor(deps: CombatDeps, enemy: LiveEnemy, units: PlacedUnit[]): number {
  let factor = 1;
  for (const unit of units) {
    const { def, stats } = levelStats(deps, unit);
    if (def.family !== 'gravity') continue;
    if (distance(unit, enemy) <= stats.range) factor = Math.min(factor, stats.slowFactor);
  }
  return factor;
}

/** Picks the most advanced (largest pathProgress) enemy within range for a damage-family unit, or undefined. */
function findTarget(deps: CombatDeps, unit: PlacedUnit, enemies: LiveEnemy[]): LiveEnemy | undefined {
  const { stats } = levelStats(deps, unit);
  let best: LiveEnemy | undefined;
  for (const enemy of enemies) {
    if (distance(unit, enemy) > stats.range) continue;
    if (!best || enemy.pathProgress > best.pathProgress) best = enemy;
  }
  return best;
}

export interface AttackResult {
  killedEnemyInstanceIds: number[];
  events: CombatEvent[];
}

/** Advances attack cooldowns and resolves damage for all damage-family units. Mutates unit cooldowns and enemy hp in place. */
export function resolveAttacks(
  deps: CombatDeps,
  units: PlacedUnit[],
  enemies: LiveEnemy[],
  dtSec: number,
): AttackResult {
  const killed: number[] = [];
  const events: CombatEvent[] = [];
  for (const unit of units) {
    const { def, stats } = levelStats(deps, unit);
    if (def.family === 'gravity') continue;
    unit.attackCooldownSec = Math.max(0, unit.attackCooldownSec - dtSec);
    if (unit.attackCooldownSec > 0) continue;
    const target = findTarget(deps, unit, enemies);
    if (!target) continue;
    target.hp -= stats.damage;
    unit.attackCooldownSec = stats.attackIntervalSec;
    events.push({ type: 'attack', fromCol: unit.col, fromRow: unit.row, toX: target.x, toY: target.y, family: def.family });
    events.push({ type: 'damage', enemyInstanceId: target.instanceId, x: target.x, y: target.y, amount: stats.damage });
    if (target.hp <= 0) killed.push(target.instanceId);
  }
  return { killedEnemyInstanceIds: killed, events };
}
