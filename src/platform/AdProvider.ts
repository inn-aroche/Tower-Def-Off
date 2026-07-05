/**
 * Common interface every platform SDK adapter implements. The game only ever calls this
 * interface — never Poki/CrazyGames SDKs directly — so swapping platforms is a one-file change.
 */
export interface AdProvider {
  init(): Promise<void>;
  loadingFinished(): void;
  /** Call on the player's first input or when gameplay resumes after any interruption. */
  gameplayStart(): void;
  /** Call on pause, level end, or game over. */
  gameplayStop(): void;
  /** Resolves once the interstitial has closed (or immediately if none was shown). */
  interstitial(): Promise<void>;
  /** Resolves true if the player earned the reward (ad watched to completion). */
  rewarded(): Promise<boolean>;
  happyTime(): void;
}
