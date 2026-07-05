import type { AdProvider } from './AdProvider';

/** Dev-local provider: no ads, no network, instant resolutions. Used outside Poki/CrazyGames iframes. */
export class NullProvider implements AdProvider {
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async interstitial(): Promise<void> {}
  async rewarded(): Promise<boolean> {
    return true;
  }
  happyTime(): void {}
}
