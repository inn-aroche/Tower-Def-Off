import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { Economy } from '../src/sim/Economy';
import { waveCompletionBonus, earlyCallBonus } from '../src/data/balance';

describe('Economy', () => {
  it('starts with configured gold and lives', () => {
    const economy = new Economy(new EventBus(), 100, 20);
    expect(economy.gold).toBe(100);
    expect(economy.lives).toBe(20);
    expect(economy.isDefeated).toBe(false);
  });

  it('cannot spend more gold than available', () => {
    const economy = new Economy(new EventBus(), 50, 20);
    expect(economy.spend(100)).toBe(false);
    expect(economy.gold).toBe(50);
    expect(economy.spend(50)).toBe(true);
    expect(economy.gold).toBe(0);
  });

  it('is defeated once lives reach zero', () => {
    const economy = new Economy(new EventBus(), 100, 5);
    economy.loseLives(5);
    expect(economy.isDefeated).toBe(true);
    expect(economy.lives).toBe(0);
  });

  it('never drops lives below zero', () => {
    const economy = new Economy(new EventBus(), 100, 3);
    economy.loseLives(10);
    expect(economy.lives).toBe(0);
  });

  it('wave completion bonus grows with wave index', () => {
    expect(waveCompletionBonus(0)).toBe(10);
    expect(waveCompletionBonus(5)).toBe(20);
  });

  it('early call bonus scales with remaining time fraction', () => {
    expect(earlyCallBonus(100, 1)).toBe(25);
    expect(earlyCallBonus(100, 0.5)).toBe(13);
    expect(earlyCallBonus(100, 0)).toBe(0);
  });
});
