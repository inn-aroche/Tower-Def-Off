import type { SaveEnvelope } from '../platform/types';
import type { OwnedUnit } from '../data/meta';
import { STARTER_COLLECTION, STARTER_GEMS, STARTER_GOLD } from '../data/meta';
import { DEFAULT_DECK } from '../data/units';

/** v2 meta save (collection, currencies, campaign stars, active deck, league). Bump the version
 * and add a migration branch when the shape changes again. */
export interface SaveData {
  settings: { soundOn: boolean };
  currencies: { gold: number; gems: number };
  collection: Record<string, OwnedUnit>;
  deck: string[];
  campaign: { unlockedNode: number; stars: Record<number, number> };
  league: { trophies: number };
}

export const SAVE_SCHEMA_VERSION = 2;
export const SAVE_KEY = 'wardens_save';

export function createDefaultSaveData(): SaveData {
  return {
    settings: { soundOn: true },
    currencies: { gold: STARTER_GOLD, gems: STARTER_GEMS },
    collection: structuredClone(STARTER_COLLECTION),
    deck: [...DEFAULT_DECK],
    campaign: { unlockedNode: 0, stars: {} },
    league: { trophies: 0 },
  };
}

interface SaveDataV1 {
  settings?: { soundOn?: boolean };
  campaign?: { currentLevelIndex?: number };
}

export function migrateSaveData(envelope: SaveEnvelope<unknown>): SaveData {
  const fresh = createDefaultSaveData();
  if (envelope.schemaVersion === 1) {
    const v1 = envelope.data as SaveDataV1;
    if (typeof v1.settings?.soundOn === 'boolean') fresh.settings.soundOn = v1.settings.soundOn;
    if (typeof v1.campaign?.currentLevelIndex === 'number') {
      fresh.campaign.unlockedNode = Math.max(0, v1.campaign.currentLevelIndex);
    }
  }
  return fresh;
}
