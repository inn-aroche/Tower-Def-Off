import type { ClassId, SkillEffects } from '../data/classes';
import { CLASSES, allNodesFor } from '../data/classes';

/** A node's tier N in a branch requires tier N-1 in that SAME branch to already be unlocked. */
export function isNodeUnlockable(classId: ClassId, nodeId: string, unlocked: Set<string>): boolean {
  if (unlocked.has(nodeId)) return false;
  const node = allNodesFor(classId).find((n) => n.id === nodeId);
  if (!node) return false;
  if (node.tier === 1) return true;
  const prevId = `${node.branch}-${node.tier - 1}`;
  return unlocked.has(prevId);
}

/** Aggregates the class passive + every unlocked skill node into one effective bonus set. */
export function computeEffects(classId: ClassId, unlocked: Set<string>): SkillEffects {
  const def = CLASSES[classId];
  const all: SkillEffects[] = [def.passive.effects, ...allNodesFor(classId).filter((n) => unlocked.has(n.id)).map((n) => n.effects)];

  const result: SkillEffects = {};
  const flags = new Set<string>();
  for (const eff of all) {
    for (const [key, value] of Object.entries(eff)) {
      if (key === 'flags') {
        for (const f of value as string[]) flags.add(f);
        continue;
      }
      const k = key as keyof SkillEffects;
      (result[k] as number) = ((result[k] as number) ?? 0) + (value as number);
    }
  }
  if (flags.size > 0) result.flags = [...flags];
  return result;
}

export function hasFlag(effects: SkillEffects, flag: string): boolean {
  return !!effects.flags?.includes(flag);
}
