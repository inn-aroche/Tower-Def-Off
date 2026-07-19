// Local-first event logger. P-1 has no backend, so events are kept in a bounded
// in-memory + localStorage ring buffer for QA/debugging and are never sent anywhere.
// Event names/properties follow docs/TRACKING_PLAN.md — keep them in sync.

export type TrackingEvent =
  | { name: 'app_open'; props: Record<string, never> }
  | { name: 'class_selected'; props: { class_id: string; is_first_pick: boolean } }
  | { name: 'class_switched'; props: { from: string; to: string } }
  | { name: 'run_start'; props: { class_id: string; map_id: string; starting_gold: number } }
  | { name: 'wave_start'; props: { wave: number; is_boss_wave: boolean } }
  | { name: 'wave_cleared'; props: { wave: number; gold: number; keep_hp_pct: number } }
  | { name: 'tower_placed'; props: { tower_kind: string; cost: number; wave: number } }
  | { name: 'tower_upgraded'; props: { tower_kind: string; tier: number; cost: number; wave: number } }
  | { name: 'tower_sold'; props: { tower_kind: string; tier: number; refund: number; wave: number } }
  | { name: 'ultimate_used'; props: { class_id: string; wave: number } }
  | { name: 'run_end'; props: { reason: 'defeat' | 'quit'; waves_survived: number; kills: number; essence_earned: number; duration_s: number } }
  | { name: 'skill_node_unlocked'; props: { class_id: string; branch: string; tier: number; essence_spent: number } }
  | { name: 'settings_changed'; props: { key: string; value: string } };

const STORAGE_KEY = 'runeforge-defense-events-v1';
const MAX_BUFFERED = 200;

export class Analytics {
  private buffer: (TrackingEvent & { ts: number })[] = [];

  track<E extends TrackingEvent>(event: E): void {
    const entry = { ...event, ts: Date.now() };
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFERED) this.buffer.shift();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
    } catch {
      // best-effort only
    }
    if (import.meta.env.DEV) console.debug('[analytics]', event.name, event.props);
  }

  exportLog(): string {
    return JSON.stringify(this.buffer, null, 2);
  }
}

export const analytics = new Analytics();
