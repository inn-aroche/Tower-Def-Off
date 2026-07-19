import { regenMana } from './Economy';
import { gravitySlowFactor, resolveAttacks } from './Combat';
import { Grid, isInBounds } from './Grid';
import { isPathCell, pathEndProgress, pathPosition } from './Path';
import type { ScheduledSpawn } from './Wave';
import { buildSpawnSchedule } from './Wave';
import type {
  Cell,
  CombatOutcome,
  CombatSnapshot,
  EconomyConfig,
  EnemyDef,
  HandCard,
  LevelDef,
  LiveEnemy,
  PlacedUnit,
  UnitDef,
} from './types';

export interface CombatSimConfig {
  economy: EconomyConfig;
  level: LevelDef;
  deck: string[];
  unitDefs: UnitDef[];
  enemyDefs: EnemyDef[];
}

export type SummonResult =
  | { ok: true; unitId: string }
  | { ok: false; reason: 'not-ongoing' | 'cell-occupied' | 'out-of-bounds' | 'on-path' | 'not-enough-mana' | 'unknown-card' };

export type MergeResult =
  | { ok: true; newLevel: number }
  | { ok: false; reason: 'not-ongoing' | 'missing-unit' | 'mismatch' | 'max-level' | 'same-cell' };

export class CombatSim {
  private readonly economy: EconomyConfig;
  private readonly level: LevelDef;
  private readonly path: Cell[];
  private readonly deck: string[];
  private readonly unitDefs: Map<string, UnitDef>;
  private readonly enemyDefs: Map<string, EnemyDef>;
  private readonly schedule: ScheduledSpawn[];

  private elapsedSec = 0;
  private mana: number;
  private life: number;
  private units: PlacedUnit[] = [];
  private enemies: LiveEnemy[] = [];
  private kills = 0;
  private outcome: CombatOutcome = 'ongoing';
  private spawnCursor = 0;
  private nextInstanceId = 1;
  private lastSpawnedWaveIndex = 0;

  constructor(config: CombatSimConfig, _seed = 0) {
    this.economy = config.economy;
    this.level = config.level;
    this.path = config.level.path;
    this.deck = config.deck;
    this.unitDefs = new Map(config.unitDefs.map((u) => [u.id, u]));
    this.enemyDefs = new Map(config.enemyDefs.map((e) => [e.id, e]));
    this.schedule = buildSpawnSchedule(config.level);
    this.mana = config.economy.manaStartValue;
    this.life = config.level.playerStartLife;
  }

  step(dtSec: number): void {
    if (this.outcome !== 'ongoing') return;

    this.elapsedSec += dtSec;
    this.mana = regenMana(this.mana, this.economy, dtSec);

    while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].atSec <= this.elapsedSec) {
      const spawn = this.schedule[this.spawnCursor];
      const start = pathPosition(this.path, 0);
      this.enemies.push({
        instanceId: this.nextInstanceId++,
        enemyId: spawn.enemyId,
        pathProgress: 0,
        x: start.x,
        y: start.y,
        hp: this.enemyDefs.get(spawn.enemyId)?.hp ?? 1,
      });
      this.lastSpawnedWaveIndex = spawn.waveIndex;
      this.spawnCursor++;
    }

    const deps = { unitDefs: this.unitDefs, enemyDefs: this.enemyDefs };
    const endProgress = pathEndProgress(this.path);

    for (const enemy of this.enemies) {
      const factor = gravitySlowFactor(deps, enemy, this.units);
      const speed = this.enemyDefs.get(enemy.enemyId)?.speed ?? 0;
      enemy.pathProgress += speed * factor * dtSec;
      const pos = pathPosition(this.path, enemy.pathProgress);
      enemy.x = pos.x;
      enemy.y = pos.y;
    }

    const breached = this.enemies.filter((e) => e.pathProgress >= endProgress);
    if (breached.length > 0) {
      for (const enemy of breached) {
        this.life -= this.enemyDefs.get(enemy.enemyId)?.damageToBase ?? 1;
      }
      this.enemies = this.enemies.filter((e) => e.pathProgress < endProgress);
    }

    if (this.life <= 0) {
      this.life = Math.max(0, this.life);
      this.outcome = 'defeat';
      return;
    }

    const { killedEnemyInstanceIds } = resolveAttacks(deps, this.units, this.enemies, dtSec);
    if (killedEnemyInstanceIds.length > 0) {
      // Dedupe: two units can land the finishing blow on the same enemy in one tick, so the raw
      // list may contain the same instanceId twice — count and remove each enemy once.
      const killedSet = new Set(killedEnemyInstanceIds);
      this.enemies = this.enemies.filter((e) => !killedSet.has(e.instanceId));
      this.kills += killedSet.size;
    }

    if (this.spawnCursor >= this.schedule.length && this.enemies.length === 0) {
      this.outcome = 'victory';
    }
  }

  /** Places a specific unit from the deck (card-choice model) at a cell, paying its fixed cost. */
  summon(unitId: string, col: number, row: number): SummonResult {
    if (this.outcome !== 'ongoing') return { ok: false, reason: 'not-ongoing' };
    const def = this.unitDefs.get(unitId);
    if (!def || !this.deck.includes(unitId)) return { ok: false, reason: 'unknown-card' };
    if (!isInBounds(col, row, this.economy.gridCols, this.economy.gridRows)) {
      return { ok: false, reason: 'out-of-bounds' };
    }
    if (isPathCell(this.path, col, row)) return { ok: false, reason: 'on-path' };
    const grid = new Grid(this.economy.gridCols, this.economy.gridRows, this.units);
    if (!grid.isEmpty(col, row)) return { ok: false, reason: 'cell-occupied' };
    if (this.mana < def.cost) return { ok: false, reason: 'not-enough-mana' };

    this.mana -= def.cost;
    this.units.push({ unitId, level: 1, col, row, attackCooldownSec: 0 });
    return { ok: true, unitId };
  }

  merge(a: { col: number; row: number }, b: { col: number; row: number }): MergeResult {
    if (this.outcome !== 'ongoing') return { ok: false, reason: 'not-ongoing' };
    if (a.col === b.col && a.row === b.row) return { ok: false, reason: 'same-cell' };
    const unitA = this.units.find((u) => u.col === a.col && u.row === a.row);
    const unitB = this.units.find((u) => u.col === b.col && u.row === b.row);
    if (!unitA || !unitB) return { ok: false, reason: 'missing-unit' };
    if (unitA.unitId !== unitB.unitId || unitA.level !== unitB.level) return { ok: false, reason: 'mismatch' };
    const def = this.unitDefs.get(unitA.unitId);
    if (!def) return { ok: false, reason: 'missing-unit' };
    if (unitA.level >= def.levels.length) return { ok: false, reason: 'max-level' };

    this.units = this.units.filter((u) => u !== unitA && u !== unitB);
    const newLevel = unitA.level + 1;
    this.units.push({ unitId: unitB.unitId, level: newLevel, col: b.col, row: b.row, attackCooldownSec: 0 });
    return { ok: true, newLevel };
  }

  private hand(): HandCard[] {
    return this.deck.map((unitId) => {
      const def = this.unitDefs.get(unitId)!;
      return { unitId, name: def.name, family: def.family, cost: def.cost, affordable: this.mana >= def.cost };
    });
  }

  snapshot(): CombatSnapshot {
    return {
      elapsedSec: this.elapsedSec,
      mana: this.mana,
      life: this.life,
      outcome: this.outcome,
      units: this.units.map((u) => ({ ...u })),
      enemies: this.enemies.map((e) => ({ ...e })),
      hand: this.hand(),
      currentWaveIndex: this.lastSpawnedWaveIndex,
      totalWaves: this.level.waves.length,
      kills: this.kills,
    };
  }
}
