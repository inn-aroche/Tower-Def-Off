import type { EnemyDef, EnemyType } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import type { Grid } from './Grid';
import type { FlowField } from './FlowField';

let nextEnemyId = 1;

export interface StatusEffect {
  slowPct: number;
  slowRemaining: number;
  dotPerSecond: number;
  dotRemaining: number;
  frozenRemaining: number;
  disabledFromTowersRemaining: number; // reserved for future symmetry, unused on enemies today
}

export class Enemy {
  readonly id: string;
  type: EnemyType;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  x: number; // grid-space float column
  y: number; // grid-space float row
  /** Position at the start of the current sim tick — lets the render layer interpolate between ticks. */
  prevX: number;
  prevY: number;
  alive = true;
  leaked = false;
  status: StatusEffect = { slowPct: 0, slowRemaining: 0, dotPerSecond: 0, dotRemaining: 0, frozenRemaining: 0, disabledFromTowersRemaining: 0 };
  private flyTarget: [number, number] | null = null;

  constructor(type: EnemyType, spawn: [number, number]) {
    this.id = `e${nextEnemyId++}`;
    this.type = type;
    this.def = ENEMIES[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.x = spawn[0] + 0.5;
    this.y = spawn[1] + 0.5;
    this.prevX = this.x;
    this.prevY = this.y;
  }

  reset(type: EnemyType, spawn: [number, number]): void {
    this.type = type;
    this.def = ENEMIES[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.x = spawn[0] + 0.5;
    this.y = spawn[1] + 0.5;
    this.prevX = this.x;
    this.prevY = this.y;
    this.alive = true;
    this.leaked = false;
    this.flyTarget = null;
    this.status = { slowPct: 0, slowRemaining: 0, dotPerSecond: 0, dotRemaining: 0, frozenRemaining: 0, disabledFromTowersRemaining: 0 };
  }

  applySlow(pct: number, duration: number): void {
    if (pct >= this.status.slowPct || this.status.slowRemaining <= 0) {
      this.status.slowPct = pct;
    }
    this.status.slowRemaining = Math.max(this.status.slowRemaining, duration);
  }

  applyDot(perSecond: number, duration: number): void {
    this.status.dotPerSecond = Math.max(this.status.dotPerSecond, perSecond);
    this.status.dotRemaining = Math.max(this.status.dotRemaining, duration);
  }

  applyFreeze(duration: number): void {
    this.status.frozenRemaining = Math.max(this.status.frozenRemaining, duration);
  }

  currentSpeedMultiplier(): number {
    if (this.status.frozenRemaining > 0) return 0;
    if (this.status.slowRemaining > 0) return 1 - this.status.slowPct;
    return 1;
  }

  /** Advances position by dt seconds. Ground enemies follow the flow field; flyers go straight spawn->exit. */
  step(dt: number, grid: Grid, flowField: FlowField, exit: [number, number]): void {
    if (!this.alive) return;
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.status.frozenRemaining > 0) this.status.frozenRemaining -= dt;
    if (this.status.slowRemaining > 0) {
      this.status.slowRemaining -= dt;
      if (this.status.slowRemaining <= 0) this.status.slowPct = 0;
    }
    if (this.status.dotRemaining > 0) {
      this.hp -= this.status.dotPerSecond * dt;
      this.status.dotRemaining -= dt;
      if (this.hp <= 0) {
        this.alive = false;
        return;
      }
    }

    const speed = this.def.speed * this.currentSpeedMultiplier();
    if (speed <= 0) return;

    if (this.def.movement === 'flying') {
      if (!this.flyTarget) this.flyTarget = [exit[0] + 0.5, exit[1] + 0.5];
      const dx = this.flyTarget[0] - this.x;
      const dy = this.flyTarget[1] - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.05) {
        this.leaked = true;
        this.alive = false;
        return;
      }
      const move = Math.min(speed * dt, dist);
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
      return;
    }

    const col = Math.floor(this.x);
    const row = Math.floor(this.y);
    const dir = flowField.directionAt(col, row);
    if (!dir) {
      // At exit cell or unreachable (shouldn't happen if placement validation holds).
      if (grid.kindAt(col, row) === 'exit') {
        this.leaked = true;
        this.alive = false;
      }
      return;
    }
    const move = speed * dt;
    this.x += dir[0] * move;
    this.y += dir[1] * move;
  }
}
