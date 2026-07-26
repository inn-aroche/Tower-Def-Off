import { describe, expect, it } from 'vitest';
import { UNITS, UNITS_BY_ID, DEFAULT_DECK, abilityLabel } from '../src/data/units';

describe('unit roster', () => {
  it('has 100 units with unique ids and non-empty names', () => {
    expect(UNITS).toHaveLength(100);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(100);
    for (const u of UNITS) {
      expect(u.name.length).toBeGreaterThan(0);
      // Defenses merge across 3 board tiers; offensive units never merge, so they carry a single tier.
      expect(u.levels).toHaveLength(u.role === 'offense' ? 1 : 3);
      expect(['common', 'rare', 'epic']).toContain(u.rarity);
    }
  });

  it('names are unique (no confusing duplicates)', () => {
    expect(new Set(UNITS.map((u) => u.name)).size).toBe(100);
  });

  it('keeps the hand-tuned core units and default deck intact', () => {
    for (const id of ['swordsman', 'archer', 'lancer', 'catapult', 'gravity_well', 'storm_caller', 'guardian', 'frost_archer']) {
      expect(UNITS_BY_ID.has(id)).toBe(true);
    }
    for (const id of DEFAULT_DECK) expect(UNITS_BY_ID.has(id)).toBe(true);
  });

  it('gravity units have zero damage and a slow field; damage units deal damage', () => {
    for (const u of UNITS) {
      if (u.family === 'gravity') {
        expect(u.levels[0].damage).toBe(0);
        expect(u.levels[0].slowFactor).toBeLessThan(1);
      } else {
        expect(u.levels[0].damage).toBeGreaterThan(0);
      }
    }
  });

  it('abilityLabel returns a description for units that have an ability', () => {
    const withAbility = UNITS.find((u) => u.ability);
    expect(withAbility).toBeDefined();
    expect(abilityLabel(withAbility!)).not.toBeNull();
  });
});
