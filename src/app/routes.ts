export interface ResultsPayload {
  nodeIndex: number;
  outcome: 'victory' | 'defeat';
  stars: number;
  lifeRemaining: number;
  rewards: { gold: number; gems: number; duplicates: Array<{ unitId: string; count: number }> };
}

export type Route =
  | { name: 'hub' }
  | { name: 'collection' }
  | { name: 'unit'; unitId: string }
  | { name: 'deck' }
  | { name: 'combat'; nodeIndex: number }
  | { name: 'results'; payload: ResultsPayload };

export type RouteName = Route['name'];
