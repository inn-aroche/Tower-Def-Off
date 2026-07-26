import { regenMana } from './Economy';
import { gravitySlowFactor, resolveAttacks } from './Combat';
import { Grid, isInBounds } from './Grid';
import { isPathCell, pathEndProgress, pathPosition } from './Path';
import type { ScheduledSpawn } from './Wave';
import { buildSpawnSchedule } from './Wave';
import type {
  Cell,
  CombatEvent,
  CombatOutcome,
  CombatSnapshot,
  EconomyConfig,
  EnemyAbility,
  EnemyDef,
  HandCard,
  HeroConfig,
  HeroSnapshot,
  LevelDef,
  LiveEnemy,
  PlacedUnit,
  UnitDef,
  WaveDef,
} from './types';

export interface SurvivalConfig {
  /** Deterministic wave generator, called for wave 0,1,2,… to extend the schedule forever. */
  makeWave: (waveIndex: number) => WaveDef;
  /** Per-enemy HP multiplier applied at spawn, by the wave the enemy belongs to. */
  hpMultForWave: (waveIndex: number) => number;
  /** Breathing room between a wave's last spawn and the next wave's start. */
  waveGapSec: number;
}

export interface CombatSimConfig {
  economy: EconomyConfig;
  level: LevelDef;
  deck: string[];
  unitDefs: UnitDef[];
  enemyDefs: EnemyDef[];
  /** When set, the level's own waves are ignored and waves are generated endlessly. */
  survival?: SurvivalConfig;
  /** When set, the player may deploy this hero once its energy bar is full. */
  hero?: HeroConfig;
}

export type HeroDeployResult =
  | { ok: true }
  | { ok: false; reason: 'no-hero' | 'not-ready' | 'already-out' | 'not-ongoing' | 'cell-occupied' | 'out-of-bounds' | 'on-path' };

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
  private readonly survival?: SurvivalConfig;
  /** Next survival wave index to generate, and the absolute time it should start. */
  private survivalCursor = 0;
  private survivalNextAtSec = 0;

  // Hero runtime.
  private readonly heroConfig?: HeroConfig;
  private heroDeployed = false;
  private heroCol = 0;
  private heroRow = 0;
  private heroHp = 0;
  private heroEnergy = 0;
  private heroAttackCd = 0;
  private heroPowerTimer = 0;
  private heroActiveUntil = 0;

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
  private events: CombatEvent[] = [];
  private readonly endProgress: number;
  private readonly spawnPos: { x: number; y: number };
  private readonly basePos: { x: number; y: number };
  /** Maps a flyer's straight-line travel onto the path-progress scale (so breach/targeting stay uniform). */
  private readonly flyFactor: number;

  constructor(config: CombatSimConfig, _seed = 0) {
    this.economy = config.economy;
    this.level = config.level;
    this.path = config.level.path;
    this.deck = config.deck;
    this.unitDefs = new Map(config.unitDefs.map((u) => [u.id, u]));
    this.enemyDefs = new Map(config.enemyDefs.map((e) => [e.id, e]));
    this.survival = config.survival;
    this.heroConfig = config.hero;
    this.heroHp = config.hero?.maxHp ?? 0;
    // Survival ignores the level's authored waves — it generates them on the fly (see step()).
    this.schedule = config.survival ? [] : buildSpawnSchedule(config.level);
    this.mana = config.economy.manaStartValue;
    this.life = config.level.playerStartLife;
    this.endProgress = pathEndProgress(this.path);
    this.spawnPos = pathPosition(this.path, 0);
    this.basePos = pathPosition(this.path, this.endProgress);
    const straight = Math.max(0.001, Math.hypot(this.basePos.x - this.spawnPos.x, this.basePos.y - this.spawnPos.y));
    this.flyFactor = this.endProgress / straight;
  }

  private spawnEnemy(enemyId: string, hpMult = 1): void {
    const def = this.enemyDefs.get(enemyId);
    const hp = Math.max(1, Math.round((def?.hp ?? 1) * hpMult));
    this.enemies.push({
      instanceId: this.nextInstanceId++,
      enemyId,
      pathProgress: 0,
      x: this.spawnPos.x,
      y: this.spawnPos.y,
      hp,
      maxHp: hp,
      shieldedUntilSec: 0,
      abilityTimerSec: 0,
      chilledUntilSec: 0,
      chillFactor: 1,
    });
    if (def?.boss) this.events.push({ type: 'spawn', x: this.spawnPos.x, y: this.spawnPos.y, boss: true });
  }

  step(dtSec: number): void {
    if (this.outcome !== 'ongoing') return;

    this.elapsedSec += dtSec;
    this.mana = regenMana(this.mana, this.economy, dtSec);

    // Endless mode keeps a wave or two queued ahead of the clock.
    if (this.survival) {
      while (this.survivalNextAtSec <= this.elapsedSec + 1) this.scheduleSurvivalWave();
    }

    while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].atSec <= this.elapsedSec) {
      const spawn = this.schedule[this.spawnCursor];
      this.spawnEnemy(spawn.enemyId, spawn.hpMult ?? 1);
      this.lastSpawnedWaveIndex = spawn.waveIndex;
      this.spawnCursor++;
    }

    const deps = { unitDefs: this.unitDefs, enemyDefs: this.enemyDefs };
    const endProgress = this.endProgress;

    // Movement (flyers cut straight and ignore gravity), regen, and enemy abilities.
    for (const enemy of this.enemies) {
      const def = this.enemyDefs.get(enemy.enemyId);
      const speed = def?.speed ?? 0;
      // Frost chill stacks (multiplicatively) with gravity fields; flyers can still be chilled.
      const chill = enemy.chilledUntilSec > this.elapsedSec ? enemy.chillFactor : 1;
      if (def?.flying) {
        enemy.pathProgress += speed * chill * this.flyFactor * dtSec;
        const t = Math.min(1, enemy.pathProgress / endProgress);
        enemy.x = this.spawnPos.x + (this.basePos.x - this.spawnPos.x) * t;
        enemy.y = this.spawnPos.y + (this.basePos.y - this.spawnPos.y) * t;
      } else {
        const factor = gravitySlowFactor(deps, enemy, this.units) * chill;
        enemy.pathProgress += speed * factor * dtSec;
        const pos = pathPosition(this.path, enemy.pathProgress);
        enemy.x = pos.x;
        enemy.y = pos.y;
      }
      if (def?.regenPerSec && enemy.hp < enemy.maxHp) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + def.regenPerSec * dtSec);
      }
      if (def?.ability) this.tickAbility(enemy, def.ability, dtSec);
    }

    const breached = this.enemies.filter((e) => e.pathProgress >= endProgress);
    if (breached.length > 0) {
      for (const enemy of breached) {
        const dmg = this.enemyDefs.get(enemy.enemyId)?.damageToBase ?? 1;
        this.life -= dmg;
        this.events.push({ type: 'baseHit', amount: dmg });
      }
      this.enemies = this.enemies.filter((e) => e.pathProgress < endProgress);
    }

    if (this.life <= 0) {
      this.life = Math.max(0, this.life);
      this.outcome = 'defeat';
      return;
    }

    const { killedEnemyInstanceIds, events } = resolveAttacks(deps, this.units, this.enemies, dtSec, this.elapsedSec);
    for (const e of events) this.events.push(e);
    const heroKills = this.heroConfig ? this.tickHero(dtSec, deps) : [];
    const allKilled = heroKills.length > 0 ? [...killedEnemyInstanceIds, ...heroKills] : killedEnemyInstanceIds;
    if (allKilled.length > 0) {
      // Dedupe: two units can land the finishing blow on the same enemy in one tick, so the raw
      // list may contain the same instanceId twice — count and remove each enemy once.
      const killedSet = new Set(allKilled);
      for (const enemy of this.enemies) {
        if (!killedSet.has(enemy.instanceId)) continue;
        this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, enemyId: enemy.enemyId });
        const boom = this.enemyDefs.get(enemy.enemyId)?.stunOnDeath;
        if (boom) this.stunUnitsInRadius(enemy.x, enemy.y, boom.radius, boom.stunSec);
      }
      this.enemies = this.enemies.filter((e) => !killedSet.has(e.instanceId));
      this.kills += killedSet.size;
    }

    // Survival never "wins" — waves are endless; the only end state is defeat above.
    if (!this.survival && this.spawnCursor >= this.schedule.length && this.enemies.length === 0) {
      this.outcome = 'victory';
    }
  }

  /** Appends the next generated survival wave to the schedule, keeping it time-sorted. */
  private scheduleSurvivalWave(): void {
    const cfg = this.survival!;
    const wave = cfg.makeWave(this.survivalCursor);
    const hpMult = cfg.hpMultForWave(this.survivalCursor);
    const start = this.survivalNextAtSec;
    const spawns: ScheduledSpawn[] = [];
    for (const g of wave.spawnGroups) {
      for (let i = 0; i < g.count; i++) {
        spawns.push({ atSec: start + g.startDelaySec + i * g.intervalSec, enemyId: g.enemyId, waveIndex: this.survivalCursor, hpMult });
      }
    }
    spawns.sort((a, b) => a.atSec - b.atSec);
    // Every spawn here starts at/after `start`, which is strictly after the previous wave's last
    // spawn, so appending this sorted block preserves the schedule's global time order.
    const lastAt = spawns.length > 0 ? spawns[spawns.length - 1].atSec : start;
    for (const s of spawns) this.schedule.push(s);
    this.survivalNextAtSec = lastAt + cfg.waveGapSec;
    this.survivalCursor++;
  }

  /** Periodic/continuous enemy special behaviour. Deterministic — no RNG. */
  private tickAbility(enemy: LiveEnemy, ability: EnemyAbility, dtSec: number): void {
    if (ability.kind === 'heal_aura') {
      for (const other of this.enemies) {
        if (other === enemy || other.hp >= other.maxHp) continue;
        if (Math.hypot(other.x - enemy.x, other.y - enemy.y) <= ability.radius) {
          other.hp = Math.min(other.maxHp, other.hp + ability.healPerSec * dtSec);
        }
      }
      return;
    }
    enemy.abilityTimerSec += dtSec;
    if (enemy.abilityTimerSec < ability.periodSec) return;
    enemy.abilityTimerSec -= ability.periodSec;
    if (ability.kind === 'shield') {
      enemy.shieldedUntilSec = this.elapsedSec + ability.durationSec;
    } else if (ability.kind === 'summon') {
      for (let i = 0; i < ability.count; i++) this.spawnEnemy(ability.enemyId);
    } else if (ability.kind === 'stun_units') {
      this.stunUnitsInRadius(enemy.x, enemy.y, ability.radius, ability.stunSec);
    }
  }

  private stunUnitsInRadius(x: number, y: number, radius: number, stunSec: number): void {
    for (const unit of this.units) {
      if (Math.hypot(unit.col + 0.5 - x, unit.row + 0.5 - y) <= radius) {
        unit.stunnedUntilSec = Math.max(unit.stunnedUntilSec ?? 0, this.elapsedSec + stunSec);
        this.events.push({ type: 'stun', col: unit.col, row: unit.row });
      }
    }
  }

  /** Deploys the active hero onto a grass cell once its energy bar is full. */
  deployHero(col: number, row: number): HeroDeployResult {
    if (this.outcome !== 'ongoing') return { ok: false, reason: 'not-ongoing' };
    if (!this.heroConfig) return { ok: false, reason: 'no-hero' };
    if (this.heroDeployed) return { ok: false, reason: 'already-out' };
    if (this.heroEnergy < 1) return { ok: false, reason: 'not-ready' };
    if (!isInBounds(col, row, this.economy.gridCols, this.economy.gridRows)) return { ok: false, reason: 'out-of-bounds' };
    if (isPathCell(this.path, col, row)) return { ok: false, reason: 'on-path' };
    const grid = new Grid(this.economy.gridCols, this.economy.gridRows, this.units);
    if (!grid.isEmpty(col, row)) return { ok: false, reason: 'cell-occupied' };

    this.heroDeployed = true;
    this.heroCol = col;
    this.heroRow = row;
    this.heroHp = this.heroConfig.maxHp;
    this.heroActiveUntil = this.elapsedSec + this.heroConfig.durationSec;
    this.heroPowerTimer = 0;
    this.heroAttackCd = 0;
    this.events.push({ type: 'heroDeploy', col, row });
    return { ok: true };
  }

  /** Advances the hero: energy recharge when off-field; when deployed, attack + power + take contact
   * damage, then expire on timeout or death. Returns enemy instanceIds it killed this tick. */
  private tickHero(dtSec: number, deps: { unitDefs: Map<string, UnitDef>; enemyDefs: Map<string, EnemyDef> }): number[] {
    const cfg = this.heroConfig!;
    if (!this.heroDeployed) {
      this.heroEnergy = Math.min(1, this.heroEnergy + dtSec / cfg.rechargeSec);
      return [];
    }
    const killed: number[] = [];
    const hx = this.heroCol + 0.5;
    const hy = this.heroRow + 0.5;
    const damageEnemy = (target: LiveEnemy, amount: number) => {
      if (target.shieldedUntilSec > this.elapsedSec) return;
      const armor = deps.enemyDefs.get(target.enemyId)?.armor ?? 0;
      target.hp -= Math.max(1, Math.round(amount) - armor);
      this.events.push({ type: 'damage', enemyInstanceId: target.instanceId, x: target.x, y: target.y, amount: Math.max(1, Math.round(amount) - armor) });
      if (target.hp <= 0 && !killed.includes(target.instanceId)) killed.push(target.instanceId);
    };

    // Single-target attack on the most-advanced enemy in range.
    this.heroAttackCd = Math.max(0, this.heroAttackCd - dtSec);
    if (this.heroAttackCd <= 0) {
      let best: LiveEnemy | undefined;
      for (const e of this.enemies) {
        if (e.shieldedUntilSec > this.elapsedSec) continue;
        if (Math.hypot(hx - e.x, hy - e.y) > cfg.range) continue;
        if (!best || e.pathProgress > best.pathProgress) best = e;
      }
      if (best) {
        damageEnemy(best, cfg.damage);
        this.heroAttackCd = cfg.attackIntervalSec;
      }
    }

    // Signature power on its own period.
    this.heroPowerTimer += dtSec;
    if (this.heroPowerTimer >= cfg.power.periodSec) {
      this.heroPowerTimer -= cfg.power.periodSec;
      const p = cfg.power;
      this.events.push({ type: 'heroPower', col: this.heroCol, row: this.heroRow, radius: p.kind === 'rally' ? 0 : p.radius });
      if (p.kind === 'nova') {
        for (const e of this.enemies) if (Math.hypot(hx - e.x, hy - e.y) <= p.radius) damageEnemy(e, p.damage);
      } else if (p.kind === 'frost_nova') {
        for (const e of this.enemies) {
          if (Math.hypot(hx - e.x, hy - e.y) <= p.radius) {
            e.chilledUntilSec = Math.max(e.chilledUntilSec, this.elapsedSec + p.durationSec);
            e.chillFactor = Math.min(e.chillFactor === 0 ? 1 : e.chillFactor, p.slowFactor);
          }
        }
      } else if (p.kind === 'rally') {
        this.life = Math.min(this.level.playerStartLife, this.life + p.healBase);
      }
    }

    // Enemies within reach chip the hero's HP (contact damage per second). 1.15 so an enemy on an
    // orthogonally-adjacent cell (1.0 away) counts — that's how the hero gets worn down.
    for (const e of this.enemies) {
      if (Math.hypot(hx - e.x, hy - e.y) <= 1.15) {
        this.heroHp -= (this.enemyDefs.get(e.enemyId)?.damageToBase ?? 1) * dtSec;
      }
    }

    if (this.heroHp <= 0 || this.elapsedSec >= this.heroActiveUntil) {
      this.heroDeployed = false;
      this.heroEnergy = 0;
      this.events.push({ type: 'heroDeath', col: this.heroCol, row: this.heroRow });
    }
    return killed;
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
    this.events.push({ type: 'summon', col, row, family: def.family });
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
    this.events.push({ type: 'merge', col: b.col, row: b.row, newLevel });
    return { ok: true, newLevel };
  }

  /** Returns and clears the events accumulated since the last call (render/haptics feed). */
  consumeEvents(): CombatEvent[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private heroSnapshot(): HeroSnapshot {
    return {
      configured: this.heroConfig !== undefined,
      deployed: this.heroDeployed,
      col: this.heroCol,
      row: this.heroRow,
      hp: Math.max(0, this.heroHp),
      maxHp: this.heroConfig?.maxHp ?? 0,
      energy: this.heroEnergy,
      ready: this.heroEnergy >= 1 && !this.heroDeployed,
    };
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
      endless: this.survival !== undefined,
      hero: this.heroSnapshot(),
    };
  }
}
