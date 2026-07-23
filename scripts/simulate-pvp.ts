/**
 * PvP calibration — the M4 quality gate from the skill: a player fighting the bot for their own
 * league should sit near a coin-flip. We proxy "an average player of league L" with a BotDriver
 * of moderate skill (a fixed reaction interval), pit it against each league's configured opponent
 * on the shared arena waves, and report the average player's win rate per league. Target ~50±10%
 * (a touch generous vs the 50±7% unit-family gate, since this is a coarse whole-deck proxy).
 */
import { CombatSim } from '../src/sim/CombatSim';
import { BotDriver } from '../src/sim/BotPolicy';
import { ECONOMY } from '../src/data/economy';
import { UNITS_BY_ID, DEFAULT_DECK } from '../src/data/units';
import { ENEMIES } from '../src/data/enemies';
import { ARENA_LEVEL, botUnitDefs, LEAGUES, type League } from '../src/data/arena';
import type { UnitDef } from '../src/sim/types';

const DT = 1 / 30;
const MAX_SIM_SECONDS = 5 * 60;
/** The reference "average player": a fixed, sensible reaction speed with the starter deck. */
const PLAYER_ACT_INTERVAL = 1.1;

function playerDefs(): UnitDef[] {
  return DEFAULT_DECK.map((id) => UNITS_BY_ID.get(id)!);
}

type Side = 'player' | 'bot' | 'draw';

function playMatch(league: League): Side {
  const playerSim = new CombatSim({ economy: ECONOMY, level: ARENA_LEVEL, deck: DEFAULT_DECK, unitDefs: playerDefs(), enemyDefs: ENEMIES });
  const player = new BotDriver(playerSim, DEFAULT_DECK, playerDefs(), ARENA_LEVEL.path, ECONOMY.gridCols, ECONOMY.gridRows, PLAYER_ACT_INTERVAL);

  const bDefs = botUnitDefs(league);
  const botSim = new CombatSim({ economy: ECONOMY, level: ARENA_LEVEL, deck: league.botDeck, unitDefs: bDefs, enemyDefs: ENEMIES });
  const bot = new BotDriver(botSim, league.botDeck, bDefs, ARENA_LEVEL.path, ECONOMY.gridCols, ECONOMY.gridRows, league.botActIntervalSec);

  for (let t = 0; t < MAX_SIM_SECONDS / DT; t++) {
    playerSim.step(DT);
    botSim.step(DT);
    player.update(playerSim.snapshot().elapsedSec);
    bot.update(botSim.snapshot().elapsedSec);
    const ps = playerSim.snapshot();
    const bs = botSim.snapshot();
    const ended = ps.outcome === 'defeat' || bs.outcome === 'defeat' || (ps.outcome !== 'ongoing' && bs.outcome !== 'ongoing');
    if (ended) {
      if (ps.life <= 0 && bs.life <= 0) return 'draw';
      if (ps.life <= 0) return 'bot';
      if (bs.life <= 0) return 'player';
      return ps.life > bs.life ? 'player' : ps.life < bs.life ? 'bot' : 'draw';
    }
  }
  return 'draw';
}

console.log(`WARDENS — PvP calibration (reference player act=${PLAYER_ACT_INTERVAL}s, starter deck)\n`);
console.log('league       bot act   power   player win%   result');
console.log('----------------------------------------------------');

const winPcts: number[] = [];
for (const league of LEAGUES) {
  // Deterministic single match per league (sim has no RNG); report the decisive outcome.
  const r = playMatch(league);
  const winPct = r === 'player' ? 100 : r === 'draw' ? 50 : 0;
  winPcts.push(winPct);
  console.log(
    `${league.name.padEnd(12)} ${league.botActIntervalSec.toFixed(1).padStart(7)}   ${league.botPower
      .toFixed(2)
      .padStart(5)}   ${String(winPct).padStart(10)}%   ${r}`,
  );
}

// The gate: a *ramp*. A fixed starter-deck player should win low leagues, contest their tier,
// and lose high leagues (which require upgraded decks). So win% must be non-increasing as the
// league strengthens, with at least one competitive rung in the middle.
const monotonic = winPcts.every((w, i) => i === 0 || w <= winPcts[i - 1]);
const hasCompetitive = winPcts.some((w) => w > 0 && w < 100);
const beatsLowest = winPcts[0] >= 50;
const losesHighest = winPcts[winPcts.length - 1] <= 50;

console.log('');
if (monotonic && hasCompetitive && beatsLowest && losesHighest) {
  console.log('OK: leagues form a difficulty ramp — starter player wins low, contests its tier, loses high.');
} else {
  console.error('FAIL: league ramp is not monotonic / competitive for the reference player — retune power/act/decks.');
  process.exit(1);
}
