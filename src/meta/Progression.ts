import type { SaveManager } from './SaveManager';

export const TOTAL_LEVELS = 10;
/** Access to Survie unlocks fully after N10, but early access opens after N5 (§11). */
const SURVIVAL_EARLY_ACCESS_LEVEL = 5;

export class Progression {
  constructor(private readonly save: SaveManager) {}

  isLevelUnlocked(levelId: number): boolean {
    if (levelId <= 1) return true;
    return this.save.getStars(levelId - 1) > 0;
  }

  isSurvivalUnlocked(): boolean {
    return this.save.getStars(SURVIVAL_EARLY_ACCESS_LEVEL) > 0 || this.save.getStars(TOTAL_LEVELS) > 0;
  }

  recordLevelResult(levelId: number, stars: number): void {
    this.save.setStars(levelId, stars);
  }

  totalStars(): number {
    let sum = 0;
    for (let i = 1; i <= TOTAL_LEVELS; i++) sum += this.save.getStars(i);
    return sum;
  }
}
