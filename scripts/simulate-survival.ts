/**
 * Headless survival-balance validation. Survival has no "win" — it ends in defeat — so instead of a
 * win rate we report *how deep* the scripted player gets across a skill sweep. A healthy endless
 * curve: a slow player washes out early, a fast one goes meaningfully deeper, and nobody stalls
 * forever (the run must terminate). Uses the same deterministic BotDriver as the live game.
 */
import { CombatSim } from '../src/sim/CombatSim';
import { BotDriver } from '../src/sim/BotPolicy';
import { ECONOMY } from '../src/data/economy';
import { UNITS, DEFAULT_DECK } from '../src/data/units';
import { ENEMIES } from '../src/data/enemies';
import { CAMPAIGN_PATH } from '../src/data/levels';
import { SURVIVAL_START_LIFE, SURVIVAL_WAVE_GAP_SEC, survivalHpMult, survivalWave } from '../src/data/survival';
import type { LevelDef } from '../src/sim/types';

const DT = 1 / 30;
const MAX_SIM_SECONDS = 12 * 60; // hard cap: a run must end before this or the mode is broken
const SKILL_SWEEP = [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8];

const LEVEL: LevelDef = { id: 'survival', name: 'Survie', playerStartLife: SURVIVAL_START_LIFE, path: CAMPAIGN_PATH, waves: [] };

interface RunResult {
  wavesReached: number;
  elapsedSec: number;
  terminated: boolean;
}

function runOnce(actIntervalSec: number): RunResult {
  const sim = new CombatSim({
    economy: ECONOMY,
    level: LEVEL,
    deck: DEFAULT_DECK,
    unitDefs: UNITS,
    enemyDefs: ENEMIES,
    survival: { makeWave: survivalWave, hpMultForWave: survivalHpMult, waveGapSec: SURVIVAL_WAVE_GAP_SEC },
  });
  const bot = new BotDriver(sim, DEFAULT_DECK, UNITS, CAMPAIGN_PATH, ECONOMY.gridCols, ECONOMY.gridRows, actIntervalSec);

  let snap = sim.snapshot();
  while (snap.outcome === 'ongoing' && snap.elapsedSec < MAX_SIM_SECONDS) {
    sim.step(DT);
    bot.update(sim.snapshot().elapsedSec);
    snap = sim.snapshot();
  }
  return { wavesReached: snap.currentWaveIndex + 1, elapsedSec: snap.elapsedSec, terminated: snap.outcome !== 'ongoing' };
}

console.log(`WARDENS — survival balance (skill sweep of ${SKILL_SWEEP.length} samples)\n`);
console.log('reaction(s)   wave reached   elapsed(s)   ended?');
console.log('----------------------------------------------------');

let anyStalled = false;
const waves: number[] = [];
for (const iv of SKILL_SWEEP) {
  const r = runOnce(iv);
  waves.push(r.wavesReached);
  if (!r.terminated) anyStalled = true;
  console.log(
    `${iv.toFixed(1).padStart(9)}   ${String(r.wavesReached).padStart(12)}   ${r.elapsedSec
      .toFixed(1)
      .padStart(10)}   ${r.terminated ? 'yes' : 'NO — stalled'}`,
  );
}

const fastest = waves[0];
const slowest = waves[waves.length - 1];
const best = Math.max(...waves);
const worst = Math.min(...waves);
console.log('');
console.log(`spread: worst reaches wave ${worst}, best reaches wave ${best} (skill matters: ${best > worst ? 'yes' : 'NO'})`);

if (anyStalled) {
  console.error('\nFAIL: a run never terminated within the cap — survival is not converging.');
  process.exit(1);
} else if (best <= worst) {
  console.error('\nFAIL: skill does not change how deep you get — the ramp is flat.');
  process.exit(1);
} else {
  console.log(`\nOK: every run ends, and skill changes depth (fastest wave ${fastest}, slowest ${slowest}).`);
}
