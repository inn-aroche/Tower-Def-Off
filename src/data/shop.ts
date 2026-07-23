import { Rng } from '../sim/Rng';
import type { Rarity } from '../sim/types';
import { UNITS } from './units';

export type ChestKind = 'common' | 'epic';

/** Real-money offers — displayed but routed through the IAP NullProvider in v1 (no live billing).
 * `product` is the store product id a real IapProvider would resolve later (M6+). */
export interface RealOffer {
  id: string;
  product: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  kind: 'pass' | 'gems' | 'gold' | 'noads';
  highlight?: boolean;
}

export const REAL_OFFERS: RealOffer[] = [
  { id: 'pass', product: 'wardens.pass.monthly', title: 'Passe Héroïque', subtitle: 'Récompenses quotidiennes + héros exclusif', priceLabel: '9,99€ / mois', kind: 'pass', highlight: true },
  { id: 'gems_100', product: 'wardens.gems.100', title: '100 Gemmes', subtitle: 'Petite bourse', priceLabel: '1,99€', kind: 'gems' },
  { id: 'gems_600', product: 'wardens.gems.600', title: '600 Gemmes', subtitle: 'Grande bourse', priceLabel: '9,99€', kind: 'gems' },
  { id: 'gold_5000', product: 'wardens.gold.5000', title: '5 000 Or', subtitle: 'Réserve du forgeron', priceLabel: '0,99€', kind: 'gold' },
  { id: 'noads', product: 'wardens.noads', title: 'Sans publicités', subtitle: 'Retire les pubs optionnelles', priceLabel: '3,99€', kind: 'noads' },
];

/** Gem-priced items — fully functional in-game (spend soft-premium gems, no real money). */
export interface GemItem {
  id: string;
  title: string;
  subtitle: string;
  gemCost: number;
  grantGold?: number;
  grantChest?: ChestKind;
}

export const GEM_ITEMS: GemItem[] = [
  { id: 'chest_common', title: 'Coffre commun', subtitle: '3 unités + or', gemCost: 40, grantChest: 'common' },
  { id: 'chest_epic', title: 'Coffre épique', subtitle: '5 unités + or, chances d’unités rares', gemCost: 150, grantChest: 'epic' },
  { id: 'gold_1000', title: '1 000 Or', subtitle: 'Échange rapide', gemCost: 15, grantGold: 1000 },
];

export interface ChestReward {
  gold: number;
  duplicates: Array<{ unitId: string; count: number }>;
}

const RARITY_WEIGHTS: Record<ChestKind, Record<Rarity, number>> = {
  common: { common: 8, rare: 3, epic: 0.4 },
  epic: { common: 3, rare: 5, epic: 2 },
};

/** Deterministic chest reward from a seed (the save's chest counter) — no ambient RNG. An epic
 * chest can roll rarer units, which is how the 5 locked units get unlocked (see AppState). */
export function openChestReward(kind: ChestKind, seed: number): ChestReward {
  const rng = new Rng(seed * 2654435761 + (kind === 'epic' ? 17 : 3));
  const picks = kind === 'epic' ? 5 : 3;
  const goldMin = kind === 'epic' ? 600 : 150;
  const goldMax = kind === 'epic' ? 1200 : 400;
  const gold = goldMin + Math.floor(rng.next() * (goldMax - goldMin));

  const weights = RARITY_WEIGHTS[kind];
  const counts = new Map<string, number>();
  for (let i = 0; i < picks; i++) {
    const unit = weightedPick(rng, weights);
    counts.set(unit, (counts.get(unit) ?? 0) + (kind === 'epic' ? 2 : 1));
  }
  return { gold, duplicates: [...counts].map(([unitId, count]) => ({ unitId, count })) };
}

function weightedPick(rng: Rng, weights: Record<Rarity, number>): string {
  const pool = UNITS.map((u) => ({ id: u.id, w: weights[u.rarity] }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = rng.next() * total;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}
