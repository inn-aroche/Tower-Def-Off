import type { AdProvider } from './AdProvider';

declare global {
  interface Window {
    PokiSDK?: {
      init(): Promise<void>;
      gameLoadingFinished(): void;
      gameplayStart(): void;
      gameplayStop(): void;
      commercialBreak(): Promise<void>;
      rewardedBreak(): Promise<boolean>;
      happyTime(): void;
    };
  }
}

/**
 * Poki SDK adapter. Signatures per docs as of the cahier des charges (§15.2) — re-verify against
 * sdk.poki.com before shipping, the SDK surface evolves.
 */
export class PokiProvider implements AdProvider {
  async init(): Promise<void> {
    await window.PokiSDK?.init();
  }
  loadingFinished(): void {
    window.PokiSDK?.gameLoadingFinished();
  }
  gameplayStart(): void {
    window.PokiSDK?.gameplayStart();
  }
  gameplayStop(): void {
    window.PokiSDK?.gameplayStop();
  }
  async interstitial(): Promise<void> {
    await window.PokiSDK?.commercialBreak();
  }
  async rewarded(): Promise<boolean> {
    const withReward = await window.PokiSDK?.rewardedBreak();
    return withReward ?? false;
  }
  happyTime(): void {
    window.PokiSDK?.happyTime();
  }
}
