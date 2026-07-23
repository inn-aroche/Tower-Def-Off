import { describe, expect, it } from 'vitest';
import { AppState } from '../src/app/AppState';
import { NullAnalyticsProvider } from '../src/platform/NullProviders';
import type { SaveProvider } from '../src/platform/types';
import { createDefaultSaveData, type SaveData } from '../src/meta/SaveData';
import { botUnitDefs, leagueForTrophies, LEAGUES } from '../src/data/arena';
import { UNITS_BY_ID } from '../src/data/units';

function fakeSave(): SaveProvider<SaveData> {
  let stored: SaveData | null = null;
  return { load: () => stored, save: (d) => void (stored = structuredClone(d)), clear: () => void (stored = null) };
}
const makeApp = () => new AppState(createDefaultSaveData(), fakeSave(), new NullAnalyticsProvider());

describe('leagueForTrophies', () => {
  it('maps trophy counts to the right league', () => {
    expect(leagueForTrophies(0).id).toBe('wood');
    expect(leagueForTrophies(199).id).toBe('wood');
    expect(leagueForTrophies(200).id).toBe('bronze');
    expect(leagueForTrophies(500).id).toBe('silver');
    expect(leagueForTrophies(900).id).toBe('gold');
    expect(leagueForTrophies(5000).id).toBe('platinum');
  });

  it('leagues are ordered by ascending threshold with monotonically stronger bots', () => {
    for (let i = 1; i < LEAGUES.length; i++) {
      expect(LEAGUES[i].minTrophies).toBeGreaterThan(LEAGUES[i - 1].minTrophies);
      expect(LEAGUES[i].botActIntervalSec).toBeLessThanOrEqual(LEAGUES[i - 1].botActIntervalSec);
      expect(LEAGUES[i].botPower).toBeGreaterThanOrEqual(LEAGUES[i - 1].botPower);
    }
  });
});

describe('botUnitDefs', () => {
  it('scales bot damage by league power', () => {
    const gold = LEAGUES.find((l) => l.id === 'gold')!;
    const defs = botUnitDefs(gold);
    const sword = defs.find((d) => d.id === 'swordsman')!;
    const base = UNITS_BY_ID.get('swordsman')!;
    expect(sword.levels[0].damage).toBe(Math.round(base.levels[0].damage * gold.botPower));
  });
});

describe('AppState trophies / league', () => {
  it('adds trophies (clamped at 0) and reports the current league', () => {
    const app = makeApp();
    expect(app.trophies).toBe(0);
    expect(app.currentLeague().id).toBe('wood');
    expect(app.addTrophies(250)).toBe(250);
    expect(app.currentLeague().id).toBe('bronze');
    expect(app.addTrophies(-1000)).toBe(0); // clamps, no negative trophies
    expect(app.currentLeague().id).toBe('wood');
  });
});
