import { describe, expect, it } from 'vitest';
import { UNITS, UNITS_BY_ID, OFFENSE_UNIT_IDS } from '../src/data/units';
import { UNIT_SPRITES } from '../src/render/sprites';
import { unitArtId, unitArtUri } from '../src/render/unitArt';

describe('unit art resolver', () => {
  it('gives every unit of the roster an illustration', () => {
    for (const def of UNITS) {
      expect(unitArtUri(def.id, def.family, def.rarity), `no art for ${def.id}`).toBeTruthy();
    }
  });

  it('keeps a unit that owns a sprite on its own art', () => {
    for (const id of Object.keys(UNIT_SPRITES)) {
      const def = UNITS_BY_ID.get(id);
      if (!def) continue; // enemy/tile/fx keys live in their own tables
      expect(unitArtId(def.id, def.family, def.rarity)).toBe(def.id);
    }
  });

  it('borrows only from the same family', () => {
    for (const def of UNITS) {
      const art = unitArtId(def.id, def.family, def.rarity)!;
      expect(UNITS_BY_ID.get(art)!.family).toBe(def.family);
    }
  });

  it('never lends offensive art to a defensive unit', () => {
    const offense = new Set(OFFENSE_UNIT_IDS);
    for (const def of UNITS) {
      if (def.role === 'offense') continue;
      expect(offense.has(unitArtId(def.id, def.family, def.rarity)!)).toBe(false);
    }
  });

  it('is deterministic — the same unit resolves to the same art every call', () => {
    const first = UNITS.map((d) => unitArtId(d.id, d.family, d.rarity));
    const second = UNITS.map((d) => unitArtId(d.id, d.family, d.rarity));
    expect(second).toEqual(first);
  });

  it('spreads the borrowed art rather than collapsing onto one sprite', () => {
    const used = new Set(UNITS.map((d) => unitArtId(d.id, d.family, d.rarity)));
    expect(used.size).toBeGreaterThanOrEqual(10);
  });
});
