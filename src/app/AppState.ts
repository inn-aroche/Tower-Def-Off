import type { AdProvider, AnalyticsProvider, IapProvider, SaveProvider } from '../platform/types';
import type { UnitDef } from '../sim/types';
import { UNITS, UNITS_BY_ID } from '../data/units';
import { DECK_MAX, DECK_MIN, scaleUnitDef, upgradeCost, type OwnedUnit } from '../data/meta';
import { CAMPAIGN } from '../data/campaign';
import { leagueForTrophies, type League } from '../data/arena';
import { openChestReward, type ChestKind, type ChestReward } from '../data/shop';
import { createDefaultSaveData, type SaveData } from '../meta/SaveData';

/** Single source of truth for meta state. Screens read from it and call mutators, which persist. */
export class AppState {
  constructor(
    private data: SaveData,
    private readonly save: SaveProvider<SaveData>,
    readonly analytics: AnalyticsProvider,
    readonly ads: AdProvider,
    readonly iap: IapProvider,
  ) {}

  /** Marks no-ads / pass as active after a (stubbed in v1) successful purchase. */
  applyPurchase(kind: 'noads' | 'pass'): void {
    if (kind === 'noads') this.data.shop.noAds = true;
    else this.data.shop.passActive = true;
    this.persist();
  }

  private persist(): void {
    this.save.save(this.data);
  }

  // ── Currencies ──────────────────────────────────────────────────────────
  get gold(): number {
    return this.data.currencies.gold;
  }
  get gems(): number {
    return this.data.currencies.gems;
  }
  addGold(n: number): void {
    this.data.currencies.gold += n;
    this.persist();
  }
  addGems(n: number): void {
    this.data.currencies.gems += n;
    this.persist();
  }
  spendGems(n: number): boolean {
    if (this.data.currencies.gems < n) return false;
    this.data.currencies.gems -= n;
    this.persist();
    return true;
  }

  // ── Shop / monetization ──────────────────────────────────────────────────
  get noAds(): boolean {
    return this.data.shop.noAds;
  }
  get passActive(): boolean {
    return this.data.shop.passActive;
  }
  /** Opens a chest deterministically (seeded by the chest counter), grants it, and returns the
   * reward. Duplicates of not-yet-owned units unlock them (addDuplicates creates the entry). */
  openChest(kind: ChestKind): ChestReward {
    const reward = openChestReward(kind, this.data.shop.chestsOpened);
    this.data.shop.chestsOpened += 1;
    this.data.currencies.gold += reward.gold;
    for (const d of reward.duplicates) this.addDuplicates(d.unitId, d.count);
    this.persist();
    this.analytics.track('chest_opened', { kind, gold: reward.gold });
    return reward;
  }

  // ── Collection ──────────────────────────────────────────────────────────
  isOwned(unitId: string): boolean {
    return unitId in this.data.collection;
  }
  owned(unitId: string): OwnedUnit | undefined {
    return this.data.collection[unitId];
  }
  ownedLevel(unitId: string): number {
    return this.data.collection[unitId]?.level ?? 0;
  }
  /** All units, owned first then locked, each with owned info (or null). */
  roster(): Array<{ def: UnitDef; owned: OwnedUnit | null }> {
    return UNITS.map((def) => ({ def, owned: this.data.collection[def.id] ?? null }));
  }
  ownedCount(): number {
    return Object.keys(this.data.collection).length;
  }

  addDuplicates(unitId: string, count: number): void {
    const existing = this.data.collection[unitId];
    if (existing) existing.duplicates += count;
    else this.data.collection[unitId] = { level: 1, duplicates: count };
    this.persist();
  }

  canUpgrade(unitId: string): boolean {
    const owned = this.data.collection[unitId];
    const def = UNITS_BY_ID.get(unitId);
    if (!owned || !def) return false;
    const cost = upgradeCost(def.rarity, owned.level);
    return !!cost && owned.duplicates >= cost.duplicates && this.data.currencies.gold >= cost.gold;
  }

  /** Spend duplicates + gold to raise a unit's meta-level. Returns the new level or null if refused. */
  upgrade(unitId: string): number | null {
    if (!this.canUpgrade(unitId)) return null;
    const owned = this.data.collection[unitId]!;
    const def = UNITS_BY_ID.get(unitId)!;
    const cost = upgradeCost(def.rarity, owned.level)!;
    owned.duplicates -= cost.duplicates;
    this.data.currencies.gold -= cost.gold;
    owned.level += 1;
    this.persist();
    this.analytics.track('unit_upgraded', { unitId, level: owned.level, rarity: def.rarity });
    return owned.level;
  }

  upgradeCostFor(unitId: string): { duplicates: number; gold: number } | null {
    const owned = this.data.collection[unitId];
    const def = UNITS_BY_ID.get(unitId);
    if (!owned || !def) return null;
    return upgradeCost(def.rarity, owned.level);
  }

  // ── Deck ────────────────────────────────────────────────────────────────
  get deck(): string[] {
    return [...this.data.deck];
  }
  isInDeck(unitId: string): boolean {
    return this.data.deck.includes(unitId);
  }
  /** Toggle a unit in/out of the active deck, respecting size bounds and ownership. */
  toggleDeck(unitId: string): { ok: boolean; reason?: 'not-owned' | 'too-few' | 'too-many' } {
    if (!this.isOwned(unitId)) return { ok: false, reason: 'not-owned' };
    if (this.data.deck.includes(unitId)) {
      if (this.data.deck.length <= DECK_MIN) return { ok: false, reason: 'too-few' };
      this.data.deck = this.data.deck.filter((id) => id !== unitId);
    } else {
      if (this.data.deck.length >= DECK_MAX) return { ok: false, reason: 'too-many' };
      this.data.deck.push(unitId);
    }
    this.persist();
    return { ok: true };
  }

  /** Deck UnitDefs with per-unit meta-level scaling applied — ready to hand to the combat sim. */
  scaledDeckDefs(): UnitDef[] {
    return this.data.deck.map((id) => {
      const def = UNITS_BY_ID.get(id)!;
      return scaleUnitDef(def, this.ownedLevel(id) || 1);
    });
  }

  // ── Campaign ────────────────────────────────────────────────────────────
  get unlockedNode(): number {
    return this.data.campaign.unlockedNode;
  }
  starsFor(nodeIndex: number): number {
    return this.data.campaign.stars[nodeIndex] ?? 0;
  }
  totalStars(): number {
    return Object.values(this.data.campaign.stars).reduce((a, b) => a + b, 0);
  }
  isNodeUnlocked(nodeIndex: number): boolean {
    return nodeIndex <= this.data.campaign.unlockedNode;
  }

  /** Records a node result: best-stars kept, next node unlocked on a win, rewards granted. */
  recordVictory(nodeIndex: number, stars: number, rewards: { gold: number; gems: number; duplicates: Array<{ unitId: string; count: number }> }): void {
    const prev = this.data.campaign.stars[nodeIndex] ?? 0;
    this.data.campaign.stars[nodeIndex] = Math.max(prev, stars);
    if (nodeIndex >= this.data.campaign.unlockedNode && nodeIndex + 1 < CAMPAIGN.length) {
      this.data.campaign.unlockedNode = nodeIndex + 1;
    }
    this.data.currencies.gold += rewards.gold;
    this.data.currencies.gems += rewards.gems;
    for (const d of rewards.duplicates) this.addDuplicates(d.unitId, d.count);
    this.persist();
  }

  // ── League (PvP) ────────────────────────────────────────────────────────
  get trophies(): number {
    return this.data.league.trophies;
  }
  currentLeague(): League {
    return leagueForTrophies(this.data.league.trophies);
  }
  addTrophies(n: number): number {
    this.data.league.trophies = Math.max(0, this.data.league.trophies + n);
    this.persist();
    return this.data.league.trophies;
  }

  // ── Settings ────────────────────────────────────────────────────────────
  get soundOn(): boolean {
    return this.data.settings.soundOn;
  }
  setSound(on: boolean): void {
    this.data.settings.soundOn = on;
    this.persist();
  }

  /** Wipes progression back to a fresh starter save (Settings → reset). */
  hardReset(): void {
    this.data = createDefaultSaveData();
    this.persist();
  }

  // ── FTUE ─────────────────────────────────────────────────────────────────
  get tutorialSeen(): boolean {
    return this.data.progress.tutorialSeen;
  }
  markTutorialSeen(): void {
    if (this.data.progress.tutorialSeen) return;
    this.data.progress.tutorialSeen = true;
    this.persist();
    this.analytics.track('tutorial_completed', {});
  }
}
