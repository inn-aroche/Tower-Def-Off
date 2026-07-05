export interface SaveDataV1 {
  schemaVersion: 1;
  stars: Record<number, number>; // levelId -> stars (0-3)
  survivalBestWave: number;
  unlockedSkins: string[];
}

const STORAGE_KEY = 'polymaze-td-save';

function defaultSave(): SaveDataV1 {
  return { schemaVersion: 1, stars: {}, survivalBestWave: 0, unlockedSkins: [] };
}

/** localStorage-backed save with a schema version so future shapes can migrate cleanly. */
export class SaveManager {
  private data: SaveDataV1;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveDataV1 {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as SaveDataV1;
      if (parsed.schemaVersion !== 1) return defaultSave();
      return parsed;
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage unavailable (private mode / quota) — progression just won't persist this session.
    }
  }

  getStars(levelId: number): number {
    return this.data.stars[levelId] ?? 0;
  }

  setStars(levelId: number, stars: number): void {
    this.data.stars[levelId] = Math.max(this.data.stars[levelId] ?? 0, stars);
    this.persist();
  }

  get survivalBestWave(): number {
    return this.data.survivalBestWave;
  }

  reportSurvivalRun(wave: number): void {
    this.data.survivalBestWave = Math.max(this.data.survivalBestWave, wave);
    this.persist();
  }

  isSkinUnlocked(skinId: string): boolean {
    return this.data.unlockedSkins.includes(skinId);
  }

  unlockSkin(skinId: string): void {
    if (!this.isSkinUnlocked(skinId)) {
      this.data.unlockedSkins.push(skinId);
      this.persist();
    }
  }
}
