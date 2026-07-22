/**
 * Headless balance validation — required by the studio-jeu-mobile skill before any tuning is
 * trusted ("aucun tuning sans re-simulation").
 *
 * The M2 sim is fully deterministic (no RNG: enemies follow a fixed path, summon is card-choice),
 * so a single policy gives one binary outcome per level — a weak signal. Instead we sweep a
 * *skill* knob (how fast the scripted player reacts / buys) across a spread, and report the win
 * rate over that spread: a forgiving level is won even by a slow player; a hard level only by a
 * fast one. That graded margin is the difficulty curve we tune against.
 *
 * Per-unit-family PvP win-rate validation (bots vs bots, 50±7%) is the M4 concern once the same
 * engine plays both sides — deferred and tracked in decisions.md, not silently dropped.
 */
import { CombatSim } from '../src/sim/CombatSim';
import { isPathCell } from '../src/sim/Path';
import { ECONOMY } from '../src/data/economy';
import { UNITS, DEFAULT_DECK } from '../src/data/units';
import { ENEMIES } from '../src/data/enemies';
import { CAMPAIGN, scaleEnemyDef, type CampaignNode } from '../src/data/campaign';
import type { CombatSnapshot, LevelDef } from '../src/sim/types';

const DT = 1 / 30;
const MAX_SIM_SECONDS = 5 * 60;
const COST = new Map(UNITS.map((u) => [u.id, u.cost]));
// Seconds a player waits between actions — higher = slower/weaker. The spread is our skill sample.
const SKILL_SWEEP = [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8];

function rankedGrassCells(level: LevelDef): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number; d: number }> = [];
  for (let row = 0; row < ECONOMY.gridRows; row++) {
    for (let col = 0; col < ECONOMY.gridCols; col++) {
      if (isPathCell(level.path, col, row)) continue;
      let best = Infinity;
      for (const p of level.path) best = Math.min(best, Math.hypot(col - p.col, row - p.row));
      cells.push({ col, row, d: best });
    }
  }
  cells.sort((a, b) => a.d - b.d);
  return cells.map(({ col, row }) => ({ col, row }));
}

function tryGreedyMerge(sim: CombatSim, snapshot: CombatSnapshot): boolean {
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

/** Buy a card that pairs with a lone level-1 unit (enables a merge), else the cheapest affordable. */
function chooseCard(snapshot: CombatSnapshot): string | null {
  const affordable = snapshot.hand.filter((c) => c.affordable);
  if (affordable.length === 0) return null;
  const lvl1 = new Map<string, number>();
  for (const u of snapshot.units) if (u.level === 1) lvl1.set(u.unitId, (lvl1.get(u.unitId) ?? 0) + 1);
  const pairable = affordable.filter((c) => (lvl1.get(c.unitId) ?? 0) % 2 === 1);
  const pool = pairable.length > 0 ? pairable : affordable;
  return pool.reduce((best, c) => (c.cost < best.cost ? c : best)).unitId;
}

interface RunResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  elapsedSec: number;
  life: number;
  kills: number;
}

function runOnce(node: CampaignNode, actIntervalSec: number): RunResult {
  const level = node.level;
  const enemyDefs = ENEMIES.map((e) => scaleEnemyDef(e, node.enemyHpMult));
  const sim = new CombatSim({ economy: ECONOMY, level, deck: DEFAULT_DECK, unitDefs: UNITS, enemyDefs });
  const grass = rankedGrassCells(level);
  let snapshot = sim.snapshot();
  let nextActAt = 0;

  while (snapshot.outcome === 'ongoing' && snapshot.elapsedSec < MAX_SIM_SECONDS) {
    sim.step(DT);
    snapshot = sim.snapshot();
    if (snapshot.outcome !== 'ongoing') break;
    if (snapshot.elapsedSec < nextActAt) continue;
    nextActAt = snapshot.elapsedSec + actIntervalSec;

    tryGreedyMerge(sim, snapshot);
    snapshot = sim.snapshot();

    const unitId = chooseCard(snapshot);
    if (unitId !== null && snapshot.mana >= (COST.get(unitId) ?? Infinity)) {
      const occupied = new Set(snapshot.units.map((u) => `${u.col},${u.row}`));
      const cell = grass.find((g) => !occupied.has(`${g.col},${g.row}`));
      if (cell) {
        sim.summon(unitId, cell.col, cell.row);
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

console.log(`WARDENS — balance simulation (20 nodes × skill sweep of ${SKILL_SWEEP.length} samples)\n`);
console.log('node                      win%   avg life (won)   avg elapsed(s)   hpMult');
console.log('--------------------------------------------------------------------------');

for (const node of CAMPAIGN) {
  const results = SKILL_SWEEP.map((iv) => runOnce(node, iv));
  const wins = results.filter((r) => r.outcome === 'victory');
  const winRate = (wins.length / results.length) * 100;

  console.log(
    `${node.name.padEnd(24)} ${winRate.toFixed(0).padStart(4)}%   ${mean(wins.map((r) => r.life))
      .toFixed(1)
      .padStart(14)}   ${mean(results.map((r) => r.elapsedSec)).toFixed(1).padStart(14)}   ${node.enemyHpMult
      .toFixed(2)
      .padStart(6)}`,
  );

  if (wins.length === 0) anyUnwinnable = true;
}

console.log('');
if (anyUnwinnable) {
  console.error('FAIL: at least one node is unwinnable across the whole skill sweep — needs tuning.');
  process.exit(1);
} else {
  console.log('OK: every node is winnable by at least the fastest scripted player.');
}
