import type { ClassId } from '../data/classes';

export interface SaveData {
  version: 1;
  activeClass: ClassId | null;
  essence: number;
  unlockedNodes: Record<ClassId, string[]>;
  settings: { sound: boolean };
  stats: { totalRuns: number; bestWave: number };
}

const STORAGE_KEY = 'runeforge-defense-save-v1';

function defaultSave(): SaveData {
  return {
    version: 1,
    activeClass: null,
    essence: 0,
    unlockedNodes: { warrior: [], mage: [], ranger: [] },
    settings: { sound: true },
    stats: { totalRuns: 0, bestWave: 0 },
  };
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 1) return defaultSave();
      return { ...defaultSave(), ...parsed };
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable (private browsing quota, etc). Progress just won't survive reload.
    }
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  setActiveClass(id: ClassId): void {
    this.data.activeClass = id;
    this.persist();
  }

  addEssence(amount: number): void {
    this.data.essence += amount;
    this.persist();
  }

  unlockedNodesFor(classId: ClassId): Set<string> {
    return new Set(this.data.unlockedNodes[classId] ?? []);
  }

  unlockNode(classId: ClassId, nodeId: string, cost: number): boolean {
    if (this.data.essence < cost) return false;
    const set = this.unlockedNodesFor(classId);
    if (set.has(nodeId)) return false;
    set.add(nodeId);
    this.data.unlockedNodes[classId] = [...set];
    this.data.essence -= cost;
    this.persist();
    return true;
  }

  recordRun(wavesSurvived: number): void {
    this.data.stats.totalRuns += 1;
    this.data.stats.bestWave = Math.max(this.data.stats.bestWave, wavesSurvived);
    this.persist();
  }

  setSound(enabled: boolean): void {
    this.data.settings.sound = enabled;
    this.persist();
  }

  resetAll(): void {
    this.data = defaultSave();
    this.persist();
  }
}
