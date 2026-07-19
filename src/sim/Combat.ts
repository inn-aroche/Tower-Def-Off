import type { SkillEffects } from '../data/classes';
import { CHAIN_FALLOFF, TOWERS } from '../data/towers';
import { hasFlag } from '../meta/SkillTree';
import type { Enemy } from './Enemy';
import type { Grid } from './Grid';
import type { Tower } from './Tower';

export interface FxEvent {
  kind: 'shot' | 'impact' | 'splash';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  crit: boolean;
}

export interface FireResult {
  hitEnemies: Enemy[];
  fx: FxEvent[];
}

function enemyPixel(grid: Grid, e: Enemy): { x: number; y: number } {
  return grid.pointAtDistance(e.distanceTiles);
}

function inRange(grid: Grid, tower: Tower, e: Enemy, rangeTiles: number): boolean {
  const center = grid.cellCenter(tower.col, tower.row);
  const p = enemyPixel(grid, e);
  const dx = (p.x - center.x) / grid.tileSize;
  const dy = (p.y - center.y) / grid.tileSize;
  return Math.hypot(dx, dy) <= rangeTiles;
}

/** Targets the enemy furthest along the path (closest to the Keep) within range. */
function findPrimaryTarget(grid: Grid, tower: Tower, enemies: Enemy[], rangeTiles: number): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (!e.alive || e.reachedKeep) continue;
    if (!inRange(grid, tower, e, rangeTiles)) continue;
    if (!best || e.distanceTiles > best.distanceTiles) best = e;
  }
  return best;
}

export function resolveTowerFire(tower: Tower, grid: Grid, enemies: Enemy[], effects: SkillEffects): FireResult | null {
  const def = tower.def;
  const kind = tower.kind;
  const primary = findPrimaryTarget(grid, tower, enemies, def.range);
  if (!primary) return null;

  const isElemental = kind === 'frost' || kind === 'arcane';
  const dmgMultiplier = 1 + (isElemental ? effects.elementalDmgPct ?? 0 : 0);

  const towerCenter = grid.cellCenter(tower.col, tower.row);
  const fx: FxEvent[] = [];
  const hitEnemies: Enemy[] = [];
  const color = TOWERS[kind].color;

  const applyHit = (target: Enemy, dmg: number, isPrimary: boolean) => {
    const canCrit = kind === 'arrow' || kind === 'cannon';
    const critChance = canCrit ? effects.critChanceBonus ?? 0 : 0;
    const isBoss = target.kind === 'boss';
    const critMult = 1 + (effects.critMultiplierBonus ?? 0) + (isBoss && hasFlag(effects, 'tirFatal') ? 0.5 : 0);
    const crit = canCrit && Math.random() < critChance;
    const finalDmg = dmg * (crit ? critMult : 1);
    target.takeDamage(finalDmg);
    hitEnemies.push(target);
    const p = enemyPixel(grid, target);
    fx.push({ kind: isPrimary ? 'shot' : 'impact', fromX: towerCenter.x, fromY: towerCenter.y, toX: p.x, toY: p.y, color, crit });
  };

  applyHit(primary, def.dmg * dmgMultiplier, true);

  if (def.slow) {
    const durMult = 1 + (kind === 'frost' ? effects.frostSlowDurationPct ?? 0 : 0);
    primary.applySlow(1 - def.slow, (def.slowDur ?? 1) * durMult);
  }

  if (def.splash) {
    const p = enemyPixel(grid, primary);
    for (const e of enemies) {
      if (e === primary || !e.alive || e.reachedKeep) continue;
      const ep = enemyPixel(grid, e);
      const dist = Math.hypot((ep.x - p.x) / grid.tileSize, (ep.y - p.y) / grid.tileSize);
      if (dist <= def.splash) {
        e.takeDamage(def.dmg * dmgMultiplier);
        hitEnemies.push(e);
        fx.push({ kind: 'splash', fromX: p.x, fromY: p.y, toX: ep.x, toY: ep.y, color, crit: false });
      }
    }
  }

  if (def.chain) {
    const chainBonus = kind === 'arcane' ? effects.arcaneChainBonus ?? 0 : 0;
    const totalTargets = def.chain + chainBonus;
    let lastPos = enemyPixel(grid, primary);
    let dmg = def.dmg * dmgMultiplier;
    const used = new Set<number>([primary.id]);
    for (let i = 1; i < totalTargets; i++) {
      dmg *= CHAIN_FALLOFF;
      let next: Enemy | null = null;
      let bestDist = Infinity;
      for (const e of enemies) {
        if (used.has(e.id) || !e.alive || e.reachedKeep) continue;
        const ep = enemyPixel(grid, e);
        const d = Math.hypot((ep.x - lastPos.x) / grid.tileSize, (ep.y - lastPos.y) / grid.tileSize);
        if (d <= 2.5 && d < bestDist) {
          bestDist = d;
          next = e;
        }
      }
      if (!next) break;
      used.add(next.id);
      const p = enemyPixel(grid, next);
      next.takeDamage(dmg);
      hitEnemies.push(next);
      fx.push({ kind: 'impact', fromX: lastPos.x, fromY: lastPos.y, toX: p.x, toY: p.y, color, crit: false });
      lastPos = p;
    }
  }

  if (def.pierce) {
    let count = 0;
    for (const e of enemies) {
      if (count >= def.pierce) break;
      if (e === primary || !e.alive || e.reachedKeep) continue;
      if (!inRange(grid, tower, e, def.range)) continue;
      e.takeDamage(def.dmg * dmgMultiplier);
      hitEnemies.push(e);
      count++;
    }
  }

  return { hitEnemies, fx };
}

export const FROST_NOVA_INTERVAL = 3; // seconds between tier-3 Frost pulses
const FROST_NOVA_RADIUS = 1.5; // tiles

/** Tier-3 Frost unique: a periodic pulse independent of the normal fire cycle, damages + slows everyone nearby. */
export function resolveFrostNova(tower: Tower, grid: Grid, enemies: Enemy[], effects: SkillEffects): FireResult {
  const def = tower.def;
  const center = grid.cellCenter(tower.col, tower.row);
  const dmgMultiplier = 1 + (effects.elementalDmgPct ?? 0);
  const durMult = 1 + (effects.frostSlowDurationPct ?? 0);
  const hitEnemies: Enemy[] = [];
  const fx: FxEvent[] = [];
  for (const e of enemies) {
    if (!e.alive || e.reachedKeep) continue;
    if (!inRange(grid, tower, e, FROST_NOVA_RADIUS)) continue;
    e.takeDamage(def.dmg * dmgMultiplier);
    e.applySlow(1 - (def.slow ?? 0.6), (def.slowDur ?? 1.5) * durMult);
    hitEnemies.push(e);
    const p = enemyPixel(grid, e);
    fx.push({ kind: 'splash', fromX: center.x, fromY: center.y, toX: p.x, toY: p.y, color: TOWERS.frost.color, crit: false });
  }
  return { hitEnemies, fx };
}
