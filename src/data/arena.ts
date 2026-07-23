import type { LevelDef, UnitDef, UnitLevelStats } from '../sim/types';
import { CAMPAIGN_PATH } from './levels';
import { UNITS_BY_ID } from './units';

/** Shared, symmetric wave set both sides face in a PvP match (v1 = bots). Same waves, same start
 * life; the winner is whoever leaks less (higher remaining life when the stream ends, or the last
 * base standing). */
export const ARENA_LEVEL: LevelDef = {
  id: 'arena',
  name: 'Arène',
  playerStartLife: 20,
  path: CAMPAIGN_PATH,
  waves: [
    {
      startDelaySec: 2,
      spawnGroups: [
        { enemyId: 'goblin', count: 12, intervalSec: 0.5, startDelaySec: 0 },
        { enemyId: 'runner', count: 7, intervalSec: 0.6, startDelaySec: 1 },
      ],
    },
    {
      startDelaySec: 11,
      spawnGroups: [
        { enemyId: 'brute', count: 6, intervalSec: 1.1, startDelaySec: 0 },
        { enemyId: 'runner', count: 10, intervalSec: 0.5, startDelaySec: 1 },
      ],
    },
    {
      startDelaySec: 11,
      spawnGroups: [
        { enemyId: 'goblin', count: 16, intervalSec: 0.35, startDelaySec: 0 },
        { enemyId: 'brute', count: 5, intervalSec: 1.3, startDelaySec: 2 },
        { enemyId: 'troll', count: 3, intervalSec: 2.2, startDelaySec: 3 },
      ],
    },
  ],
};

export interface League {
  id: string;
  name: string;
  minTrophies: number;
  /** Bot reaction interval (s) — lower = stronger. */
  botActIntervalSec: number;
  /** Bot deck (unit ids). */
  botDeck: string[];
  /** Flat stat multiplier applied to the bot's unit defs (stands in for meta-levels). */
  botPower: number;
  /** Cosmetic opponent name shown in the match header. */
  botName: string;
}

export const LEAGUES: League[] = [
  { id: 'wood', name: 'Bois', minTrophies: 0, botActIntervalSec: 2.4, botDeck: ['swordsman', 'archer', 'lancer', 'scout'], botPower: 1.0, botName: 'Recrue Gobeline' },
  { id: 'bronze', name: 'Bronze', minTrophies: 200, botActIntervalSec: 1.9, botDeck: ['swordsman', 'archer', 'lancer', 'catapult', 'gravity_well'], botPower: 1.15, botName: 'Grognard Ferreux' },
  { id: 'silver', name: 'Argent', minTrophies: 500, botActIntervalSec: 1.5, botDeck: ['swordsman', 'archer', 'guardian', 'catapult', 'gravity_well'], botPower: 1.35, botName: 'Skarn le Ravageur' },
  { id: 'gold', name: 'Or', minTrophies: 900, botActIntervalSec: 1.1, botDeck: ['swordsman', 'guardian', 'catapult', 'golem', 'gravity_well'], botPower: 1.6, botName: 'Maraude d’Airain' },
  { id: 'platinum', name: 'Platine', minTrophies: 1400, botActIntervalSec: 0.8, botDeck: ['swordsman', 'storm_caller', 'catapult', 'golem', 'singularity'], botPower: 1.9, botName: 'Seigneur des Tempêtes' },
];

export const WIN_TROPHIES = 30;
export const LOSS_TROPHIES = 20;

export function leagueForTrophies(trophies: number): League {
  let current = LEAGUES[0];
  for (const l of LEAGUES) if (trophies >= l.minTrophies) current = l;
  return current;
}

/** Bot's unit defs, stat-scaled by the league power factor (parallels player meta-levels). */
export function botUnitDefs(league: League): UnitDef[] {
  const rangeMult = 1 + (league.botPower - 1) * 0.3;
  return league.botDeck.map((id) => {
    const def = UNITS_BY_ID.get(id)!;
    const levels: UnitLevelStats[] = def.levels.map((s) => ({
      ...s,
      damage: Math.round(s.damage * league.botPower),
      range: +(s.range * rangeMult).toFixed(3),
    }));
    return { ...def, levels };
  });
}
