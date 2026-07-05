import { BALANCE } from '../data/balance';

/**
 * Arcade scoring layered on top of the gold economy: points accrue every second, and every kill
 * raises a multiplier applied to that passive gain — so staying aggressive compounds your score
 * instead of just paying for the next tower. Independent of gold/stars; purely for the
 * score/leaderboard-facing feel of a run.
 */
export class ScoreTracker {
  score = 0;
  multiplier = 1;

  reset(): void {
    this.score = 0;
    this.multiplier = 1;
  }

  tick(dt: number): void {
    this.score += BALANCE.scorePerSecondBase * this.multiplier * dt;
  }

  registerKill(): void {
    this.multiplier = Math.min(BALANCE.scoreMultiplierMax, this.multiplier + BALANCE.scoreMultiplierPerKill);
  }
}
