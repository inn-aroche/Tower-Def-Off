import type { AdProvider, AnalyticsProvider, IapProvider, PurchaseResult, RewardedResult } from './types';

/** No-op ad provider. Real SDK (AdMob via Capacitor) plugs in behind AdProvider in M5. */
export class NullAdProvider implements AdProvider {
  isRewardedAvailable(): boolean {
    return false;
  }

  async showRewarded(): Promise<RewardedResult> {
    return 'unavailable';
  }

  async showInterstitial(): Promise<void> {
    // no-op — interstitials are never shown in v1 per studio no-dark-pattern rule anyway
  }
}

/** No-op IAP provider. Real store billing plugs in behind IapProvider in M5. */
export class NullIapProvider implements IapProvider {
  async getProduct(): Promise<null> {
    return null;
  }

  async purchase(): Promise<PurchaseResult> {
    return 'failed';
  }

  async restore(): Promise<string[]> {
    return [];
  }
}

/** In-memory analytics sink. Logs to console so the tracking plan is verifiable during dev;
 * a real backend (Supabase/GameAnalytics) plugs in behind AnalyticsProvider later. */
export class NullAnalyticsProvider implements AnalyticsProvider {
  readonly events: Array<{ event: string; props?: Record<string, unknown>; atMs: number }> = [];

  track(event: string, props?: Record<string, unknown>): void {
    this.events.push({ event, props, atMs: Date.now() });
    if (typeof console !== 'undefined') {
      console.debug(`[analytics] ${event}`, props ?? {});
    }
  }
}
