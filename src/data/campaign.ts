import type { LevelConfig } from './LevelConfig';
import { generateProceduralLevel } from './proceduralLevels';
import level01 from './levels/level-01.json';
import level02 from './levels/level-02.json';
import level03 from './levels/level-03.json';
import level04 from './levels/level-04.json';
import level05 from './levels/level-05.json';
import level06 from './levels/level-06.json';
import level07 from './levels/level-07.json';
import level08 from './levels/level-08.json';
import level09 from './levels/level-09.json';
import level10 from './levels/level-10.json';
import level15 from './levels/level-15.json';
import level20 from './levels/level-20.json';
import level25 from './levels/level-25.json';
import level30 from './levels/level-30.json';
import level35 from './levels/level-35.json';
import level40 from './levels/level-40.json';
import level45 from './levels/level-45.json';
import level50 from './levels/level-50.json';

/** 1-10 (the original curated arc) plus a hand-designed "twist" milestone every 5 levels from
 * 15-50 — each explores a distinct idea (bottleneck corridor, triple front, endless swarm,
 * armor gauntlet, air assault, kamikaze sabotage, generous sandbox, final multi-boss gauntlet).
 * Every other id in 11-50 is filled in procedurally (see proceduralLevels.ts). */
const HAND_AUTHORED_LEVELS: LevelConfig[] = [
  level01, level02, level03, level04, level05, level06, level07, level08, level09, level10,
  level15, level20, level25, level30, level35, level40, level45, level50,
] as unknown as LevelConfig[];

export const TOTAL_CAMPAIGN_LEVELS = 50;

/** Builds the full 1-50 campaign, mixing hand-authored milestones with procedural filler by id. */
export function buildCampaignLevels(): LevelConfig[] {
  const handById = new Map(HAND_AUTHORED_LEVELS.map((l) => [l.id, l]));
  const levels: LevelConfig[] = [];
  for (let id = 1; id <= TOTAL_CAMPAIGN_LEVELS; id++) {
    levels.push(handById.get(id) ?? generateProceduralLevel(id));
  }
  return levels;
}
