import { beforeEach, describe, expect, it } from 'vitest';
import { SaveManager } from '../src/meta/SaveManager';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('SaveManager', () => {
  it('starts with sane defaults on a fresh browser', () => {
    const save = new SaveManager();
    const data = save.get();
    expect(data.activeClass).toBeNull();
    expect(data.essence).toBe(0);
    expect(data.unlockedNodes.warrior).toEqual([]);
  });

  it('persists the active class across instances (simulating reload)', () => {
    new SaveManager().setActiveClass('mage');
    const reloaded = new SaveManager();
    expect(reloaded.get().activeClass).toBe('mage');
  });

  it('unlockNode spends essence and refuses when short of funds', () => {
    const save = new SaveManager();
    save.addEssence(1);
    expect(save.unlockNode('warrior', 'fortification-1', 5)).toBe(false);
    expect(save.get().essence).toBe(1);
    save.addEssence(4);
    expect(save.unlockNode('warrior', 'fortification-1', 5)).toBe(true);
    expect(save.get().essence).toBe(0);
    expect(save.unlockedNodesFor('warrior').has('fortification-1')).toBe(true);
  });

  it('unlockNode is idempotent — cannot double-unlock the same node', () => {
    const save = new SaveManager();
    save.addEssence(10);
    expect(save.unlockNode('warrior', 'fortification-1', 1)).toBe(true);
    expect(save.unlockNode('warrior', 'fortification-1', 1)).toBe(false);
    expect(save.get().essence).toBe(9);
  });

  it('recordRun tracks total runs and best wave reached', () => {
    const save = new SaveManager();
    save.recordRun(5);
    save.recordRun(3);
    save.recordRun(9);
    expect(save.get().stats.totalRuns).toBe(3);
    expect(save.get().stats.bestWave).toBe(9);
  });

  it('resetAll wipes everything back to defaults', () => {
    const save = new SaveManager();
    save.setActiveClass('ranger');
    save.addEssence(50);
    save.resetAll();
    expect(save.get().activeClass).toBeNull();
    expect(save.get().essence).toBe(0);
  });
});
