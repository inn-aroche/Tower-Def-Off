export interface ResultsPayload {
  nodeIndex: number;
  outcome: 'victory' | 'defeat';
  stars: number;
  lifeRemaining: number;
  rewards: { gold: number; gems: number; duplicates: Array<{ unitId: string; count: number }> };
}

export interface SurvivalResultPayload {
  wavesReached: number;
  bestWave: number;
  isRecord: boolean;
  kills: number;
  rewards: { gold: number; gems: number };
}

export interface PvpResultPayload {
  outcome: 'victory' | 'defeat' | 'draw';
  playerLife: number;
  botLife: number;
  trophiesDelta: number;
  totalTrophies: number;
  leagueName: string;
  botName: string;
  blitz: boolean;
}

export type Route =
  | { name: 'hub' }
  | { name: 'collection' }
  | { name: 'unit'; unitId: string }
  | { name: 'deck' }
  | { name: 'combat'; nodeIndex: number }
  | { name: 'results'; payload: ResultsPayload }
  | { name: 'survivalHome' }
  | { name: 'survival' }
  | { name: 'survivalResults'; payload: SurvivalResultPayload }
  | { name: 'arena' }
  | { name: 'heroes' }
  | { name: 'hero'; heroId: string }
  | { name: 'challenges' }
  | { name: 'pvp'; blitz?: boolean }
  | { name: 'pvpResults'; payload: PvpResultPayload }
  | { name: 'shop' }
  | { name: 'chest'; kind: 'common' | 'epic' }
  | { name: 'settings' };

export type RouteName = Route['name'];
