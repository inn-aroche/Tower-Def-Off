import type { ClassId, SkillEffects } from '../data/classes';
import { CLASSES } from '../data/classes';
import { KEEP_BASE_MAX_HP, KEEP_REGEN_PER_WAVE_PCT } from '../data/balance';
import type { MapDef } from '../data/maps';
import type { TowerKind } from '../data/towers';
import { TOWERS } from '../data/towers';
import { generateWave } from '../data/waveGenerator';
import { analytics } from '../tracking/Analytics';
import { hasFlag } from '../meta/SkillTree';
import { resolveFrostNova, resolveTowerFire, FROST_NOVA_INTERVAL, type FxEvent } from './Combat';
import { killGold, sellRefund, startingGold, towerCost, waveClearBonus } from './Economy';
import { Enemy } from './Enemy';
import { Grid } from './Grid';
import { Tower } from './Tower';

export type RunStatus = 'ready' | 'wave-active' | 'defeat';

interface PendingSpawn {
  kind: import('../data/enemies').EnemyKind;
  timeRemaining: number;
}

export class GameState {
  readonly grid: Grid;
  readonly classId: ClassId;
  readonly effects: SkillEffects;

  gold: number;
  keepMaxHp: number;
  keepHp: number;
  wave = 0;
  wavesCleared = 0;
  kills = 0;
  bossKills = 0;
  status: RunStatus = 'ready';
  startedAt = Date.now();

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  private pendingSpawns: PendingSpawn[] = [];
  private novaCooldowns = new Map<number, number>(); // towerId -> seconds until next Frost T3 pulse

  ultimateCooldown = 0;
  shieldTimer = 0; // Bastion: keep takes 0 damage while > 0
  private echoTimer: number | null = null;
  private echoAction: (() => void) | null = null;

  fxQueue: FxEvent[] = [];
  events: { text: string }[] = [];

  constructor(map: MapDef, classId: ClassId, effects: SkillEffects) {
    this.grid = new Grid(map);
    this.classId = classId;
    this.effects = effects;
    this.gold = startingGold(effects);
    this.keepMaxHp = Math.round(KEEP_BASE_MAX_HP * (1 + (effects.keepMaxHpPct ?? 0)) + (effects.keepMaxHpFlat ?? 0));
    this.keepHp = this.keepMaxHp;
  }

  get ultimateReady(): boolean {
    return this.ultimateCooldown <= 0 && this.status === 'wave-active';
  }

  startNextWave(): void {
    if (this.status === 'defeat') return;
    this.wave += 1;
    const plan = generateWave(this.wave);
    this.pendingSpawns = plan.spawns.map((s) => ({ kind: s.kind, timeRemaining: s.delay }));
    this.status = 'wave-active';
    analytics.track({ name: 'wave_start', props: { wave: this.wave, is_boss_wave: plan.isBossWave } });
  }

  placeTower(kind: TowerKind, col: number, row: number): boolean {
    if (this.status === 'defeat') return false;
    if (!this.grid.isBuildable(col, row)) return false;
    if (this.towers.some((t) => t.col === col && t.row === row)) return false;
    const baseCost = TOWERS[kind].tiers[0].cost;
    const cost = towerCost(baseCost, this.effects);
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.towers.push(new Tower(kind, col, row, cost));
    analytics.track({ name: 'tower_placed', props: { tower_kind: kind, cost, wave: this.wave } });
    return true;
  }

  upgradeTower(towerId: number): boolean {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower || !tower.canUpgrade()) return false;
    const baseCost = TOWERS[tower.kind].tiers[tower.tier as 1 | 2].cost;
    const cost = towerCost(baseCost, this.effects);
    if (this.gold < cost) return false;
    this.gold -= cost;
    tower.applyUpgrade(cost);
    analytics.track({ name: 'tower_upgraded', props: { tower_kind: tower.kind, tier: tower.tier, cost, wave: this.wave } });
    return true;
  }

  sellTower(towerId: number): boolean {
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx === -1) return false;
    const tower = this.towers[idx];
    const refund = sellRefund(tower.totalInvested);
    this.gold += refund;
    this.towers.splice(idx, 1);
    this.novaCooldowns.delete(towerId);
    analytics.track({ name: 'tower_sold', props: { tower_kind: tower.kind, tier: tower.tier, refund, wave: this.wave } });
    return true;
  }

  activateUltimate(): boolean {
    if (!this.ultimateReady) return false;
    const def = CLASSES[this.classId].ultimate;
    const cdMult = 1 + (this.effects.ultimateCooldownPct ?? 0);
    this.ultimateCooldown = Math.max(5, def.baseCooldown * cdMult);
    analytics.track({ name: 'ultimate_used', props: { class_id: this.classId, wave: this.wave } });

    if (this.classId === 'warrior') {
      this.shieldTimer = 6 + (this.effects.ultimateDurationBonus ?? 0);
      if (hasFlag(this.effects, 'bastionHeal')) this.keepHp = Math.min(this.keepMaxHp, this.keepHp + this.keepMaxHp * 0.1);
    } else if (this.classId === 'mage') {
      this.pulseNova(2 + (this.effects.ultimateDurationBonus ?? 0));
      if (hasFlag(this.effects, 'singularity')) this.scheduleEcho(1, () => this.pulseNova(2 + (this.effects.ultimateDurationBonus ?? 0)));
    } else if (this.classId === 'ranger') {
      this.volley();
      if (hasFlag(this.effects, 'rafale')) this.scheduleEcho(2, () => this.volley());
    }
    return true;
  }

  private pulseNova(freezeDuration: number): void {
    for (const e of this.enemies) {
      if (!e.alive || e.reachedKeep) continue;
      e.takeDamage(30 * (1 + (this.effects.elementalDmgPct ?? 0)));
      e.applySlow(0, freezeDuration);
    }
    this.reapDeadEnemies();
  }

  private volley(): void {
    const mult = 1.5 + (this.effects.ultimateDamageBonusPct ?? 0);
    for (const tower of this.towers) {
      const result = resolveTowerFire(tower, this.grid, this.enemies, { ...this.effects });
      if (!result) continue;
      for (const e of result.hitEnemies) {
        // Volley damage was already applied at normal power inside resolveTowerFire; top up to reach `mult`.
        e.takeDamage(tower.def.dmg * (mult - 1));
      }
      this.fxQueue.push(...result.fx);
    }
    this.reapDeadEnemies();
  }

  private scheduleEcho(delay: number, action: () => void): void {
    this.echoTimer = delay;
    this.echoAction = action;
  }

  update(dt: number): void {
    if (this.status !== 'wave-active') return;

    if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (this.ultimateCooldown > 0) this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
    if (this.echoTimer !== null) {
      this.echoTimer -= dt;
      if (this.echoTimer <= 0) {
        const action = this.echoAction;
        this.echoTimer = null;
        this.echoAction = null;
        action?.();
      }
    }

    for (const spawn of this.pendingSpawns) spawn.timeRemaining -= dt;
    const ready = this.pendingSpawns.filter((s) => s.timeRemaining <= 0);
    if (ready.length > 0) {
      this.pendingSpawns = this.pendingSpawns.filter((s) => s.timeRemaining > 0);
      for (const s of ready) this.enemies.push(new Enemy(s.kind, this.wave));
    }

    for (const e of this.enemies) {
      e.tick(dt, this.grid.pathLengthTiles);
      if (e.reachedKeep) {
        if (this.shieldTimer <= 0) this.keepHp = Math.max(0, this.keepHp - e.dmgToKeep);
        e.alive = false;
      }
    }

    for (const tower of this.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown <= 0) {
        const result = resolveTowerFire(tower, this.grid, this.enemies, this.effects);
        tower.cooldown = 1 / tower.def.rate;
        if (result) this.fxQueue.push(...result.fx);
      }
      if (tower.kind === 'frost' && tower.tier === 3) {
        const remaining = (this.novaCooldowns.get(tower.id) ?? FROST_NOVA_INTERVAL) - dt;
        if (remaining <= 0) {
          const result = resolveFrostNova(tower, this.grid, this.enemies, this.effects);
          this.fxQueue.push(...result.fx);
          this.novaCooldowns.set(tower.id, FROST_NOVA_INTERVAL);
        } else {
          this.novaCooldowns.set(tower.id, remaining);
        }
      }
    }

    this.reapDeadEnemies();

    if (this.keepHp <= 0) {
      this.status = 'defeat';
      return;
    }

    if (this.pendingSpawns.length === 0 && this.enemies.length === 0) {
      const bonus = waveClearBonus(this.wave, this.effects);
      this.gold += bonus;
      this.wavesCleared += 1;
      this.keepHp = Math.min(this.keepMaxHp, this.keepHp + this.keepMaxHp * (KEEP_REGEN_PER_WAVE_PCT + (this.effects.keepRegenPctBonus ?? 0)));
      this.status = 'ready';
      analytics.track({ name: 'wave_cleared', props: { wave: this.wave, gold: this.gold, keep_hp_pct: this.keepHp / this.keepMaxHp } });
    }
  }

  private reapDeadEnemies(): void {
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.alive) {
        survivors.push(e);
        continue;
      }
      if (e.reachedKeep) continue; // already resolved above, no gold
      this.kills += 1;
      if (e.kind === 'boss') this.bossKills += 1;
      this.gold += killGold(e.goldReward, this.effects);
    }
    this.enemies = survivors;
  }

  durationSeconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }
}
