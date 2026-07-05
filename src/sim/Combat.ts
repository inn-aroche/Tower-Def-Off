import type { Tower } from './Tower';
import type { Enemy } from './Enemy';
import type { FlowField } from './FlowField';
import { damageAfterArmor } from '../data/enemies';
import type { EventBus } from '../core/EventBus';

/** Coarse spatial hash of enemies by grid cell — avoids O(towers*enemies) range scans blowing up at ~150 enemies. */
export class EnemySpatialIndex {
  private buckets = new Map<string, Enemy[]>();
  private bucketSize = 2; // cells per bucket

  private key(col: number, row: number): string {
    return `${Math.floor(col / this.bucketSize)},${Math.floor(row / this.bucketSize)}`;
  }

  rebuild(enemies: Iterable<Enemy>): void {
    this.buckets.clear();
    for (const e of enemies) {
      if (!e.alive) continue;
      const k = this.key(e.x, e.y);
      let list = this.buckets.get(k);
      if (!list) {
        list = [];
        this.buckets.set(k, list);
      }
      list.push(e);
    }
  }

  /** All enemies whose bucket could plausibly be within `range` of (col,row). Caller still range-checks precisely. */
  queryNear(col: number, row: number, range: number): Enemy[] {
    const result: Enemy[] = [];
    const bucketRange = Math.ceil(range / this.bucketSize) + 1;
    const bc = Math.floor(col / this.bucketSize);
    const br = Math.floor(row / this.bucketSize);
    for (let dc = -bucketRange; dc <= bucketRange; dc++) {
      for (let dr = -bucketRange; dr <= bucketRange; dr++) {
        const list = this.buckets.get(`${bc + dc},${br + dr}`);
        if (list) result.push(...list);
      }
    }
    return result;
  }
}

function findTarget(tower: Tower, candidates: Enemy[], flowField: FlowField): Enemy | null {
  const stats = tower.effectiveStats;
  const towerCx = tower.col + 0.5;
  const towerCy = tower.row + 0.5;
  let best: Enemy | null = null;
  let bestPriority = -Infinity;

  const branch = tower.activeBranchDef;
  const preferAir = branch?.airPriority === true;

  for (const enemy of candidates) {
    if (!enemy.alive) continue;
    const isAir = enemy.def.movement === 'flying';
    if (isAir && !stats.targetsAir) continue;
    if (!isAir && !stats.targetsGround) continue;
    const dist = Math.hypot(enemy.x - towerCx, enemy.y - towerCy);
    if (dist > stats.range) continue;

    // Priority: furthest along the path (closest to exit) wins; flying enemies use negative distance-to-tower as proxy.
    const progress = isAir ? -dist : -flowField.distanceAt(Math.floor(enemy.x), Math.floor(enemy.y));
    const priority = progress + (preferAir && isAir ? 1000 : 0);
    if (priority > bestPriority) {
      bestPriority = priority;
      best = enemy;
    }
  }
  return best;
}

export interface CombatResult {
  killedBounty: number;
}

/**
 * Resolves one simulation tick of combat: cooldowns, targeting, instant-hit damage resolution,
 * splash/chain/status application, and kamikaze death effects. Damage is hitscan (applied on fire)
 * to keep the simulation deterministic; the render layer plays a travel-time projectile visual.
 */
export function stepCombat(
  towers: Tower[],
  enemies: Enemy[],
  flowField: FlowField,
  spatialIndex: EnemySpatialIndex,
  dt: number,
  bus: EventBus,
): CombatResult {
  spatialIndex.rebuild(enemies);
  let killedBounty = 0;

  for (const tower of towers) {
    tower.tick(dt);
    if (!tower.canFire()) continue;

    const stats = tower.effectiveStats;
    const candidates = spatialIndex.queryNear(tower.col + 0.5, tower.row + 0.5, stats.range);
    const target = findTarget(tower, candidates, flowField);
    if (!target) continue;

    tower.resetCooldown();
    bus.emit('projectileFired', { towerId: tower.id, targetId: target.id });

    const hitTargets: Enemy[] = [target];
    if (stats.splashRadius > 0) {
      for (const other of candidates) {
        if (other === target || !other.alive) continue;
        if (Math.hypot(other.x - target.x, other.y - target.y) <= stats.splashRadius) hitTargets.push(other);
      }
    } else if (stats.chainTargets > 1) {
      const chainPool = candidates.filter((e) => e !== target && e.alive);
      chainPool.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
      hitTargets.push(...chainPool.slice(0, stats.chainTargets - 1));
    }

    const branch = tower.activeBranchDef;
    for (const hit of hitTargets) {
      const raw = stats.damage;
      const dmg = damageAfterArmor(raw, hit.def.armor, stats.armorPierce);
      hit.hp -= dmg;
      if (stats.slowPct > 0) hit.applySlow(stats.slowPct, 1.5);
      if (stats.dotPerSecond > 0) hit.applyDot(stats.dotPerSecond, 3);
      if (branch?.freezePulse && hit.type !== 'boss') hit.applyFreeze(branch.freezePulse.duration);

      if (hit.hp <= 0 && hit.alive) {
        hit.alive = false;
        killedBounty += hit.def.bounty;
        bus.emit('enemyKilled', { enemyId: hit.id, bounty: hit.def.bounty, col: Math.floor(hit.x), row: Math.floor(hit.y) });
        if (hit.def.disablesNearestTower) {
          applyKamikazeEffect(hit, towers, bus);
        }
      }
    }
  }

  return { killedBounty };
}

function applyKamikazeEffect(enemy: Enemy, towers: Tower[], bus: EventBus): void {
  const cfg = enemy.def.disablesNearestTower;
  if (!cfg) return;
  let nearest: Tower | null = null;
  let nearestDist = Infinity;
  for (const tower of towers) {
    const dist = Math.hypot(tower.col + 0.5 - enemy.x, tower.row + 0.5 - enemy.y);
    if (dist <= cfg.radius && dist < nearestDist) {
      nearestDist = dist;
      nearest = tower;
    }
  }
  if (nearest) {
    nearest.disable(cfg.duration);
    bus.emit('towerDisabled', { towerId: nearest.id, duration: cfg.duration });
  }
}
