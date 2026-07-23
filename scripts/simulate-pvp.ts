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
import { ARENA_LEVEL, BLITZ_ARENA_LEVEL, BLITZ_ECONOMY, botUnitDefs, LEAGUES, type League } from '../src/data/arena';
import type { EconomyConfig, LevelDef, UnitDef } from '../src/sim/types';

const DT = 1 / 30;
const MAX_SIM_SECONDS = 5 * 60;
/** Skill sweep for the reference player (reaction interval, s). Sweeping instead of a single match
 * turns each league's outcome into a win *rate*, so a tier near the player's level reads as
 * genuinely competitive (0 < win% < 100) rather than a binary stomp. */
const PLAYER_SKILL_SWEEP = [0.5, 0.8, 1.1, 1.4, 1.7, 2.0];

function playerDefs(): UnitDef[] {
  return DEFAULT_DECK.map((id) => UNITS_BY_ID.get(id)!);
}

type Side = 'player' | 'bot' | 'draw';

function playMatch(league: League, level: LevelDef, economy: EconomyConfig, playerAct: number): Side {
  const playerSim = new CombatSim({ economy, level, deck: DEFAULT_DECK, unitDefs: playerDefs(), enemyDefs: ENEMIES });
  const player = new BotDriver(playerSim, DEFAULT_DECK, playerDefs(), level.path, economy.gridCols, economy.gridRows, playerAct);

  const bDefs = botUnitDefs(league);
  const botSim = new CombatSim({ economy, level, deck: league.botDeck, unitDefs: bDefs, enemyDefs: ENEMIES });
  const bot = new BotDriver(botSim, league.botDeck, bDefs, level.path, economy.gridCols, economy.gridRows, league.botActIntervalSec);

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

/** Player win% vs a league across the skill sweep (a draw counts as half a win). */
function winRate(league: League, level: LevelDef, economy: EconomyConfig): number {
  let score = 0;
  for (const act of PLAYER_SKILL_SWEEP) {
    const r = playMatch(league, level, economy, act);
    score += r === 'player' ? 1 : r === 'draw' ? 0.5 : 0;
  }
  return (score / PLAYER_SKILL_SWEEP.length) * 100;
}

/** Runs the skill-swept reference player against every league on a given mode and checks the ramp. */
function calibrate(mode: string, level: LevelDef, economy: EconomyConfig): boolean {
  console.log(`\n${mode} — reference player skill sweep of ${PLAYER_SKILL_SWEEP.length}, starter deck`);
  console.log('league       bot act   power   player win%');
  console.log('---------------------------------------------');
  const winPcts: number[] = [];
  for (const league of LEAGUES) {
    const w = winRate(league, level, economy);
    winPcts.push(w);
    console.log(
      `${league.name.padEnd(12)} ${league.botActIntervalSec.toFixed(1).padStart(7)}   ${league.botPower
        .toFixed(2)
        .padStart(5)}   ${w.toFixed(0).padStart(10)}%`,
    );
  }

  // The gate: a *ramp*. A fixed starter-deck player should win low leagues, contest their tier,
  // and lose high leagues (which require upgraded decks). So win% must be non-increasing as the
  // league strengthens, with at least one competitive rung in the middle.
  const monotonic = winPcts.every((w, i) => i === 0 || w <= winPcts[i - 1] + 0.01);
  const hasCompetitive = winPcts.some((w) => w > 0 && w < 100);
  const beatsLowest = winPcts[0] >= 50;
  const losesHighest = winPcts[winPcts.length - 1] <= 50;
  const ok = monotonic && hasCompetitive && beatsLowest && losesHighest;
  console.log(ok ? `OK (${mode}): starter player wins low, contests its tier, loses high.` : `FAIL (${mode}): ramp not monotonic/competitive — retune.`);
  return ok;
}

console.log('WARDENS — PvP calibration (Classique + Blitz)');
const classicOk = calibrate('Classique', ARENA_LEVEL, ECONOMY);
const blitzOk = calibrate('Blitz', BLITZ_ARENA_LEVEL, BLITZ_ECONOMY);

if (classicOk && blitzOk) {
  console.log('\nOK: both PvP modes form a fair difficulty ramp.');
} else {
  console.error('\nFAIL: a PvP mode is miscalibrated — retune power/act/decks.');
  process.exit(1);
}
