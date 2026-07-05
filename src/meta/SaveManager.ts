export interface SaveDataV1 {
  schemaVersion: 1;
  stars: Record<number, number>; // levelId -> stars (0-3)
  survivalBestWave: number;
  unlockedSkins: string[];
}

export interface SurvivalRun {
  tier: string;
  score: number;
  waveReached: number;
}

export interface SaveDataV2 {
  schemaVersion: 2;
  stars: Record<number, number>;
  survivalBestWave: number;
  survivalRuns: SurvivalRun[]; // top runs, sorted desc by score, capped
  unlockedSkins: string[];
  selectedSkin: string | null;
  reduceEffects: boolean;
  audioMuted?: boolean; // added post-v2, optional so existing saves parse without a migration bump
}

const STORAGE_KEY = 'polymaze-td-save';
const MAX_LEADERBOARD_ENTRIES = 10;

function defaultSave(): SaveDataV2 {
  return {
    schemaVersion: 2,
    stars: {},
    survivalBestWave: 0,
    survivalRuns: [],
    unlockedSkins: ['default'],
    selectedSkin: 'default',
    reduceEffects: false,
  };
}

function migrate(raw: unknown): SaveDataV2 {
  if (!raw || typeof raw !== 'object') return defaultSave();
  const data = raw as { schemaVersion?: number } & Record<string, unknown>;

  if (data.schemaVersion === 2) return raw as SaveDataV2;

  if (data.schemaVersion === 1) {
    const v1 = raw as SaveDataV1;
    return {
      schemaVersion: 2,
      stars: v1.stars ?? {},
      survivalBestWave: v1.survivalBestWave ?? 0,
      survivalRuns: [],
      unlockedSkins: v1.unlockedSkins?.length ? v1.unlockedSkins : ['default'],
      selectedSkin: 'default',
      reduceEffects: false,
    };
  }

  return defaultSave();
}

/** localStorage-backed save with a schema version so future shapes can migrate cleanly. */
export class SaveManager {
  private data: SaveDataV2;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveDataV2 {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      return migrate(JSON.parse(raw));
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

  get survivalLeaderboard(): ReadonlyArray<SurvivalRun> {
    return this.data.survivalRuns;
  }

  reportSurvivalRun(tier: string, score: number, waveReached: number): void {
    this.data.survivalBestWave = Math.max(this.data.survivalBestWave, waveReached);
    this.data.survivalRuns.push({ tier, score, waveReached });
    this.data.survivalRuns.sort((a, b) => b.score - a.score);
    this.data.survivalRuns.length = Math.min(this.data.survivalRuns.length, MAX_LEADERBOARD_ENTRIES);
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

  get unlockedSkins(): ReadonlyArray<string> {
    return this.data.unlockedSkins;
  }

  get selectedSkin(): string {
    return this.data.selectedSkin ?? 'default';
  }

  selectSkin(skinId: string): void {
    if (!this.isSkinUnlocked(skinId)) return;
    this.data.selectedSkin = skinId;
    this.persist();
  }

  get reduceEffects(): boolean {
    return this.data.reduceEffects;
  }

  setReduceEffects(value: boolean): void {
    this.data.reduceEffects = value;
    this.persist();
  }

  get audioMuted(): boolean {
    return this.data.audioMuted ?? false;
  }

  setAudioMuted(value: boolean): void {
    this.data.audioMuted = value;
    this.persist();
  }
}
