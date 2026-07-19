import { regenMana, summonCost } from './Economy';
import { gravitySlowFactor, resolveAttacks } from './Combat';
import { Grid, isInBounds } from './Grid';
import { Rng } from './Rng';
import type { ScheduledSpawn } from './Wave';
import { buildSpawnSchedule } from './Wave';
import type {
  CombatOutcome,
  CombatSnapshot,
  EconomyConfig,
  EnemyDef,
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
  | { ok: false; reason: 'not-ongoing' | 'cell-occupied' | 'out-of-bounds' | 'not-enough-mana' | 'empty-deck' };

export type MergeResult =
  | { ok: true; newLevel: number }
  | { ok: false; reason: 'not-ongoing' | 'missing-unit' | 'mismatch' | 'max-level' | 'same-cell' };

export class CombatSim {
  private readonly economy: EconomyConfig;
  private readonly level: LevelDef;
  private readonly deck: string[];
  private readonly unitDefs: Map<string, UnitDef>;
  private readonly enemyDefs: Map<string, EnemyDef>;
  private readonly schedule: ScheduledSpawn[];
  private readonly rng: Rng;

  private elapsedSec = 0;
  private mana: number;
  private life: number;
  private units: PlacedUnit[] = [];
  private enemies: LiveEnemy[] = [];
  private summonCount = 0;
  private kills = 0;
  private outcome: CombatOutcome = 'ongoing';
  private spawnCursor = 0;
  private nextInstanceId = 1;
  private lastSpawnedWaveIndex = 0;

  constructor(config: CombatSimConfig, seed: number) {
    this.economy = config.economy;
    this.level = config.level;
    this.deck = config.deck;
    this.unitDefs = new Map(config.unitDefs.map((u) => [u.id, u]));
    this.enemyDefs = new Map(config.enemyDefs.map((e) => [e.id, e]));
    this.schedule = buildSpawnSchedule(config.level);
    this.rng = new Rng(seed);
    this.mana = config.economy.manaStartValue;
    this.life = config.level.playerStartLife;
  }

  step(dtSec: number): void {
    if (this.outcome !== 'ongoing') return;

    this.elapsedSec += dtSec;
    this.mana = regenMana(this.mana, this.economy, dtSec);

    while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].atSec <= this.elapsedSec) {
      const spawn = this.schedule[this.spawnCursor];
      const col = this.rng.nextInt(this.economy.gridCols);
      this.enemies.push({
        instanceId: this.nextInstanceId++,
        enemyId: spawn.enemyId,
        col,
        rowPos: 0,
        hp: this.enemyDefs.get(spawn.enemyId)?.hp ?? 1,
      });
      this.lastSpawnedWaveIndex = spawn.waveIndex;
      this.spawnCursor++;
    }

    const deps = { unitDefs: this.unitDefs, enemyDefs: this.enemyDefs };

    for (const enemy of this.enemies) {
      const factor = gravitySlowFactor(deps, enemy, this.units);
      const def = this.enemyDefs.get(enemy.enemyId);
      const speed = def?.speed ?? 0;
      enemy.rowPos += speed * factor * dtSec;
    }

    const breached = this.enemies.filter((e) => e.rowPos >= this.economy.gridRows);
    if (breached.length > 0) {
      for (const enemy of breached) {
        const def = this.enemyDefs.get(enemy.enemyId);
        this.life -= def?.damageToBase ?? 1;
      }
      this.enemies = this.enemies.filter((e) => e.rowPos < this.economy.gridRows);
    }

    if (this.life <= 0) {
      this.life = Math.max(0, this.life);
      this.outcome = 'defeat';
      return;
    }

    const { killedEnemyInstanceIds } = resolveAttacks(deps, this.units, this.enemies, dtSec);
    if (killedEnemyInstanceIds.length > 0) {
      const killedSet = new Set(killedEnemyInstanceIds);
      this.enemies = this.enemies.filter((e) => !killedSet.has(e.instanceId));
      this.kills += killedEnemyInstanceIds.length;
    }

    if (this.spawnCursor >= this.schedule.length && this.enemies.length === 0) {
      this.outcome = 'victory';
    }
  }

  summon(col: number, row: number): SummonResult {
    if (this.outcome !== 'ongoing') return { ok: false, reason: 'not-ongoing' };
    if (!isInBounds(col, row, this.economy.gridCols, this.economy.gridRows)) {
      return { ok: false, reason: 'out-of-bounds' };
    }
    const grid = new Grid(this.economy.gridCols, this.economy.gridRows, this.units);
    if (!grid.isEmpty(col, row)) return { ok: false, reason: 'cell-occupied' };
    if (this.deck.length === 0) return { ok: false, reason: 'empty-deck' };
    const cost = summonCost(this.economy, this.summonCount);
    if (this.mana < cost) return { ok: false, reason: 'not-enough-mana' };

    this.mana -= cost;
    this.summonCount++;
    const unitId = this.rng.pick(this.deck);
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

  snapshot(): CombatSnapshot {
    return {
      elapsedSec: this.elapsedSec,
      mana: this.mana,
      life: this.life,
      outcome: this.outcome,
      units: this.units.map((u) => ({ ...u })),
      enemies: this.enemies.map((e) => ({ ...e })),
      summonCount: this.summonCount,
      nextSummonCost: summonCost(this.economy, this.summonCount),
      currentWaveIndex: this.lastSpawnedWaveIndex,
      totalWaves: this.level.waves.length,
      kills: this.kills,
    };
  }
}
