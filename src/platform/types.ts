/** Platform-boundary interfaces. Real integrations (ads SDK, store IAP, analytics backend) plug
 * in behind these later; only NullProviders and local save exist in M1. */

export interface SaveEnvelope<T> {
  schemaVersion: number;
  data: T;
}

export interface SaveProvider<T> {
  load(): T | null;
  save(data: T): void;
  clear(): void;
}

export type RewardedResult = 'completed' | 'skipped' | 'failed' | 'unavailable';

export interface AdProvider {
  isRewardedAvailable(placement: string): boolean;
  showRewarded(placement: string): Promise<RewardedResult>;
  showInterstitial(placement: string): Promise<void>;
}

export interface IapProduct {
  id: string;
  priceLabel: string;
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

export interface IapProvider {
  getProduct(id: string): Promise<IapProduct | null>;
  purchase(id: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}

export interface AnalyticsProvider {
  track(event: string, props?: Record<string, unknown>): void;
}

export type HapticStyle = 'light' | 'medium' | 'heavy';

export interface HapticsProvider {
  impact(style: HapticStyle): void;
}

export type SfxName = 'summon' | 'merge' | 'kill' | 'baseHit' | 'hit';

export interface AudioProvider {
  /** Resume the audio pipeline after a user gesture (autoplay policy). */
  resume(): void;
  setEnabled(enabled: boolean): void;
  play(sound: SfxName): void;
}
