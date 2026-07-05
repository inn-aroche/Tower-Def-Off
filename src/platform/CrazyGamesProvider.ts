import type { AdProvider } from './AdProvider';

type AdCallbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (err: unknown) => void };

declare global {
  interface Window {
    CrazyGames?: {
      SDK: {
        init(): Promise<void>;
        game: { loadingStop(): void; gameplayStart(): void; gameplayStop(): void; happytime(): void };
        ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: AdCallbacks): void };
      };
    };
  }
}

/**
 * CrazyGames SDK v3 adapter. Signatures per docs.crazygames.com as of the cahier des charges
 * (§15.2) — re-verify before shipping, the SDK surface evolves.
 */
export class CrazyGamesProvider implements AdProvider {
  async init(): Promise<void> {
    await window.CrazyGames?.SDK.init();
  }
  loadingFinished(): void {
    window.CrazyGames?.SDK.game.loadingStop();
  }
  gameplayStart(): void {
    window.CrazyGames?.SDK.game.gameplayStart();
  }
  gameplayStop(): void {
    window.CrazyGames?.SDK.game.gameplayStop();
  }
  interstitial(): Promise<void> {
    return new Promise((resolve) => {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return resolve();
      sdk.ad.requestAd('midgame', {
        adFinished: () => resolve(),
        adError: () => resolve(), // never block gameplay on ad failure/adblock/cooldown
      });
    });
  }
  rewarded(): Promise<boolean> {
    return new Promise((resolve) => {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return resolve(false);
      sdk.ad.requestAd('rewarded', {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    });
  }
  happyTime(): void {
    window.CrazyGames?.SDK.game.happytime();
  }
}
