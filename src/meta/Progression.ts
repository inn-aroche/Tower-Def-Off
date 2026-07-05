import type { SaveManager } from './SaveManager';
import { SKINS } from '../data/skins';

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

  /** Records a level result and unlocks any cosmetic skins the new total star count qualifies for. */
  recordLevelResult(levelId: number, stars: number): string[] {
    this.save.setStars(levelId, stars);
    const total = this.totalStars();
    const newlyUnlocked: string[] = [];
    for (const skin of SKINS) {
      if (total >= skin.starsRequired && !this.save.isSkinUnlocked(skin.id)) {
        this.save.unlockSkin(skin.id);
        newlyUnlocked.push(skin.id);
      }
    }
    return newlyUnlocked;
  }

  totalStars(): number {
    let sum = 0;
    for (let i = 1; i <= TOTAL_LEVELS; i++) sum += this.save.getStars(i);
    return sum;
  }
}
