/**
 * Retention layer data — lifetime achievements, rotating daily quests, and a free daily chest.
 * Pure data + deterministic selection (no RNG): the daily quest set is a function of the date string,
 * so it's stable within a day and testable. Rewards are honest and generous (studio no-dark-patterns
 * rule): everything is claimable for free, nothing is gated behind payment or timers-with-skips.
 */

export type AchievementMetric =
  | 'combatsWon'
  | 'enemiesKilled'
  | 'pvpWins'
  | 'merges'
  | 'survivalBest'
  | 'trophies'
  | 'unitsOwned';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  metric: AchievementMetric;
  target: number;
  reward: { gold: number; gems: number };
}

/** Lifetime milestones — claim once the metric reaches the target. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', title: 'Première victoire', desc: 'Gagne 1 combat', metric: 'combatsWon', target: 1, reward: { gold: 100, gems: 5 } },
  { id: 'veteran', title: 'Vétéran', desc: 'Gagne 25 combats', metric: 'combatsWon', target: 25, reward: { gold: 500, gems: 15 } },
  { id: 'scourge', title: 'Fléau', desc: 'Élimine 500 ennemis', metric: 'enemiesKilled', target: 500, reward: { gold: 400, gems: 10 } },
  { id: 'duelist', title: 'Duelliste', desc: 'Gagne 10 combats d’arène', metric: 'pvpWins', target: 10, reward: { gold: 500, gems: 20 } },
  { id: 'survivor', title: 'Survivant', desc: 'Atteins la vague 10 en Survie', metric: 'survivalBest', target: 10, reward: { gold: 400, gems: 15 } },
  { id: 'collector', title: 'Collectionneur', desc: 'Débloque 10 unités', metric: 'unitsOwned', target: 10, reward: { gold: 300, gems: 20 } },
  { id: 'merger', title: 'Maître fusion', desc: 'Fusionne 50 unités', metric: 'merges', target: 50, reward: { gold: 400, gems: 10 } },
  { id: 'climber', title: 'Grimpeur', desc: 'Atteins 500 trophées', metric: 'trophies', target: 500, reward: { gold: 500, gems: 25 } },
];

export type DailyMetric = 'wins' | 'kills' | 'blitz';

export interface DailyQuest {
  id: string;
  title: string;
  metric: DailyMetric;
  target: number;
  reward: { gold: number; gems: number };
}

const DAILY_POOL: DailyQuest[] = [
  { id: 'win3', title: 'Gagne 3 combats', metric: 'wins', target: 3, reward: { gold: 120, gems: 3 } },
  { id: 'win5', title: 'Gagne 5 combats', metric: 'wins', target: 5, reward: { gold: 200, gems: 5 } },
  { id: 'kill150', title: 'Élimine 150 ennemis', metric: 'kills', target: 150, reward: { gold: 120, gems: 3 } },
  { id: 'kill300', title: 'Élimine 300 ennemis', metric: 'kills', target: 300, reward: { gold: 220, gems: 5 } },
  { id: 'blitz1', title: 'Joue un combat Blitz', metric: 'blitz', target: 1, reward: { gold: 100, gems: 4 } },
];

/** Free daily chest reward. */
export const DAILY_CHEST_REWARD = { gold: 150, gems: 5 };

/** Deterministic day hash (FNV-1a over the YYYY-MM-DD string). */
function hashDate(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The 3 daily quests for a given date — stable within the day, varied across days. */
export function dailyQuestsFor(dateStr: string): DailyQuest[] {
  const start = hashDate(dateStr) % DAILY_POOL.length;
  const picks: DailyQuest[] = [];
  const seenMetric = new Set<DailyMetric>();
  for (let i = 0; i < DAILY_POOL.length && picks.length < 3; i++) {
    const q = DAILY_POOL[(start + i) % DAILY_POOL.length];
    if (seenMetric.has(q.metric)) continue; // one quest per metric per day for variety
    seenMetric.add(q.metric);
    picks.push(q);
  }
  return picks;
}

/** Local calendar day as YYYY-MM-DD (meta layer only — never used inside the deterministic sim). */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
