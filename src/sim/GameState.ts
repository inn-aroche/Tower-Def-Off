import { Grid } from './Grid';
import { FlowField } from './FlowField';
import { Economy } from './Economy';
import { WaveScheduler } from './WaveScheduler';
import { Tower } from './Tower';
import { Enemy } from './Enemy';
import { ObjectPool } from './ObjectPool';
import { EnemySpatialIndex, stepCombat } from './Combat';
import { ScoreTracker } from './Score';
import type { EventBus } from '../core/EventBus';
import type { LevelConfig } from '../data/LevelConfig';
import type { TowerId, T3Branch } from '../data/towers';
import { TOWERS } from '../data/towers';
import type { EnemyType } from '../data/enemies';

export type LevelOutcome = 'playing' | 'won' | 'lost';

export interface PlacementResult {
  ok: boolean;
  reason?: 'unaffordable' | 'not-buildable' | 'not-allowed' | 'would-block-path';
}

/**
 * Owns the entire deterministic simulation for one level: grid/flow field, economy, towers,
 * enemies, wave scheduling, and combat resolution. No Three.js or DOM imports allowed here.
 */
export class GameState {
  grid!: Grid;
  flowField!: FlowField;
  economy!: Economy;
  waveScheduler!: WaveScheduler;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  outcome: LevelOutcome = 'playing';
  level!: LevelConfig;
  goldSpentTotal = 0;
  towersBuiltCount = 0;
  readonly scoreTracker = new ScoreTracker();
  private leakedThisLevel = false;
  private enemyPool = new ObjectPool<Enemy>(
    () => new Enemy('soldier', [0, 0]),
    (e) => {
      e.alive = false;
    },
    32,
  );
  private spatialIndex = new EnemySpatialIndex();

  constructor(private readonly bus: EventBus) {
    this.bus.on('enemyKilled', () => this.scoreTracker.registerKill());
  }

  loadLevel(level: LevelConfig): void {
    this.level = level;
    this.grid = new Grid(level.grid);
    this.flowField = new FlowField(this.grid);
    this.economy = new Economy(this.bus, level.startGold, level.baseHp);
    this.waveScheduler = new WaveScheduler(level.waves);
    // The base defends itself, weakly — a free, non-buildable, non-upgradable, non-sellable
    // 'base' Tower sitting on the exit cell, going through none of tryPlaceTower's gold/placement
    // machinery. It doesn't occupy the cell (kind stays 'exit'), so it never affects pathing.
    this.towers = this.grid.exits.map(([col, row]) => new Tower('base', col, row));
    this.enemyPool.releaseAll();
    this.enemies = [];
    this.outcome = 'playing';
    this.goldSpentTotal = 0;
    this.towersBuiltCount = 0;
    this.leakedThisLevel = false;
    this.scoreTracker.reset();
  }

  isTowerAllowed(towerId: TowerId): boolean {
    return this.level.allowedTowers.includes(towerId);
  }

  tryPlaceTower(towerId: TowerId, col: number, row: number): PlacementResult {
    if (!this.isTowerAllowed(towerId)) {
      this.bus.emit('towerPlacementRefused', { col, row, reason: 'not-allowed' });
      return { ok: false, reason: 'not-allowed' };
    }
    if (!this.grid.isBuildable(col, row)) {
      this.bus.emit('towerPlacementRefused', { col, row, reason: 'not-buildable' });
      return { ok: false, reason: 'not-buildable' };
    }
    const cost = TOWERS[towerId].tiers[0].cost;
    if (!this.economy.canAfford(cost)) {
      this.bus.emit('towerPlacementRefused', { col, row, reason: 'unaffordable' });
      return { ok: false, reason: 'unaffordable' };
    }

    // Tentatively occupy the cell and verify every spawn can still reach an exit.
    this.grid.setKind(col, row, 'occupied');
    this.flowField.recompute();
    if (!this.flowField.allSpawnsReachable()) {
      this.grid.setKind(col, row, 'empty');
      this.flowField.recompute();
      this.bus.emit('towerPlacementRefused', { col, row, reason: 'would-block-path' });
      return { ok: false, reason: 'would-block-path' };
    }

    this.economy.spend(cost);
    this.goldSpentTotal += cost;
    this.towersBuiltCount++;
    const tower = new Tower(towerId, col, row);
    this.towers.push(tower);
    this.bus.emit('towerPlaced', { towerId: tower.id, col, row });
    this.bus.emit('flowFieldRecomputed', {});
    return { ok: true };
  }

  upgradeTower(towerId: string, branch?: T3Branch): boolean {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower || !tower.canUpgrade()) return false;
    const cost = tower.costForNextTier();
    if (cost === null || !this.economy.canAfford(cost)) return false;
    this.economy.spend(cost);
    this.goldSpentTotal += cost;
    tower.upgrade(branch);
    this.bus.emit('towerUpgraded', { towerId: tower.id, tier: tower.tier });
    return true;
  }

  sellTower(towerId: string): boolean {
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx === -1) return false;
    const tower = this.towers[idx];
    if (tower.towerId === 'base') return false;
    const refund = tower.refundValue();
    this.grid.setKind(tower.col, tower.row, 'empty');
    this.towers.splice(idx, 1);
    this.flowField.recompute();
    this.economy.earn(refund);
    this.bus.emit('towerSold', { towerId, refund });
    this.bus.emit('flowFieldRecomputed', {});
    return true;
  }

  callWaveEarly(): number {
    if (this.waveScheduler.phase !== 'build') return 0;
    const remainingFraction = this.waveScheduler.callEarly();
    const bonus = this.economy.grantEarlyCallBonus(this.waveScheduler.waveIndex, remainingFraction);
    this.bus.emit('waveCalledEarly', { waveIndex: this.waveScheduler.waveIndex, bonusPct: remainingFraction });
    return bonus;
  }

  private spawnEnemy(type: EnemyType, spawnIndex: number): void {
    const spawn = this.grid.spawns[spawnIndex % this.grid.spawns.length];
    const enemy = this.enemyPool.acquire();
    enemy.reset(type, spawn);
    this.enemies.push(enemy);
    this.bus.emit('enemySpawned', { enemyId: enemy.id, type });
  }

  step(dt: number): void {
    if (this.outcome !== 'playing') return;

    this.scoreTracker.tick(dt);

    const wasSpawning = this.waveScheduler.phase === 'spawning';
    this.waveScheduler.update(dt, this.grid.spawns.length, (type, spawnIndex) => this.spawnEnemy(type, spawnIndex));
    if (wasSpawning && this.waveScheduler.phase !== 'spawning' && this.enemies.length === 0) {
      this.checkWaveClear();
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const exit = this.grid.exits[0];
      enemy.step(dt, this.grid, this.flowField, exit);
      if (enemy.leaked) {
        this.leakedThisLevel = true;
        this.economy.loseLives(enemy.def.leakDamage);
        this.bus.emit('enemyLeaked', { enemyId: enemy.id, damage: enemy.def.leakDamage });
      }
    }

    const combatResult = stepCombat(this.towers, this.enemies, this.flowField, this.spatialIndex, dt, this.bus);
    if (combatResult.killedBounty > 0) this.economy.earn(combatResult.killedBounty);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) {
        this.enemyPool.release(enemy);
        this.enemies.splice(i, 1);
      }
    }

    if (this.economy.isDefeated) {
      this.outcome = 'lost';
      this.bus.emit('levelLost', {});
      return;
    }

    if (this.waveScheduler.phase === 'awaiting-clear' && this.enemies.length === 0) {
      this.checkWaveClear();
    }
  }

  private checkWaveClear(): void {
    const waveIndex = this.waveScheduler.waveIndex;
    const bonus = this.economy.grantWaveCompletionBonus(waveIndex);
    this.bus.emit('waveCompleted', { waveIndex, bonus });

    if (this.waveScheduler.isLastWave) {
      this.outcome = 'won';
      const stars = this.computeStars();
      this.bus.emit('levelWon', { starsEarned: stars });
      return;
    }
    this.waveScheduler.advanceToNextWave();
  }

  computeStars(): number {
    // Star 1: finish the level. Star 2: no leak + under the tower cap. Star 3: also under the gold budget.
    const goals = this.level.starGoals;
    const star2Met = (!goals.noLeak || !this.leakedThisLevel) && (goals.maxTowers === undefined || this.towersBuiltCount <= goals.maxTowers);
    const star3Met = star2Met && (goals.maxGoldSpent === undefined || this.goldSpentTotal <= goals.maxGoldSpent);
    if (star3Met) return 3;
    if (star2Met) return 2;
    return 1;
  }
}
