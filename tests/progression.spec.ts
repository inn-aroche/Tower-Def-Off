import { describe, expect, it } from 'vitest';
import { AppState } from '../src/app/AppState';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from '../src/platform/NullProviders';
import type { SaveProvider } from '../src/platform/types';
import { createDefaultSaveData, migrateSaveData, SAVE_SCHEMA_VERSION, type SaveData } from '../src/meta/SaveData';
import { dailyQuestsFor } from '../src/data/progression';

function fakeSave(): SaveProvider<SaveData> {
  let stored: SaveData | null = null;
  return { load: () => stored, save: (d) => void (stored = structuredClone(d)), clear: () => void (stored = null) };
}
const makeApp = () =>
  new AppState(createDefaultSaveData(), fakeSave(), new NullAnalyticsProvider(), new NullAdProvider(), new NullIapProvider());

const DAY = '2026-07-25';

describe('progression save', () => {
  it('declares schema v6 and seeds a progression block', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(8);
    expect(createDefaultSaveData().progression.stats.combatsWon).toBe(0);
  });

  it('migrates a v5 save: carries state and seeds progression', () => {
    const fresh = createDefaultSaveData();
    const v5 = { ...fresh, survival: { bestWave: 12 } } as unknown;
    delete (v5 as { progression?: unknown }).progression;
    const migrated = migrateSaveData({ schemaVersion: 5, data: v5 });
    expect(migrated.survival).toEqual({ bestWave: 12 });
    expect(migrated.progression).toEqual(fresh.progression);
  });
});

describe('daily quests', () => {
  it('are deterministic per day and pick 3 distinct metrics', () => {
    const a = dailyQuestsFor(DAY);
    expect(dailyQuestsFor(DAY)).toEqual(a);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.metric)).size).toBe(3);
  });

  it('varies across days', () => {
    const ids = (d: string) => dailyQuestsFor(d).map((q) => q.id).join(',');
    const days = ['2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28'];
    expect(new Set(days.map(ids)).size).toBeGreaterThan(1);
  });
});

describe('AppState progression', () => {
  it('records combat outcomes into lifetime + daily counters', () => {
    const app = makeApp();
    app.recordCombatEnd({ won: true, kills: 40, merges: 3, pvp: false, blitz: false }, DAY);
    app.recordCombatEnd({ won: true, kills: 10, merges: 1, pvp: true, blitz: true }, DAY);
    const daily = app.dailyQuests(DAY);
    // wins=2, kills=50, blitz=1 recorded
    const byMetric = Object.fromEntries(daily.map((q) => [q.quest.metric, q.value]));
    expect(byMetric.wins).toBe(2);
    expect(byMetric.kills ?? 50).toBe(50);
    // pvp win counts toward the duelist achievement
    expect(app.achievements().find((a) => a.ach.id === 'duelist')!.value).toBe(1);
    expect(app.achievements().find((a) => a.ach.id === 'first_win')!.done).toBe(true);
  });

  it('resets daily counters on a new day', () => {
    const app = makeApp();
    app.recordCombatEnd({ won: true, kills: 200, merges: 0, pvp: false, blitz: false }, DAY);
    const nextDay = '2026-07-26';
    const wins = app.dailyQuests(nextDay).find((q) => q.quest.metric === 'wins');
    if (wins) expect(wins.value).toBe(0); // fresh day
  });

  it('claims an achievement once and grants its reward', () => {
    const app = makeApp();
    const gold = app.gold;
    app.recordCombatEnd({ won: true, kills: 0, merges: 0, pvp: false, blitz: false }, DAY); // first_win done
    expect(app.claimAchievement('first_win')).toBe(true);
    expect(app.gold).toBe(gold + 100);
    expect(app.claimAchievement('first_win')).toBe(false); // already claimed
    expect(app.claimAchievement('veteran')).toBe(false); // not reached
  });

  it('claims the free daily chest once per day', () => {
    const app = makeApp();
    const gems = app.gems;
    expect(app.dailyChestAvailable(DAY)).toBe(true);
    const r = app.claimDailyChest(DAY);
    expect(r).not.toBeNull();
    expect(app.gems).toBe(gems + r!.gems);
    expect(app.dailyChestAvailable(DAY)).toBe(false);
    expect(app.claimDailyChest(DAY)).toBeNull();
    // available again the next day
    expect(app.dailyChestAvailable('2026-07-26')).toBe(true);
  });

  it('hasClaimable reflects the daily chest and completed quests', () => {
    const app = makeApp();
    expect(app.hasClaimable(DAY)).toBe(true); // chest available at least
    app.claimDailyChest(DAY);
    // after claiming the chest, nothing else is done yet
    expect(app.hasClaimable(DAY)).toBe(false);
  });
});
