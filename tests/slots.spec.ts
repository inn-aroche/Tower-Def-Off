import { describe, expect, it } from 'vitest';
import { CombatSim } from '../src/sim/CombatSim';
import { ECONOMY } from '../src/data/economy';
import { ENEMIES } from '../src/data/enemies';
import { UNITS, DEFAULT_DECK } from '../src/data/units';
import { CAMPAIGN, maxSlotsForNode } from '../src/data/campaign';
import { baseBonusSlots } from '../src/data/meta';
import { rankedGrassCells } from '../src/sim/BotPolicy';
import type { LevelDef } from '../src/sim/types';

/** A level with a deliberately tiny emplacements budget, so the cap is easy to hit in a test. */
function cappedLevel(maxSlots: number): LevelDef {
  return { ...CAMPAIGN[0].level, maxSlots, waves: [] };
}

function simWith(maxSlots: number): CombatSim {
  return new CombatSim({
    economy: { ...ECONOMY, manaMax: 999, manaStartValue: 999 },
    level: cappedLevel(maxSlots),
    deck: DEFAULT_DECK,
    unitDefs: UNITS,
    enemyDefs: ENEMIES,
  });
}

describe('emplacements (slot cap)', () => {
  it('refuses a summon once the board holds maxSlots defenses', () => {
    const sim = simWith(3);
    const cells = rankedGrassCells(CAMPAIGN[0].level.path, ECONOMY.gridCols, ECONOMY.gridRows);
    for (let i = 0; i < 3; i++) {
      expect(sim.summon('swordsman', cells[i].col, cells[i].row).ok).toBe(true);
    }
    const overflow = sim.summon('swordsman', cells[3].col, cells[3].row);
    expect(overflow).toEqual({ ok: false, reason: 'no-slot' });
    expect(sim.snapshot().slotsUsed).toBe(3);
    expect(sim.snapshot().maxSlots).toBe(3);
  });

  it('merging frees a slot, so a full board can build again', () => {
    const sim = simWith(2);
    const cells = rankedGrassCells(CAMPAIGN[0].level.path, ECONOMY.gridCols, ECONOMY.gridRows);
    sim.summon('swordsman', cells[0].col, cells[0].row);
    sim.summon('swordsman', cells[1].col, cells[1].row);
    expect(sim.summon('swordsman', cells[2].col, cells[2].row)).toEqual({ ok: false, reason: 'no-slot' });

    expect(sim.merge({ col: cells[0].col, row: cells[0].row }, { col: cells[1].col, row: cells[1].row }).ok).toBe(true);
    expect(sim.snapshot().slotsUsed).toBe(1);
    expect(sim.summon('swordsman', cells[2].col, cells[2].row).ok).toBe(true);
  });

  it('leaves placement unlimited when a level declares no cap', () => {
    const sim = new CombatSim({
      economy: { ...ECONOMY, manaMax: 999, manaStartValue: 999 },
      level: { ...CAMPAIGN[0].level, maxSlots: undefined, waves: [] },
      deck: DEFAULT_DECK,
      unitDefs: UNITS,
      enemyDefs: ENEMIES,
    });
    expect(sim.snapshot().maxSlots).toBeNull();
    const cells = rankedGrassCells(CAMPAIGN[0].level.path, ECONOMY.gridCols, ECONOMY.gridRows);
    for (let i = 0; i < 20; i++) expect(sim.summon('swordsman', cells[i].col, cells[i].row).ok).toBe(true);
  });

  it('gives every campaign node a cap, with boss nodes one slot wider', () => {
    for (const node of CAMPAIGN) {
      expect(node.level.maxSlots).toBe(maxSlotsForNode(node.index));
      expect(node.level.maxSlots).toBeGreaterThan(0);
    }
    const boss = CAMPAIGN.find((n) => n.isBoss)!;
    const plain = CAMPAIGN.find((n) => !n.isBoss)!;
    expect(boss.level.maxSlots!).toBeGreaterThan(plain.level.maxSlots!);
  });

  it('widens the budget as the base is upgraded (PvE meta answer to the cap)', () => {
    expect(baseBonusSlots(1)).toBe(0);
    expect(baseBonusSlots(3)).toBe(1);
    expect(baseBonusSlots(8)).toBe(3);
  });
});
