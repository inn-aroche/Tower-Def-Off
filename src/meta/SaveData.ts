import type { SaveEnvelope } from '../platform/types';
import type { OwnedUnit } from '../data/meta';
import { STARTER_COLLECTION, STARTER_GEMS, STARTER_GOLD } from '../data/meta';
import { DEFAULT_DECK } from '../data/units';

/** v5 meta save. Bump the version and add a migration branch when the shape changes again. */
export interface SaveData {
  settings: { soundOn: boolean };
  currencies: { gold: number; gems: number };
  collection: Record<string, OwnedUnit>;
  deck: string[];
  campaign: { unlockedNode: number; stars: Record<number, number> };
  league: { trophies: number };
  /** M5 shop/monetization state. */
  shop: { chestsOpened: number; noAds: boolean; passActive: boolean };
  /** FTUE / onboarding progress. */
  progress: { tutorialSeen: boolean };
  /** Endless "Survie" mode — best wave reached. */
  survival: { bestWave: number };
}

export const SAVE_SCHEMA_VERSION = 5;
export const SAVE_KEY = 'wardens_save';

export function createDefaultSaveData(): SaveData {
  return {
    settings: { soundOn: true },
    currencies: { gold: STARTER_GOLD, gems: STARTER_GEMS },
    collection: structuredClone(STARTER_COLLECTION),
    deck: [...DEFAULT_DECK],
    campaign: { unlockedNode: 0, stars: {} },
    league: { trophies: 0 },
    shop: { chestsOpened: 0, noAds: false, passActive: false },
    progress: { tutorialSeen: false },
    survival: { bestWave: 0 },
  };
}

interface SaveDataV1 {
  settings?: { soundOn?: boolean };
  campaign?: { currentLevelIndex?: number };
}
type SaveDataV2 = Omit<SaveData, 'shop' | 'progress' | 'survival'>;
type SaveDataV3 = Omit<SaveData, 'progress' | 'survival'>;
type SaveDataV4 = Omit<SaveData, 'survival'>;

export function migrateSaveData(envelope: SaveEnvelope<unknown>): SaveData {
  const fresh = createDefaultSaveData();
  if (envelope.schemaVersion === 4) {
    const v4 = envelope.data as SaveDataV4;
    return { ...v4, survival: fresh.survival };
  }
  if (envelope.schemaVersion === 3) {
    const v3 = envelope.data as SaveDataV3;
    return { ...v3, progress: fresh.progress, survival: fresh.survival };
  }
  if (envelope.schemaVersion === 2) {
    const v2 = envelope.data as SaveDataV2;
    return { ...v2, shop: fresh.shop, progress: fresh.progress, survival: fresh.survival };
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
