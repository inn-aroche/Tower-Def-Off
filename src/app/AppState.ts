import type { AdProvider, AnalyticsProvider, IapProvider, SaveProvider } from '../platform/types';
import type { UnitDef } from '../sim/types';
import { UNITS, UNITS_BY_ID } from '../data/units';
import { baseBonusLife, baseBonusSlots, baseUpgradeCost, DECK_MAX, DECK_MIN, scaleUnitDef, upgradeCost, type OwnedUnit, type UpgradeCost } from '../data/meta';
import { CAMPAIGN } from '../data/campaign';
import { leagueForTrophies, type League } from '../data/arena';
import { openChestReward, type ChestKind, type ChestReward } from '../data/shop';
import {
  ACHIEVEMENTS,
  DAILY_CHEST_REWARD,
  dailyQuestsFor,
  type Achievement,
  type AchievementMetric,
  type DailyMetric,
  type DailyQuest,
} from '../data/progression';
import { HEROES, HEROES_BY_ID, heroPromoteCost, scaleHeroConfig, type HeroDef } from '../data/heroes';
import type { HeroConfig } from '../sim/types';
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
  get shards(): number {
    return this.data.currencies.shards;
  }
  addShards(n: number): void {
    this.data.currencies.shards += n;
    this.persist();
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
    // Chests are the main Éclats source (epic chests give more).
    this.data.currencies.shards += kind === 'epic' ? 3 : 1;
    // Hero cards cycle across heroes so they unlock and promote over time.
    const heroId = HEROES[this.data.shop.chestsOpened % HEROES.length].id;
    this.addHeroCards(heroId, kind === 'epic' ? 2 : 1);
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
    return (
      !!cost &&
      owned.duplicates >= cost.duplicates &&
      this.data.currencies.gold >= cost.gold &&
      this.data.currencies.shards >= cost.shards
    );
  }

  /** Spend duplicates (cards) + gold + Éclats to raise a unit's meta-level. Returns the new level or null. */
  upgrade(unitId: string): number | null {
    if (!this.canUpgrade(unitId)) return null;
    const owned = this.data.collection[unitId]!;
    const def = UNITS_BY_ID.get(unitId)!;
    const cost = upgradeCost(def.rarity, owned.level)!;
    owned.duplicates -= cost.duplicates;
    this.data.currencies.gold -= cost.gold;
    this.data.currencies.shards -= cost.shards;
    owned.level += 1;
    this.persist();
    this.analytics.track('unit_upgraded', { unitId, level: owned.level, rarity: def.rarity });
    return owned.level;
  }

  upgradeCostFor(unitId: string): UpgradeCost | null {
    const owned = this.data.collection[unitId];
    const def = UNITS_BY_ID.get(unitId);
    if (!owned || !def) return null;
    return upgradeCost(def.rarity, owned.level);
  }

  // ── Base (fortress) ───────────────────────────────────────────────────────
  get baseLevel(): number {
    return this.data.base.level;
  }
  /** Extra starting life the base grants in PvE (campaign + survival). */
  baseBonusLife(): number {
    return baseBonusLife(this.data.base.level);
  }

  /** Extra defense emplacements from the base upgrade (PvE only). */
  baseBonusSlots(): number {
    return baseBonusSlots(this.data.base.level);
  }
  baseUpgradeCostFor(): { gold: number; shards: number } | null {
    return baseUpgradeCost(this.data.base.level);
  }
  canUpgradeBase(): boolean {
    const cost = baseUpgradeCost(this.data.base.level);
    return !!cost && this.data.currencies.gold >= cost.gold && this.data.currencies.shards >= cost.shards;
  }
  /** Spends gold (+ Éclats at higher tiers) to raise the base level. Returns the new level or null. */
  upgradeBase(): number | null {
    if (!this.canUpgradeBase()) return null;
    const cost = baseUpgradeCost(this.data.base.level)!;
    this.data.currencies.gold -= cost.gold;
    this.data.currencies.shards -= cost.shards;
    this.data.base.level += 1;
    this.persist();
    this.analytics.track('base_upgraded', { level: this.data.base.level });
    return this.data.base.level;
  }

  // ── Heroes ────────────────────────────────────────────────────────────────
  get activeHeroId(): string {
    return this.data.heroes.active;
  }
  isHeroOwned(id: string): boolean {
    return id in this.data.heroes.owned;
  }
  heroLevel(id: string): number {
    return this.data.heroes.owned[id]?.level ?? 0;
  }
  heroCards(id: string): number {
    return this.data.heroes.owned[id]?.cards ?? 0;
  }
  /** All heroes with ownership + progression info (for the hero screen). */
  heroRoster(): Array<{ def: HeroDef; owned: boolean; level: number; cards: number; active: boolean }> {
    return HEROES.map((def) => ({
      def,
      owned: this.isHeroOwned(def.id),
      level: this.heroLevel(def.id),
      cards: this.heroCards(def.id),
      active: this.data.heroes.active === def.id,
    }));
  }
  /** Combat config for the active hero at its current level, or null if none owned/active. */
  activeHeroConfig(): HeroConfig | null {
    const id = this.data.heroes.active;
    const def = HEROES_BY_ID.get(id);
    if (!def || !this.isHeroOwned(id)) return null;
    return scaleHeroConfig(def, this.heroLevel(id));
  }
  /** Sets the active hero (only if owned). */
  selectHero(id: string): boolean {
    if (!this.isHeroOwned(id)) return false;
    this.data.heroes.active = id;
    this.persist();
    return true;
  }
  /** Adds hero cards; a not-yet-owned hero unlocks at level 1 on its first card. */
  addHeroCards(id: string, count: number): void {
    if (!HEROES_BY_ID.has(id)) return;
    const owned = this.data.heroes.owned[id];
    if (owned) owned.cards += count;
    else this.data.heroes.owned[id] = { level: 1, cards: count };
    this.persist();
  }
  heroPromoteCostFor(id: string): { cards: number; gold: number } | null {
    if (!this.isHeroOwned(id)) return null;
    return heroPromoteCost(this.heroLevel(id));
  }
  canPromoteHero(id: string): boolean {
    const owned = this.data.heroes.owned[id];
    const cost = owned ? heroPromoteCost(owned.level) : null;
    return !!owned && !!cost && owned.cards >= cost.cards && this.data.currencies.gold >= cost.gold;
  }
  /** Spends cards + gold to raise a hero's level. Returns the new level or null. */
  promoteHero(id: string): number | null {
    if (!this.canPromoteHero(id)) return null;
    const owned = this.data.heroes.owned[id]!;
    const cost = heroPromoteCost(owned.level)!;
    owned.cards -= cost.cards;
    this.data.currencies.gold -= cost.gold;
    owned.level += 1;
    this.persist();
    this.analytics.track('hero_promoted', { id, level: owned.level });
    return owned.level;
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

  // ── Survival (endless) ────────────────────────────────────────────────────
  get survivalBest(): number {
    return this.data.survival.bestWave;
  }
  /** Records a survival run: keeps the best wave, grants rewards, returns whether it's a new record. */
  recordSurvival(wavesReached: number, rewards: { gold: number; gems: number }): boolean {
    const isRecord = wavesReached > this.data.survival.bestWave;
    if (isRecord) this.data.survival.bestWave = wavesReached;
    this.data.currencies.gold += rewards.gold;
    this.data.currencies.gems += rewards.gems;
    this.persist();
    this.analytics.track('survival_end', { wavesReached, isRecord });
    return isRecord;
  }

  // ── Progression : succès, quêtes journalières, coffre quotidien ───────────
  /** Records the outcome of any combat into lifetime stats and today's daily counters. */
  recordCombatEnd(r: { won: boolean; kills: number; merges: number; pvp: boolean; blitz: boolean }, today: string): void {
    const p = this.data.progression;
    if (r.won) p.stats.combatsWon += 1;
    p.stats.enemiesKilled += r.kills;
    p.stats.merges += r.merges;
    if (r.pvp && r.won) p.stats.pvpWins += 1;
    this.rollDaily(today);
    if (r.won) p.daily.wins += 1;
    p.daily.kills += r.kills;
    if (r.blitz) p.daily.blitz += 1;
    this.persist();
  }

  private rollDaily(today: string): void {
    const d = this.data.progression.daily;
    if (d.date !== today) {
      this.data.progression.daily = { date: today, wins: 0, kills: 0, blitz: 0, claimed: [] };
    }
  }

  private achievementValue(metric: AchievementMetric): number {
    const s = this.data.progression.stats;
    switch (metric) {
      case 'combatsWon': return s.combatsWon;
      case 'enemiesKilled': return s.enemiesKilled;
      case 'pvpWins': return s.pvpWins;
      case 'merges': return s.merges;
      case 'survivalBest': return this.data.survival.bestWave;
      case 'trophies': return this.data.league.trophies;
      case 'unitsOwned': return this.ownedCount();
    }
  }

  /** All achievements with current value + claim state (for the Défis screen). */
  achievements(): Array<{ ach: Achievement; value: number; done: boolean; claimed: boolean }> {
    return ACHIEVEMENTS.map((ach) => {
      const value = this.achievementValue(ach.metric);
      return { ach, value, done: value >= ach.target, claimed: this.data.progression.achievements.includes(ach.id) };
    });
  }

  /** Grants an achievement reward if reached and not already claimed. */
  claimAchievement(id: string): boolean {
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return false;
    const p = this.data.progression;
    if (p.achievements.includes(id)) return false;
    if (this.achievementValue(ach.metric) < ach.target) return false;
    p.achievements.push(id);
    this.data.currencies.gold += ach.reward.gold;
    this.data.currencies.gems += ach.reward.gems;
    this.persist();
    this.analytics.track('achievement_claimed', { id });
    return true;
  }

  private dailyValue(metric: DailyMetric): number {
    const d = this.data.progression.daily;
    return metric === 'wins' ? d.wins : metric === 'kills' ? d.kills : d.blitz;
  }

  /** Today's 3 quests with progress + claim state. */
  dailyQuests(today: string): Array<{ quest: DailyQuest; value: number; done: boolean; claimed: boolean }> {
    this.rollDaily(today);
    return dailyQuestsFor(today).map((quest) => {
      const value = this.dailyValue(quest.metric);
      return { quest, value, done: value >= quest.target, claimed: this.data.progression.daily.claimed.includes(quest.id) };
    });
  }

  claimDailyQuest(id: string, today: string): boolean {
    this.rollDaily(today);
    const quest = dailyQuestsFor(today).find((q) => q.id === id);
    if (!quest) return false;
    const d = this.data.progression.daily;
    if (d.claimed.includes(id) || this.dailyValue(quest.metric) < quest.target) return false;
    d.claimed.push(id);
    this.data.currencies.gold += quest.reward.gold;
    this.data.currencies.gems += quest.reward.gems;
    this.persist();
    this.analytics.track('daily_quest_claimed', { id });
    return true;
  }

  dailyChestAvailable(today: string): boolean {
    return this.data.progression.chestDate !== today;
  }

  /** Claims the free daily chest once per day; returns the reward or null if already taken. */
  claimDailyChest(today: string): { gold: number; gems: number } | null {
    if (!this.dailyChestAvailable(today)) return null;
    this.data.progression.chestDate = today;
    this.data.currencies.gold += DAILY_CHEST_REWARD.gold;
    this.data.currencies.gems += DAILY_CHEST_REWARD.gems;
    this.persist();
    this.analytics.track('daily_chest_claimed', {});
    return { ...DAILY_CHEST_REWARD };
  }

  /** True if anything (chest, a quest, an achievement) can be claimed right now — drives the hub badge. */
  hasClaimable(today: string): boolean {
    if (this.dailyChestAvailable(today)) return true;
    if (this.dailyQuests(today).some((q) => q.done && !q.claimed)) return true;
    return this.achievements().some((a) => a.done && !a.claimed);
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
