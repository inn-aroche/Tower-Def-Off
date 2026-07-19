import type { EnemyKind } from '../data/enemies';
import { ENEMIES, enemyGoldAtWave, enemyHpAtWave } from '../data/enemies';

let nextId = 1;

export class Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly maxHp: number;
  hp: number;
  readonly baseSpeed: number;
  readonly dmgToKeep: number;
  readonly goldReward: number;
  distanceTiles = 0;
  slowFactor = 1; // 1 = normal speed, 0.5 = half speed
  slowTimer = 0;
  alive = true;
  reachedKeep = false;

  constructor(kind: EnemyKind, wave: number) {
    this.id = nextId++;
    this.kind = kind;
    this.maxHp = enemyHpAtWave(kind, wave);
    this.hp = this.maxHp;
    this.baseSpeed = ENEMIES[kind].speed;
    this.dmgToKeep = ENEMIES[kind].dmgToKeep;
    this.goldReward = enemyGoldAtWave(kind, wave);
  }

  applySlow(factor: number, durationS: number): void {
    // Strongest active slow wins; refresh its duration.
    if (factor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = factor;
      this.slowTimer = durationS;
    } else {
      this.slowTimer = Math.max(this.slowTimer, durationS);
    }
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) this.alive = false;
  }

  tick(dt: number, pathLengthTiles: number): void {
    if (!this.alive || this.reachedKeep) return;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    const speed = this.baseSpeed * this.slowFactor;
    this.distanceTiles += speed * dt;
    if (this.distanceTiles >= pathLengthTiles) {
      this.distanceTiles = pathLengthTiles;
      this.reachedKeep = true;
    }
  }
}
