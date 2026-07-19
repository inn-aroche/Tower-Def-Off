/**
 * Headless balance validation — required by the studio-jeu-mobile skill before any tuning is
 * trusted ("aucun tuning sans re-simulation").
 *
 * M1 has no PvP bots yet (that lands in M4), so this validates the one thing M1 introduces: is
 * the PvE campaign curve winnable-but-non-trivial for a competent-but-simple scripted player?
 * Per-unit-family win-rate validation (bots vs bots, 50±7%) is the M4 concern once the same
 * engine plays both sides — deferred and tracked in decisions.md, not silently dropped.
 */
import { CombatSim } from '../src/sim/CombatSim';
import { ECONOMY } from '../src/data/economy';
import { UNITS, DEFAULT_DECK } from '../src/data/units';
import { ENEMIES } from '../src/data/enemies';
import { LEVELS } from '../src/data/levels';
import type { CombatSnapshot, LevelDef } from '../src/sim/types';

const SEEDS_PER_LEVEL = 40;
const DT = 1 / 30;
const MAX_SIM_SECONDS = 5 * 60;

/**
 * Deterministic placement heuristic standing in for "a reasonable player": spread defenders
 * across the least-covered lane first, and prefer rows 2+ — row 0/1 windows get clipped against
 * the top edge (range can't extend past row 0), wasting most of a unit's range there.
 */
function chooseSummonCell(snapshot: CombatSnapshot): { col: number; row: number } | null {
  const occupied = new Set(snapshot.units.map((u) => `${u.col},${u.row}`));
  const colCounts = new Array(ECONOMY.gridCols).fill(0);
  for (const u of snapshot.units) colCounts[u.col]++;
  const colsByLoad = [...Array(ECONOMY.gridCols).keys()].sort((a, b) => colCounts[a] - colCounts[b]);

  for (const col of colsByLoad) {
    for (let row = 2; row < ECONOMY.gridRows; row++) {
      if (!occupied.has(`${col},${row}`)) return { col, row };
    }
  }
  for (const col of colsByLoad) {
    for (let row = 0; row < 2; row++) {
      if (!occupied.has(`${col},${row}`)) return { col, row };
    }
  }
  return null;
}

function tryGreedyMerge(sim: CombatSim, snapshot: CombatSnapshot): boolean {
  const units = snapshot.units;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      if (units[i].unitId === units[j].unitId && units[i].level === units[j].level) {
        const res = sim.merge({ col: units[i].col, row: units[i].row }, { col: units[j].col, row: units[j].row });
        if (res.ok) return true;
      }
    }
  }
  return false;
}

interface RunResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  elapsedSec: number;
  life: number;
  kills: number;
}

function runOnce(level: LevelDef, seed: number): RunResult {
  const sim = new CombatSim({ economy: ECONOMY, level, deck: DEFAULT_DECK, unitDefs: UNITS, enemyDefs: ENEMIES }, seed);
  let snapshot = sim.snapshot();

  while (snapshot.outcome === 'ongoing' && snapshot.elapsedSec < MAX_SIM_SECONDS) {
    sim.step(DT);
    snapshot = sim.snapshot();
    if (snapshot.outcome !== 'ongoing') break;

    tryGreedyMerge(sim, snapshot);
    snapshot = sim.snapshot();

    if (snapshot.mana >= snapshot.nextSummonCost) {
      const cell = chooseSummonCell(snapshot);
      if (cell) {
        sim.summon(cell.col, cell.row);
        snapshot = sim.snapshot();
      }
    }
  }

  if (snapshot.outcome === 'ongoing') {
    return { outcome: 'timeout', elapsedSec: snapshot.elapsedSec, life: snapshot.life, kills: snapshot.kills };
  }
  return { outcome: snapshot.outcome, elapsedSec: snapshot.elapsedSec, life: snapshot.life, kills: snapshot.kills };
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

let anyUnwinnable = false;

console.log(`WARDENS — balance simulation (${SEEDS_PER_LEVEL} seeds/level)\n`);
console.log('level                  win%   avg life (won)   avg elapsed(s)   avg kills');
console.log('-----------------------------------------------------------------------');

for (const level of LEVELS) {
  const results: RunResult[] = [];
  for (let s = 0; s < SEEDS_PER_LEVEL; s++) {
    results.push(runOnce(level, s * 1000 + 7));
  }

  const wins = results.filter((r) => r.outcome === 'victory');
  const winRate = (wins.length / results.length) * 100;
  const avgLifeOnWin = mean(wins.map((r) => r.life));
  const avgElapsed = mean(results.map((r) => r.elapsedSec));
  const avgKills = mean(results.map((r) => r.kills));
  const timeouts = results.filter((r) => r.outcome === 'timeout').length;

  console.log(
    `${level.name.padEnd(22)} ${winRate.toFixed(0).padStart(4)}%   ${avgLifeOnWin.toFixed(1).padStart(14)}   ${avgElapsed
      .toFixed(1)
      .padStart(14)}   ${avgKills.toFixed(1).padStart(9)}${timeouts > 0 ? `   (${timeouts} timeout)` : ''}`,
  );

  if (wins.length === 0) anyUnwinnable = true;
}

console.log('');
if (anyUnwinnable) {
  console.error('FAIL: at least one level has a 0% win rate against the scripted policy player — unwinnable, needs tuning.');
  process.exit(1);
} else {
  console.log('OK: every level is winnable at least once by the scripted policy player.');
}
