import { describe, expect, it } from 'vitest';
import { AppState } from '../src/app/AppState';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from '../src/platform/NullProviders';
import type { SaveProvider } from '../src/platform/types';
import { createDefaultSaveData, migrateSaveData, SAVE_SCHEMA_VERSION, type SaveData } from '../src/meta/SaveData';
import { metaScale, scaleUnitDef, starsFor, upgradeCost } from '../src/data/meta';
import { UNITS_BY_ID } from '../src/data/units';

function fakeSave(): SaveProvider<SaveData> {
  let stored: SaveData | null = null;
  return {
    load: () => stored,
    save: (d) => {
      stored = structuredClone(d);
    },
    clear: () => {
      stored = null;
    },
  };
}

function makeApp(): AppState {
  return new AppState(createDefaultSaveData(), fakeSave(), new NullAnalyticsProvider(), new NullAdProvider(), new NullIapProvider());
}

describe('save migration', () => {
  it('migrates a v1 save: keeps soundOn, maps currentLevelIndex, seeds starter meta', () => {
    const migrated = migrateSaveData({ schemaVersion: 1, data: { settings: { soundOn: false }, campaign: { currentLevelIndex: 3 } } });
    expect(migrated.settings.soundOn).toBe(false);
    expect(migrated.campaign.unlockedNode).toBe(3);
    expect(migrated.currencies.gold).toBeGreaterThan(0);
    expect(Object.keys(migrated.collection).length).toBeGreaterThan(0);
    expect(migrated.deck.length).toBeGreaterThanOrEqual(4);
  });

  it('current default save declares the current schema version', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(8);
  });

  it('migrates a v2 save: carries state over and seeds the shop + progress blocks', () => {
    const v2 = {
      settings: { soundOn: true },
      currencies: { gold: 1234, gems: 42 },
      collection: { swordsman: { level: 4, duplicates: 9 } },
      deck: ['swordsman', 'archer', 'lancer', 'catapult'],
      campaign: { unlockedNode: 7, stars: { 0: 3 } },
      league: { trophies: 640 },
    };
    const migrated = migrateSaveData({ schemaVersion: 2, data: v2 });
    expect(migrated.currencies.gold).toBe(1234);
    expect(migrated.collection.swordsman).toEqual({ level: 4, duplicates: 9 });
    expect(migrated.campaign.unlockedNode).toBe(7);
    expect(migrated.league.trophies).toBe(640);
    expect(migrated.shop).toEqual({ chestsOpened: 0, noAds: false, passActive: false });
    expect(migrated.progress).toEqual({ tutorialSeen: false });
  });

  it('migrates a v3 save: carries shop over and seeds progress', () => {
    const fresh = createDefaultSaveData();
    const v3 = { ...fresh, shop: { chestsOpened: 5, noAds: true, passActive: true } } as unknown;
    delete (v3 as { progress?: unknown }).progress;
    delete (v3 as { survival?: unknown }).survival;
    const migrated = migrateSaveData({ schemaVersion: 3, data: v3 });
    expect(migrated.shop).toEqual({ chestsOpened: 5, noAds: true, passActive: true });
    expect(migrated.progress).toEqual({ tutorialSeen: false });
    expect(migrated.survival).toEqual({ bestWave: 0 });
  });

  it('migrates a v4 save: carries state over and seeds the survival block', () => {
    const fresh = createDefaultSaveData();
    const v4 = { ...fresh, progress: { tutorialSeen: true }, currencies: { gold: 500, gems: 20 } } as unknown;
    delete (v4 as { survival?: unknown }).survival;
    const migrated = migrateSaveData({ schemaVersion: 4, data: v4 });
    expect(migrated.progress).toEqual({ tutorialSeen: true });
    expect(migrated.currencies).toEqual({ gold: 500, gems: 20, shards: 4 });
    expect(migrated.survival).toEqual({ bestWave: 0 });
    expect(migrated.base).toEqual({ level: 1 });
  });
});

describe('AppState survival', () => {
  it('keeps the best wave and grants rewards; reports records only on improvement', () => {
    const app = makeApp();
    const gold = app.gold;
    const gems = app.gems;
    expect(app.survivalBest).toBe(0);
    expect(app.recordSurvival(7, { gold: 84, gems: 1 })).toBe(true);
    expect(app.survivalBest).toBe(7);
    expect(app.gold).toBe(gold + 84);
    expect(app.gems).toBe(gems + 1);
    // a worse run still pays out but is not a record and does not lower the best
    expect(app.recordSurvival(4, { gold: 48, gems: 0 })).toBe(false);
    expect(app.survivalBest).toBe(7);
  });
});

describe('AppState FTUE', () => {
  it('marks the tutorial as seen once', () => {
    const app = makeApp();
    expect(app.tutorialSeen).toBe(false);
    app.markTutorialSeen();
    expect(app.tutorialSeen).toBe(true);
  });
});

describe('upgrade economy', () => {
  it('upgradeCost grows and caps at max level', () => {
    expect(upgradeCost('common', 1)).toEqual({ duplicates: 2, gold: 100, shards: 0 });
    expect(upgradeCost('epic', 1)).toEqual({ duplicates: 2, gold: 250, shards: 0 });
    // Éclats join the recipe at the high end.
    expect(upgradeCost('common', 4)).toEqual({ duplicates: 14, gold: 1000, shards: 3 });
    expect(upgradeCost('common', 6)).toBeNull();
  });

  it('metaScale raises damage more than range and is identity at level 1', () => {
    expect(metaScale(1)).toEqual({ damageMult: 1, rangeMult: 1 });
    expect(metaScale(3).damageMult).toBeCloseTo(1.3);
    expect(metaScale(3).rangeMult).toBeCloseTo(1.08);
  });

  it('scaleUnitDef scales tier damage by meta-level', () => {
    const base = UNITS_BY_ID.get('swordsman')!;
    const scaled = scaleUnitDef(base, 3);
    expect(scaled.levels[0].damage).toBe(Math.round(base.levels[0].damage * 1.3));
  });
});

describe('AppState', () => {
  it('upgrades a unit by spending duplicates and gold', () => {
    const app = makeApp();
    const goldBefore = app.gold;
    expect(app.canUpgrade('swordsman')).toBe(true);
    expect(app.upgrade('swordsman')).toBe(2);
    expect(app.ownedLevel('swordsman')).toBe(2);
    expect(app.gold).toBe(goldBefore - 100);
  });

  it('refuses to upgrade without enough duplicates', () => {
    const app = makeApp();
    // guardian starts with only 1 duplicate; level 1->2 needs 2
    expect(app.canUpgrade('guardian')).toBe(false);
    expect(app.upgrade('guardian')).toBeNull();
  });

  it('enforces deck bounds and ownership', () => {
    const app = makeApp();
    expect(app.deck.length).toBe(5);
    expect(app.toggleDeck('nonexistent')).toEqual({ ok: false, reason: 'not-owned' });
    // remove down to the minimum of 4
    const first = app.deck[0];
    expect(app.toggleDeck(first).ok).toBe(true);
    expect(app.deck.length).toBe(4);
    const second = app.deck[0];
    expect(app.toggleDeck(second)).toEqual({ ok: false, reason: 'too-few' });
    // re-add first, then a 6th should be refused
    expect(app.toggleDeck(first).ok).toBe(true);
    expect(app.toggleDeck('guardian')).toEqual({ ok: false, reason: 'too-many' });
  });

  it('records a victory: grants rewards, unlocks next node, keeps best stars', () => {
    const app = makeApp();
    const gold = app.gold;
    app.recordVictory(0, 2, { gold: 100, gems: 5, duplicates: [{ unitId: 'swordsman', count: 2 }] });
    expect(app.gold).toBe(gold + 100);
    expect(app.gems).toBeGreaterThanOrEqual(5);
    expect(app.unlockedNode).toBe(1);
    expect(app.starsFor(0)).toBe(2);
    app.recordVictory(0, 1, { gold: 0, gems: 0, duplicates: [] });
    expect(app.starsFor(0)).toBe(2); // best kept
  });
});

describe('base upgrade', () => {
  it('grants extra PvE starting life per level and spends gold', () => {
    const app = makeApp();
    expect(app.baseLevel).toBe(1);
    expect(app.baseBonusLife()).toBe(0);
    const gold = app.gold;
    expect(app.canUpgradeBase()).toBe(true);
    expect(app.upgradeBase()).toBe(2);
    expect(app.gold).toBe(gold - 200); // baseUpgradeCost(1).gold = 200
    expect(app.baseBonusLife()).toBe(2);
  });
});

describe('Éclats-gated unit upgrade', () => {
  it('requires shards at high levels and blocks when short', () => {
    const app = makeApp();
    // Bring swordsman up to level 4 (needs no shards through level 3→4), stocking duplicates.
    app.addDuplicates('swordsman', 100);
    app.addGold(100000);
    expect(app.upgrade('swordsman')).toBe(2);
    expect(app.upgrade('swordsman')).toBe(3);
    expect(app.upgrade('swordsman')).toBe(4);
    // Level 4→5 needs 3 Éclats; drain them to force a refusal.
    while (app.shards > 0) app.addShards(-1);
    expect(app.canUpgrade('swordsman')).toBe(false);
    expect(app.upgrade('swordsman')).toBeNull();
    app.addShards(3);
    expect(app.upgrade('swordsman')).toBe(5);
  });
});

describe('starsFor', () => {
  it('grades on remaining life', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(6, 10)).toBe(2);
    expect(starsFor(1, 10)).toBe(1);
    expect(starsFor(0, 10)).toBe(0);
  });
});
