import { describe, expect, it } from 'vitest';
import { computeEffects, isNodeUnlockable } from '../src/meta/SkillTree';
import { allNodesFor } from '../src/data/classes';

describe('SkillTree gating', () => {
  it('tier-1 nodes are always unlockable (no prerequisite)', () => {
    expect(isNodeUnlockable('warrior', 'fortification-1', new Set())).toBe(true);
  });

  it('tier-2+ nodes require the previous tier in the SAME branch', () => {
    expect(isNodeUnlockable('warrior', 'fortification-2', new Set())).toBe(false);
    expect(isNodeUnlockable('warrior', 'fortification-2', new Set(['fortification-1']))).toBe(true);
  });

  it('unlocking a node in one branch does not unlock tier-2 in a different branch', () => {
    expect(isNodeUnlockable('warrior', 'valeur-2', new Set(['fortification-1']))).toBe(false);
  });

  it('an already-unlocked node is never unlockable again', () => {
    expect(isNodeUnlockable('warrior', 'fortification-1', new Set(['fortification-1']))).toBe(false);
  });

  it('every class tree has exactly 12 nodes across 3 branches of 4 tiers', () => {
    for (const classId of ['warrior', 'mage', 'ranger'] as const) {
      expect(allNodesFor(classId)).toHaveLength(12);
    }
  });
});

describe('SkillTree effect aggregation', () => {
  it('includes the class passive even with no nodes unlocked', () => {
    const effects = computeEffects('warrior', new Set());
    expect(effects.keepMaxHpPct).toBeCloseTo(0.3);
  });

  it('sums numeric effects across multiple unlocked nodes', () => {
    const effects = computeEffects('warrior', new Set(['fortification-1', 'fortification-3']));
    expect(effects.keepMaxHpFlat).toBe(25); // 10 + 15
  });

  it('collects tier-4 unique flags without clobbering other effects', () => {
    const effects = computeEffects('warrior', new Set(['fortification-1', 'fortification-2', 'fortification-3', 'fortification-4']));
    expect(effects.flags).toContain('aegis');
    expect(effects.keepDamageReductionPct).toBeCloseTo(0.2);
    expect(effects.keepMaxHpFlat).toBe(25);
  });

  it('different classes do not leak effects into one another', () => {
    const mageEffects = computeEffects('mage', new Set());
    expect(mageEffects.keepMaxHpPct).toBeUndefined();
    expect(mageEffects.elementalDmgPct).toBeCloseTo(0.15); // Mage passive only
  });
});
