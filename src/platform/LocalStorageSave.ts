import type { SaveEnvelope, SaveProvider } from './types';

/**
 * Versioned localStorage save. `migrate` receives any envelope with a lower schemaVersion than
 * `schemaVersion` and must return current-shape data — required so M3+ can evolve SaveData
 * without breaking existing local saves.
 */
export class LocalStorageSaveProvider<T> implements SaveProvider<T> {
  constructor(
    private readonly key: string,
    private readonly schemaVersion: number,
    private readonly migrate: (envelope: SaveEnvelope<unknown>) => T,
  ) {}

  load(): T | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw) as SaveEnvelope<unknown>;
      if (envelope.schemaVersion === this.schemaVersion) return envelope.data as T;
      return this.migrate(envelope);
    } catch {
      return null;
    }
  }

  save(data: T): void {
    if (typeof localStorage === 'undefined') return;
    const envelope: SaveEnvelope<T> = { schemaVersion: this.schemaVersion, data };
    localStorage.setItem(this.key, JSON.stringify(envelope));
  }

  clear(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.key);
  }
}
