import type { SaveEnvelope } from '../platform/types';
import type { OwnedUnit } from '../data/meta';
import { STARTER_COLLECTION, STARTER_GEMS, STARTER_GOLD, STARTER_SHARDS } from '../data/meta';
import { DEFAULT_DECK } from '../data/units';

/** Lifetime + daily progression (achievements, daily quests, free daily chest). */
export interface ProgressionData {
  stats: { combatsWon: number; enemiesKilled: number; pvpWins: number; merges: number };
  /** Claimed achievement ids. */
  achievements: string[];
  /** Day-scoped quest counters (reset when `date` changes). */
  daily: { date: string; wins: number; kills: number; blitz: number; claimed: string[] };
  /** Last date the free daily chest was claimed ('' = never). */
  chestDate: string;
}

/** v7 meta save. Bump the version and add a migration branch when the shape changes again. */
export interface SaveData {
  settings: { soundOn: boolean };
  currencies: { gold: number; gems: number; shards: number };
  collection: Record<string, OwnedUnit>;
  /** Base/fortress upgrade level (1 = starting). */
  base: { level: number };
  deck: string[];
  campaign: { unlockedNode: number; stars: Record<number, number> };
  league: { trophies: number };
  /** M5 shop/monetization state. */
  shop: { chestsOpened: number; noAds: boolean; passActive: boolean };
  /** FTUE / onboarding progress. */
  progress: { tutorialSeen: boolean };
  /** Endless "Survie" mode — best wave reached. */
  survival: { bestWave: number };
  /** Achievements + daily quests + daily chest. */
  progression: ProgressionData;
}

export const SAVE_SCHEMA_VERSION = 7;
export const SAVE_KEY = 'wardens_save';

export function createDefaultProgression(): ProgressionData {
  return {
    stats: { combatsWon: 0, enemiesKilled: 0, pvpWins: 0, merges: 0 },
    achievements: [],
    daily: { date: '', wins: 0, kills: 0, blitz: 0, claimed: [] },
    chestDate: '',
  };
}

export function createDefaultSaveData(): SaveData {
  return {
    settings: { soundOn: true },
    currencies: { gold: STARTER_GOLD, gems: STARTER_GEMS, shards: STARTER_SHARDS },
    collection: structuredClone(STARTER_COLLECTION),
    base: { level: 1 },
    deck: [...DEFAULT_DECK],
    campaign: { unlockedNode: 0, stars: {} },
    league: { trophies: 0 },
    shop: { chestsOpened: 0, noAds: false, passActive: false },
    progress: { tutorialSeen: false },
    survival: { bestWave: 0 },
    progression: createDefaultProgression(),
  };
}

interface SaveDataV1 {
  settings?: { soundOn?: boolean };
  campaign?: { currentLevelIndex?: number };
}
type SaveDataV2 = Omit<SaveData, 'shop' | 'progress' | 'survival' | 'progression' | 'base'> & LegacyCurrencies;
type SaveDataV3 = Omit<SaveData, 'progress' | 'survival' | 'progression' | 'base'> & LegacyCurrencies;
type SaveDataV4 = Omit<SaveData, 'survival' | 'progression' | 'base'> & LegacyCurrencies;
type SaveDataV5 = Omit<SaveData, 'progression' | 'base'> & LegacyCurrencies;
type SaveDataV6 = Omit<SaveData, 'base'> & LegacyCurrencies;
/** Pre-v7 currencies had no `shards`. */
interface LegacyCurrencies {
  currencies: { gold: number; gems: number };
}

/** Fills the v7-added fields (`shards`, `base`) onto a pre-v7 shape. */
function withV7(data: Omit<SaveData, 'base'> & LegacyCurrencies, fresh: SaveData): SaveData {
  return {
    ...data,
    currencies: { gold: data.currencies.gold, gems: data.currencies.gems, shards: STARTER_SHARDS },
    base: fresh.base,
  };
}

export function migrateSaveData(envelope: SaveEnvelope<unknown>): SaveData {
  const fresh = createDefaultSaveData();
  if (envelope.schemaVersion === 6) {
    return withV7(envelope.data as SaveDataV6, fresh);
  }
  if (envelope.schemaVersion === 5) {
    const v5 = envelope.data as SaveDataV5;
    return withV7({ ...v5, progression: fresh.progression }, fresh);
  }
  if (envelope.schemaVersion === 4) {
    const v4 = envelope.data as SaveDataV4;
    return withV7({ ...v4, survival: fresh.survival, progression: fresh.progression }, fresh);
  }
  if (envelope.schemaVersion === 3) {
    const v3 = envelope.data as SaveDataV3;
    return withV7({ ...v3, progress: fresh.progress, survival: fresh.survival, progression: fresh.progression }, fresh);
  }
  if (envelope.schemaVersion === 2) {
    const v2 = envelope.data as SaveDataV2;
    return withV7({ ...v2, shop: fresh.shop, progress: fresh.progress, survival: fresh.survival, progression: fresh.progression }, fresh);
  }
  if (envelope.schemaVersion === 1) {
    const v1 = envelope.data as SaveDataV1;
    if (typeof v1.settings?.soundOn === 'boolean') fresh.settings.soundOn = v1.settings.soundOn;
    if (typeof v1.campaign?.currentLevelIndex === 'number') {
      fresh.campaign.unlockedNode = Math.max(0, v1.campaign.currentLevelIndex);
    }
  }
  return fresh;
}
