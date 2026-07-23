/**
 * Headless campaign-balance validation — required by the studio-jeu-mobile skill before any
 * tuning is trusted ("aucun tuning sans re-simulation").
 *
 * The sim is deterministic, so we sweep a *skill* knob (the scripted player's reaction interval)
 * and report the win rate over that spread: a forgiving node is won even by a slow player, a hard
 * node only by a fast one. Uses the exact same BotDriver a live opponent uses (src/sim/BotPolicy).
 */
import { CombatSim } from '../src/sim/CombatSim';
import { BotDriver } from '../src/sim/BotPolicy';
import { ECONOMY } from '../src/data/economy';
import { UNITS, DEFAULT_DECK } from '../src/data/units';
import { ENEMIES } from '../src/data/enemies';
import { CAMPAIGN, scaleEnemyDef, type CampaignNode } from '../src/data/campaign';

const DT = 1 / 30;
const MAX_SIM_SECONDS = 5 * 60;
const SKILL_SWEEP = [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8];

interface RunResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  elapsedSec: number;
  life: number;
}

function runOnce(node: CampaignNode, actIntervalSec: number): RunResult {
  const enemyDefs = ENEMIES.map((e) => scaleEnemyDef(e, node.enemyHpMult));
  const sim = new CombatSim({ economy: ECONOMY, level: node.level, deck: DEFAULT_DECK, unitDefs: UNITS, enemyDefs });
  const bot = new BotDriver(sim, DEFAULT_DECK, UNITS, node.level.path, ECONOMY.gridCols, ECONOMY.gridRows, actIntervalSec);

  let snap = sim.snapshot();
  while (snap.outcome === 'ongoing' && snap.elapsedSec < MAX_SIM_SECONDS) {
    sim.step(DT);
    bot.update(sim.snapshot().elapsedSec);
    snap = sim.snapshot();
  }
  if (snap.outcome === 'ongoing') return { outcome: 'timeout', elapsedSec: snap.elapsedSec, life: snap.life };
  return { outcome: snap.outcome, elapsedSec: snap.elapsedSec, life: snap.life };
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

let anyUnwinnable = false;

console.log(`WARDENS — campaign balance (20 nodes × skill sweep of ${SKILL_SWEEP.length} samples)\n`);
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
