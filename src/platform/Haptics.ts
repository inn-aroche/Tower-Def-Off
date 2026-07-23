import type { HapticsProvider, HapticStyle } from './types';

/** No-op haptics (default; also used when reduced-motion is requested). */
export class NullHapticsProvider implements HapticsProvider {
  impact(): void {
    // no-op
  }
}

/**
 * Web haptics via the Vibration API (works on Android Chrome / installed PWAs; a no-op elsewhere).
 * When wrapped with Capacitor, swap this for `@capacitor/haptics` behind the same interface.
 * Respects prefers-reduced-motion.
 */
export class WebHapticsProvider implements HapticsProvider {
  private readonly enabled: boolean;

  constructor() {
    const reduced =
      typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.enabled = !reduced && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  impact(style: HapticStyle): void {
    if (!this.enabled) return;
    const ms = style === 'heavy' ? 32 : style === 'medium' ? 16 : 8;
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore — vibration can be blocked by the platform
    }
  }
}
