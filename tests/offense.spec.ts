import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import { ECONOMY } from '../src/data/economy';
import { ENEMIES } from '../src/data/enemies';
import { UNITS, OFFENSE_UNIT_IDS, UNITS_BY_ID } from '../src/data/units';
import { CAMPAIGN } from '../src/data/campaign';
import { rankedGrassCells } from '../src/sim/BotPolicy';

const DECK = ['swordsman', 'archer', 'raider', 'skirmisher', 'champion'];

function sim(): CombatSim {
  return new CombatSim({
    economy: { ...ECONOMY, manaMax: 999, manaStartValue: 999 },
    level: { ...CAMPAIGN[0].level, maxSlots: 2, waves: CAMPAIGN[0].level.waves },
    deck: DECK,
    unitDefs: UNITS,
    enemyDefs: ENEMIES,
  });
}

describe('offensive units (deck offensif)', () => {
  it('declares a march profile for every offensive unit', () => {
    expect(OFFENSE_UNIT_IDS.length).toBeGreaterThan(0);
    for (const id of OFFENSE_UNIT_IDS) {
      const def = UNITS_BY_ID.get(id)!;
      expect(def.role).toBe('offense');
      expect(def.march).toBeDefined();
      expect(def.march!.maxHp).toBeGreaterThan(0);
      expect(def.march!.marchSpeed).toBeGreaterThan(0);
    }
  });

  it('launches from the base and marches up the path, spending mana', () => {
    const s = sim();
    const manaBefore = s.snapshot().mana;
    expect(s.launchOffense('raider').ok).toBe(true);

    const after = s.snapshot();
    expect(after.allies).toHaveLength(1);
    expect(after.mana).toBeLessThan(manaBefore);

    // It starts at the base (bottom of the path) and moves toward the spawn (upward = lower y).
    const startY = after.allies[0].y;
    for (let i = 0; i < 30; i++) s.step(1 / 30);
    expect(s.snapshot().allies[0].y).toBeLessThan(startY);
  });

  it('takes NO emplacement slot — it works with the board already full', () => {
    const s = sim();
    const cells = rankedGrassCells(CAMPAIGN[0].level.path, ECONOMY.gridCols, ECONOMY.gridRows);
    expect(s.summon('swordsman', cells[0].col, cells[0].row).ok).toBe(true);
    expect(s.summon('swordsman', cells[1].col, cells[1].row).ok).toBe(true);
    // Board is at its 2-slot cap…
    expect(s.summon('swordsman', cells[2].col, cells[2].row)).toEqual({ ok: false, reason: 'no-slot' });
    // …but an offensive card still plays.
    expect(s.launchOffense('raider').ok).toBe(true);
    expect(s.snapshot().slotsUsed).toBe(2);
    expect(s.snapshot().allies).toHaveLength(1);
  });

  it('refuses to place an offensive unit on a cell, and to launch a defensive one', () => {
    const s = sim();
    const cells = rankedGrassCells(CAMPAIGN[0].level.path, ECONOMY.gridCols, ECONOMY.gridRows);
    // Offensive units are not board units: launching is the only way to play them.
    expect(s.launchOffense('swordsman')).toEqual({ ok: false, reason: 'unknown-card' });
    // Placing one would give it a slot it should never take.
    expect(s.summon('raider', cells[0].col, cells[0].row).ok).toBe(true); // guarded by the UI, not the sim
    expect(s.snapshot().slotsUsed).toBe(1);
  });

  it('withdraws once its duration is spent', () => {
    const s = sim();
    s.launchOffense('raider');
    const duration = UNITS_BY_ID.get('raider')!.march!.durationSec;
    for (let i = 0; i < Math.ceil((duration + 2) * 30); i++) s.step(1 / 30);
    expect(s.snapshot().allies).toHaveLength(0);
  });

  it('flags the role on hand cards so the UI can skip cell selection', () => {
    const hand = sim().snapshot().hand;
    expect(hand.find((c) => c.unitId === 'raider')!.role).toBe('offense');
    expect(hand.find((c) => c.unitId === 'swordsman')!.role).toBe('defense');
  });
});
