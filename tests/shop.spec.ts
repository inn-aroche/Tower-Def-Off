import { describe, expect, it } from 'vitest';
import { AppState } from '../src/app/AppState';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from '../src/platform/NullProviders';
import type { SaveProvider } from '../src/platform/types';
import { createDefaultSaveData, type SaveData } from '../src/meta/SaveData';
import { openChestReward } from '../src/data/shop';

function fakeSave(): SaveProvider<SaveData> {
  let stored: SaveData | null = null;
  return { load: () => stored, save: (d) => void (stored = structuredClone(d)), clear: () => void (stored = null) };
}
const makeApp = () =>
  new AppState(createDefaultSaveData(), fakeSave(), new NullAnalyticsProvider(), new NullAdProvider(), new NullIapProvider());

describe('openChestReward', () => {
  it('is deterministic for a given kind + seed', () => {
    expect(openChestReward('common', 5)).toEqual(openChestReward('common', 5));
    expect(openChestReward('epic', 5)).toEqual(openChestReward('epic', 5));
  });

  it('epic chests grant more gold and more duplicate picks than common', () => {
    const common = openChestReward('common', 3);
    const epic = openChestReward('epic', 3);
    expect(epic.gold).toBeGreaterThan(common.gold);
    const commonPicks = common.duplicates.reduce((s, d) => s + d.count, 0);
    const epicPicks = epic.duplicates.reduce((s, d) => s + d.count, 0);
    expect(epicPicks).toBeGreaterThan(commonPicks);
  });
});

describe('AppState shop', () => {
  it('spends gems and refuses when short', () => {
    const app = makeApp();
    const gems = app.gems;
    expect(app.spendGems(gems + 1)).toBe(false);
    expect(app.gems).toBe(gems);
    expect(app.spendGems(10)).toBe(true);
    expect(app.gems).toBe(gems - 10);
  });

  it('opening a chest grants gold + duplicates and advances the counter', () => {
    const app = makeApp();
    const gold = app.gold;
    const reward = app.openChest('common');
    expect(app.gold).toBe(gold + reward.gold);
    // second open uses the next counter -> different seed, so may differ
    const reward2 = app.openChest('common');
    expect(reward2).toEqual(openChestReward('common', 1));
  });

  it('a chest duplicate can unlock a previously-locked unit', () => {
    const app = makeApp();
    // storm_caller is not in the starter collection
    expect(app.isOwned('storm_caller')).toBe(false);
    app.addDuplicates('storm_caller', 1);
    expect(app.isOwned('storm_caller')).toBe(true);
    expect(app.ownedLevel('storm_caller')).toBe(1);
  });

  it('applyPurchase flips no-ads / pass flags', () => {
    const app = makeApp();
    expect(app.noAds).toBe(false);
    app.applyPurchase('noads');
    expect(app.noAds).toBe(true);
    app.applyPurchase('pass');
    expect(app.passActive).toBe(true);
  });
});
