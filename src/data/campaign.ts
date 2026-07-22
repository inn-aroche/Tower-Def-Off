import type { EnemyDef, LevelDef } from '../sim/types';
import { LEVELS } from './levels';

export interface CampaignNode {
  index: number;
  name: string;
  level: LevelDef;
  /** Multiplier applied to every enemy's HP for this node (difficulty ramp across the 20 nodes). */
  enemyHpMult: number;
}

/**
 * 20-node saga built from the 5 authored level templates, cycled with a rising HP multiplier.
 * Distinct hand-authored paths/waves per node arrive later; this gives a full, playable ramp now.
 */
export const CAMPAIGN: CampaignNode[] = Array.from({ length: 20 }, (_, i) => {
  const template = LEVELS[i % LEVELS.length];
  return {
    index: i,
    name: `${i + 1}. ${template.name}`,
    level: template,
    enemyHpMult: +(1 + i * 0.11).toFixed(2),
  };
});

export function scaleEnemyDef(def: EnemyDef, hpMult: number): EnemyDef {
  return { ...def, hp: Math.round(def.hp * hpMult) };
}
