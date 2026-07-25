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

/** Picks the most advanced (largest pathProgress) targetable enemy within range, or undefined.
 * Shielded enemies are skipped (they can't be damaged right now). */
function findTarget(deps: CombatDeps, unit: PlacedUnit, enemies: LiveEnemy[], elapsedSec: number): LiveEnemy | undefined {
  const { stats } = levelStats(deps, unit);
  let best: LiveEnemy | undefined;
  for (const enemy of enemies) {
    if (enemy.shieldedUntilSec > elapsedSec) continue;
    if (distance(unit, enemy) > stats.range) continue;
    if (!best || enemy.pathProgress > best.pathProgress) best = enemy;
  }
  return best;
}

export interface AttackResult {
  killedEnemyInstanceIds: number[];
  events: CombatEvent[];
}

/** Passive damage multiplier for a unit from all `boost_aura` allies whose radius covers it. */
function boostMultiplier(deps: CombatDeps, unit: PlacedUnit, units: PlacedUnit[]): number {
  let bonus = 0;
  for (const other of units) {
    if (other === unit) continue;
    const ability = deps.unitDefs.get(other.unitId)?.ability;
    if (ability?.kind !== 'boost_aura') continue;
    const dx = other.col - unit.col;
    const dy = other.row - unit.row;
    if (Math.hypot(dx, dy) <= ability.radius) bonus += ability.damageBonus;
  }
  return 1 + bonus;
}

/** Applies damage to an enemy (armor-reduced, min 1), records the event, and flags kills. */
function damageEnemy(deps: CombatDeps, target: LiveEnemy, amount: number, events: CombatEvent[], killed: number[]): void {
  const armor = deps.enemyDefs.get(target.enemyId)?.armor ?? 0;
  const dealt = Math.max(1, Math.round(amount) - armor);
  target.hp -= dealt;
  events.push({ type: 'damage', enemyInstanceId: target.instanceId, x: target.x, y: target.y, amount: dealt });
  if (target.hp <= 0 && !killed.includes(target.instanceId)) killed.push(target.instanceId);
}

/** Advances attack cooldowns and resolves damage for all damage-family units. Mutates unit cooldowns and enemy hp in place. */
export function resolveAttacks(
  deps: CombatDeps,
  units: PlacedUnit[],
  enemies: LiveEnemy[],
  dtSec: number,
  elapsedSec: number,
): AttackResult {
  const killed: number[] = [];
  const events: CombatEvent[] = [];
  for (const unit of units) {
    const { def, stats } = levelStats(deps, unit);
    if (def.family === 'gravity') continue;
    if (unit.stunnedUntilSec !== undefined && unit.stunnedUntilSec > elapsedSec) continue;
    unit.attackCooldownSec = Math.max(0, unit.attackCooldownSec - dtSec);
    if (unit.attackCooldownSec > 0) continue;
    const target = findTarget(deps, unit, enemies, elapsedSec);
    if (!target) continue;
    unit.attackCooldownSec = stats.attackIntervalSec;
    const dmg = stats.damage * boostMultiplier(deps, unit, units);
    events.push({ type: 'attack', fromCol: unit.col, fromRow: unit.row, toX: target.x, toY: target.y, family: def.family });
    damageEnemy(deps, target, dmg, events, killed);
    applyOnHit(deps, def.ability, target, enemies, dmg, elapsedSec, events, killed);
  }
  return { killedEnemyInstanceIds: killed, events };
}

/** Secondary effects that fire when a unit's attack lands on `target`. */
function applyOnHit(
  deps: CombatDeps,
  ability: UnitDef['ability'],
  target: LiveEnemy,
  enemies: LiveEnemy[],
  baseDamage: number,
  elapsedSec: number,
  events: CombatEvent[],
  killed: number[],
): void {
  if (!ability) return;
  if (ability.kind === 'slow_on_hit') {
    target.chilledUntilSec = Math.max(target.chilledUntilSec, elapsedSec + ability.durationSec);
    target.chillFactor = Math.min(target.chillFactor === 0 ? 1 : target.chillFactor, ability.slowFactor);
    return;
  }
  if (ability.kind === 'splash') {
    for (const e of enemies) {
      if (e === target || e.shieldedUntilSec > elapsedSec) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) <= ability.radius) {
        damageEnemy(deps, e, baseDamage * ability.damageFactor, events, killed);
      }
    }
    return;
  }
  if (ability.kind === 'chain') {
    let jumps = ability.jumps;
    // Deterministic arc: nearest eligible enemies to the target, closest first.
    const candidates = enemies
      .filter((e) => e !== target && e.shieldedUntilSec <= elapsedSec)
      .map((e) => ({ e, d: Math.hypot(e.x - target.x, e.y - target.y) }))
      .filter((c) => c.d <= ability.range)
      .sort((a, b) => (a.d === b.d ? a.e.instanceId - b.e.instanceId : a.d - b.d));
    for (const { e } of candidates) {
      if (jumps <= 0) break;
      damageEnemy(deps, e, baseDamage * ability.damageFactor, events, killed);
      jumps--;
    }
  }
}
