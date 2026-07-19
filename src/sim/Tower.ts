import type { TowerKind, TowerTier } from '../data/towers';
import { TOWERS } from '../data/towers';

let nextId = 1;

export class Tower {
  readonly id: number;
  readonly kind: TowerKind;
  readonly col: number;
  readonly row: number;
  tier: 1 | 2 | 3 = 1;
  cooldown = 0;
  totalInvested: number;

  constructor(kind: TowerKind, col: number, row: number, buildCost: number) {
    this.id = nextId++;
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.totalInvested = buildCost;
  }

  get def(): TowerTier {
    return TOWERS[this.kind].tiers[this.tier - 1];
  }

  canUpgrade(): boolean {
    return this.tier < 3;
  }

  applyUpgrade(cost: number): void {
    this.tier = (this.tier + 1) as 1 | 2 | 3;
    this.totalInvested += cost;
  }
}
