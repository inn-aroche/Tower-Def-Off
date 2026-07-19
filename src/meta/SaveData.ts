import type { SaveEnvelope } from '../platform/types';

/** M1 only persists campaign position. Collection/progression/league land in M3-M4 and extend
 * this shape — bump SAVE_SCHEMA_VERSION and add a branch in migrateSaveData when that happens. */
export interface SaveData {
  settings: { soundOn: boolean };
  campaign: { currentLevelIndex: number };
}

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_KEY = 'wardens_save';

export function createDefaultSaveData(): SaveData {
  return { settings: { soundOn: true }, campaign: { currentLevelIndex: 0 } };
}

export function migrateSaveData(_envelope: SaveEnvelope<unknown>): SaveData {
  // No prior schema versions yet — fall back to a fresh save.
  return createDefaultSaveData();
}
