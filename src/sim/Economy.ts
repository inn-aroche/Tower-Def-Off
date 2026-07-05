import { BALANCE, waveCompletionBonus, earlyCallBonus } from '../data/balance';
import type { EventBus } from '../core/EventBus';

export class Economy {
  gold: number;
  lives: number;
  private readonly maxLives: number;

  constructor(private readonly bus: EventBus, startGold: number = BALANCE.startGoldDefault, startLives: number = BALANCE.baseLivesDefault) {
    this.gold = startGold;
    this.lives = startLives;
    this.maxLives = startLives;
  }

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.gold -= cost;
    this.bus.emit('goldChanged', { gold: this.gold });
    return true;
  }

  earn(amount: number): void {
    this.gold += amount;
    this.bus.emit('goldChanged', { gold: this.gold });
  }

  loseLives(amount: number): void {
    this.lives = Math.max(0, this.lives - amount);
    this.bus.emit('livesChanged', { lives: this.lives });
  }

  get isDefeated(): boolean {
    return this.lives <= 0;
  }

  get livesRatio(): number {
    return this.lives / this.maxLives;
  }

  grantWaveCompletionBonus(waveIndex: number): number {
    const bonus = waveCompletionBonus(waveIndex);
    this.earn(bonus);
    return bonus;
  }

  grantEarlyCallBonus(nextWaveIndex: number, remainingFraction: number): number {
    const bonus = earlyCallBonus(waveCompletionBonus(nextWaveIndex), remainingFraction);
    this.earn(bonus);
    return bonus;
  }
}
