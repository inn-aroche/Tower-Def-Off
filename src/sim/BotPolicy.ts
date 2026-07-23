import type { CombatSim } from './CombatSim';
import { isPathCell } from './Path';
import type { Cell, CombatSnapshot, UnitDef } from './types';

/** Grass cells (non-path, in bounds) ranked by proximity to the path — best shooting spots first. */
export function rankedGrassCells(path: Cell[], cols: number, rows: number): Cell[] {
  const cells: Array<{ col: number; row: number; d: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isPathCell(path, col, row)) continue;
      let best = Infinity;
      for (const p of path) best = Math.min(best, Math.hypot(col - p.col, row - p.row));
      cells.push({ col, row, d: best });
    }
  }
  cells.sort((a, b) => a.d - b.d);
  return cells.map(({ col, row }) => ({ col, row }));
}

/** Buy a card that pairs with a lone level-1 unit (enables a merge), else the cheapest affordable. */
export function chooseCard(snapshot: CombatSnapshot): string | null {
  const affordable = snapshot.hand.filter((c) => c.affordable);
  if (affordable.length === 0) return null;
  const lvl1 = new Map<string, number>();
  for (const u of snapshot.units) if (u.level === 1) lvl1.set(u.unitId, (lvl1.get(u.unitId) ?? 0) + 1);
  const pairable = affordable.filter((c) => (lvl1.get(c.unitId) ?? 0) % 2 === 1);
  const pool = pairable.length > 0 ? pairable : affordable;
  return pool.reduce((best, c) => (c.cost < best.cost ? c : best)).unitId;
}

export function tryGreedyMerge(sim: CombatSim, snapshot: CombatSnapshot): boolean {
  const units = snapshot.units;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      if (units[i].unitId === units[j].unitId && units[i].level === units[j].level) {
        if (sim.merge({ col: units[i].col, row: units[i].row }, { col: units[j].col, row: units[j].row }).ok) return true;
      }
    }
  }
  return false;
}

/**
 * Scripted opponent that drives a CombatSim. Its `actIntervalSec` (reaction speed) is the main
 * skill knob — higher = weaker. Used identically by the live PvP screen and the headless sims,
 * so what the balance scripts validate is exactly what a player faces.
 */
export class BotDriver {
  private readonly grass: Cell[];
  private readonly cost: Map<string, number>;
  private nextActAt = 0;

  constructor(
    private readonly sim: CombatSim,
    _deck: string[],
    unitDefs: UnitDef[],
    path: Cell[],
    cols: number,
    rows: number,
    private readonly actIntervalSec: number,
  ) {
    this.grass = rankedGrassCells(path, cols, rows);
    this.cost = new Map(unitDefs.map((u) => [u.id, u.cost]));
  }

  /** Call once per tick with the sim's current elapsed time. */
  update(elapsedSec: number): void {
    if (elapsedSec < this.nextActAt) return;
    this.nextActAt = elapsedSec + this.actIntervalSec;

    let snap = this.sim.snapshot();
    if (snap.outcome !== 'ongoing') return;
    tryGreedyMerge(this.sim, snap);

    snap = this.sim.snapshot();
    const unitId = chooseCard(snap);
    if (unitId === null || snap.mana < (this.cost.get(unitId) ?? Infinity)) return;
    const occupied = new Set(snap.units.map((u) => `${u.col},${u.row}`));
    const cell = this.grass.find((g) => !occupied.has(`${g.col},${g.row}`));
    if (cell) this.sim.summon(unitId, cell.col, cell.row);
  }
}
