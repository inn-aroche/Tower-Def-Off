import type { TowerDef, TowerId, TowerTierStats, T3Branch } from '../data/towers';
import { TOWERS } from '../data/towers';

let nextTowerId = 1;

export interface EffectiveTowerStats extends TowerTierStats {}

export class Tower {
  readonly id: string;
  readonly towerId: TowerId;
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  tier: 1 | 2 | 3 = 1;
  branch: T3Branch = null;
  cooldown = 0;
  disabledRemaining = 0;
  totalSpent: number;

  constructor(towerId: TowerId, col: number, row: number) {
    this.id = `t${nextTowerId++}`;
    this.towerId = towerId;
    this.def = TOWERS[towerId];
    this.col = col;
    this.row = row;
    this.totalSpent = this.def.tiers[0].cost;
  }

  get baseTierStats(): TowerTierStats {
    return this.def.tiers[this.tier - 1];
  }

  /** Tier stats plus the active T3 branch modifiers layered on top. */
  get effectiveStats(): EffectiveTowerStats {
    const base = this.baseTierStats;
    if (this.tier < 3 || !this.branch) return base;
    const mod = this.def.t3Branches.find((b) => b.id === this.branch)!;
    return {
      ...base,
      damage: base.damage * (mod.damageMul ?? 1),
      fireRatePerSec: base.fireRatePerSec * (mod.fireRateMul ?? 1),
      range: base.range + (mod.rangeAdd ?? 0),
      splashRadius: base.splashRadius + (mod.splashRadiusAdd ?? 0),
      slowPct: Math.min(0.95, base.slowPct + (mod.slowPctAdd ?? 0)),
      dotPerSecond: base.dotPerSecond + (mod.dotPerSecondAdd ?? 0),
      armorPierce: mod.armorPierceOverride ?? base.armorPierce,
    };
  }

  get activeBranchDef() {
    if (this.tier < 3 || !this.branch) return null;
    return this.def.t3Branches.find((b) => b.id === this.branch) ?? null;
  }

  costForNextTier(): number | null {
    const tier = this.tier;
    if (tier === 3 || this.def.upgradable === false) return null;
    return this.def.tiers[tier].cost;
  }

  canUpgrade(): boolean {
    return this.tier !== 3 && this.def.upgradable !== false;
  }

  upgrade(chooseBranch?: T3Branch): { spent: number } | null {
    const tier = this.tier;
    if (tier === 3) return null;
    const nextTier = this.def.tiers[tier];
    this.tier = (tier + 1) as 1 | 2 | 3;
    this.totalSpent += nextTier.cost;
    if (this.tier === 3) {
      this.branch = chooseBranch ?? this.def.t3Branches[0].id;
    }
    return { spent: nextTier.cost };
  }

  refundValue(): number {
    return Math.round(this.totalSpent * this.def.sellRefundPct);
  }

  disable(duration: number): void {
    this.disabledRemaining = Math.max(this.disabledRemaining, duration);
  }

  get isDisabled(): boolean {
    return this.disabledRemaining > 0;
  }

  tick(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.disabledRemaining > 0) this.disabledRemaining -= dt;
  }

  canFire(): boolean {
    return !this.isDisabled && this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.effectiveStats.fireRatePerSec;
  }
}
