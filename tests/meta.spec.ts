import { describe, expect, it } from 'vitest';
import { AppState } from '../src/app/AppState';
import { NullAnalyticsProvider } from '../src/platform/NullProviders';
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
  return new AppState(createDefaultSaveData(), fakeSave(), new NullAnalyticsProvider());
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
    expect(SAVE_SCHEMA_VERSION).toBe(2);
  });
});

describe('upgrade economy', () => {
  it('upgradeCost grows and caps at max level', () => {
    expect(upgradeCost('common', 1)).toEqual({ duplicates: 2, gold: 100 });
    expect(upgradeCost('epic', 1)).toEqual({ duplicates: 2, gold: 250 });
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

describe('starsFor', () => {
  it('grades on remaining life', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(6, 10)).toBe(2);
    expect(starsFor(1, 10)).toBe(1);
    expect(starsFor(0, 10)).toBe(0);
  });
});
