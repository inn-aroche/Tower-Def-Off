import type { EnemyDef, LevelDef, WaveDef } from '../sim/types';
import { LEVELS } from './levels';
import { mapForNode } from './maps';

export interface CampaignNode {
  index: number;
  name: string;
  level: LevelDef;
  /** Multiplier applied to every enemy's HP for this node (difficulty ramp across the 20 nodes). */
  enemyHpMult: number;
  isBoss: boolean;
  /** Name of the map this node runs on (for the hub / combat header). */
  mapName: string;
}

/** Boss at nodes 5/10/15/20 (0-indexed 4/9/14/19), escalating. */
const BOSS_AT: Record<number, string> = { 4: 'necromancer', 9: 'warlord', 14: 'high_priestess', 19: 'stone_colossus' };
/** Elite type sprinkled into mid/late nodes, cycled for variety. */
const ELITES = ['wraith', 'saboteur', 'juggernaut', 'ogre'];

/** Returns an augmented copy of a base level for a given node — sprinkles elites from node 7 and
 * appends a boss finale on boss nodes. Never mutates the shared template. */
function augmentLevel(base: LevelDef, index: number): LevelDef {
  const waves: WaveDef[] = base.waves.map((w) => ({
    startDelaySec: w.startDelaySec,
    spawnGroups: w.spawnGroups.map((g) => ({ ...g })),
  }));

  // Elites join the final wave from node 7 onward.
  if (index >= 6 && waves.length > 0) {
    const elite = ELITES[index % ELITES.length];
    const last = waves[waves.length - 1];
    last.spawnGroups.push({ enemyId: elite, count: 2 + Math.floor(index / 6), intervalSec: 1.6, startDelaySec: 3 });
  }

  const bossId = BOSS_AT[index];
  if (bossId) {
    waves.push({
      startDelaySec: 16,
      spawnGroups: [
        { enemyId: bossId, count: 1, intervalSec: 0, startDelaySec: 0 },
        { enemyId: 'brute', count: 3, intervalSec: 1.8, startDelaySec: 3 },
      ],
    });
  }

  return {
    ...base,
    // Each node runs on a cycled map for variety (render + placement read level.path generically).
    path: mapForNode(index).path,
    playerStartLife: base.playerStartLife + (bossId ? 4 : 0),
    maxSlots: maxSlotsForNode(index),
    waves,
  };
}

/**
 * Emplacements budget per node — the "moins simple" knob. The board can only hold this many
 * defenses at once, so spreading cheap units stops working and merging becomes the way to keep
 * building. Boss nodes get one extra slot so the finale stays winnable while the curve tightens.
 * Validated by `npm run simulate` (every node must stay winnable by the fastest scripted player).
 */
export function maxSlotsForNode(index: number): number {
  return BASE_MAX_SLOTS + (index in BOSS_AT ? 1 : 0);
}

/** Flat cap across the saga (boss nodes get +1). A *decreasing* curve was tried first and made the
 * late nodes unwinnable — it stacked with the rising enemy HP into a double penalty. Keeping it
 * flat puts the progression where it belongs: merge quality, unit levels, and the base upgrade
 * (`baseBonusSlots`, up to +3), not a shrinking board. */
export const BASE_MAX_SLOTS = 8;

/**
 * 20-node saga built from the 5 authored templates, cycled with a rising HP multiplier, elites
 * from node 7, and boss finales on nodes 5/10/15/20.
 */
export const CAMPAIGN: CampaignNode[] = Array.from({ length: 20 }, (_, i) => {
  const template = LEVELS[i % LEVELS.length];
  const isBoss = i in BOSS_AT;
  return {
    index: i,
    name: `${i + 1}. ${isBoss ? '👑 ' : ''}${template.name}`,
    level: augmentLevel(template, i),
    enemyHpMult: +(1 + i * 0.09).toFixed(2),
    isBoss,
    mapName: mapForNode(i).name,
  };
});

export function scaleEnemyDef(def: EnemyDef, hpMult: number): EnemyDef {
  return { ...def, hp: Math.round(def.hp * hpMult) };
}
