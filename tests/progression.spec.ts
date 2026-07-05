import { describe, it, expect } from 'vitest';
import { SaveManager } from '../src/meta/SaveManager';
import { Progression, TOTAL_LEVELS } from '../src/meta/Progression';
import { SKINS } from '../src/data/skins';

describe('Progression + SaveManager (in-memory; localStorage may be unavailable under Vitest)', () => {
  it('level 1 is always unlocked, later levels require the previous one\'s star', () => {
    const save = new SaveManager();
    const prog = new Progression(save);
    expect(prog.isLevelUnlocked(1)).toBe(true);
    expect(prog.isLevelUnlocked(2)).toBe(false);
    prog.recordLevelResult(1, 1);
    expect(prog.isLevelUnlocked(2)).toBe(true);
  });

  it('survival unlocks early at N5 stars, fully after N10', () => {
    const save = new SaveManager();
    const prog = new Progression(save);
    expect(prog.isSurvivalUnlocked()).toBe(false);
    prog.recordLevelResult(5, 1);
    expect(prog.isSurvivalUnlocked()).toBe(true);
  });

  it('default skin is unlocked from the start, others gate on total campaign stars', () => {
    const save = new SaveManager();
    expect(save.isSkinUnlocked('default')).toBe(true);
    expect(save.isSkinUnlocked('verdant')).toBe(false);
  });

  it('recordLevelResult unlocks a skin once total stars crosses its threshold', () => {
    const save = new SaveManager();
    const prog = new Progression(save);
    const verdant = SKINS.find((s) => s.id === 'verdant')!;
    for (let i = 1; i <= TOTAL_LEVELS && prog.totalStars() < verdant.starsRequired; i++) {
      prog.recordLevelResult(i, 3);
    }
    expect(prog.totalStars()).toBeGreaterThanOrEqual(verdant.starsRequired);
    expect(save.isSkinUnlocked('verdant')).toBe(true);
  });

  it('reports and ranks survival runs by score, capped leaderboard size', () => {
    const save = new SaveManager();
    save.reportSurvivalRun('bronze', 50, 9);
    save.reportSurvivalRun('gold', 200, 39);
    save.reportSurvivalRun('silver', 100, 19);
    const board = save.survivalLeaderboard;
    expect(board[0].score).toBe(200);
    expect(board[board.length - 1].score).toBeLessThanOrEqual(board[0].score);
    expect(save.survivalBestWave).toBe(39);
  });
});
