export type GameEventMap = {
  towerPlaced: { towerId: string; col: number; row: number };
  towerPlacementRefused: { col: number; row: number; reason: string };
  towerSold: { towerId: string; refund: number };
  towerUpgraded: { towerId: string; tier: number };
  enemySpawned: { enemyId: string; type: string };
  enemyKilled: { enemyId: string; bounty: number; col: number; row: number };
  enemyLeaked: { enemyId: string; damage: number };
  towerDisabled: { towerId: string; duration: number };
  projectileFired: { towerId: string; targetId: string };
  waveStarted: { waveIndex: number };
  waveCompleted: { waveIndex: number; bonus: number };
  waveCalledEarly: { waveIndex: number; bonusPct: number };
  flowFieldRecomputed: Record<string, never>;
  levelWon: { starsEarned: number };
  levelLost: Record<string, never>;
  goldChanged: { gold: number };
  livesChanged: { lives: number };
};

type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub. Used across sim/render/ui without coupling them directly. */
export class EventBus {
  private handlers: { [K in keyof GameEventMap]?: Set<Handler<GameEventMap[K]>> } = {};

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    const handlers = this.handlers as Record<string, Set<Handler<unknown>> | undefined>;
    let set = handlers[event as string];
    if (!set) {
      set = new Set();
      handlers[event as string] = set;
    }
    set.add(handler as Handler<unknown>);
    return () => set!.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.handlers[event];
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}
