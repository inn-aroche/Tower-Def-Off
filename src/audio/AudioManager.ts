export type SfxName = 'towerPlace' | 'towerUpgrade' | 'enemyKill' | 'enemyLeak' | 'waveComplete' | 'refuse';

const SFX_TONES: Record<SfxName, { freq: number; duration: number; type: OscillatorType }> = {
  towerPlace: { freq: 440, duration: 0.08, type: 'square' },
  towerUpgrade: { freq: 660, duration: 0.12, type: 'triangle' },
  enemyKill: { freq: 220, duration: 0.06, type: 'square' },
  enemyLeak: { freq: 110, duration: 0.25, type: 'sawtooth' },
  waveComplete: { freq: 523, duration: 0.3, type: 'sine' },
  refuse: { freq: 90, duration: 0.1, type: 'square' },
};

/**
 * Procedural SFX via raw Web Audio API — no audio asset files needed for the MVP, keeping the
 * initial bundle well under the 8 Mo budget. Swap in real SFX/music files under public/audio/
 * without changing this interface.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  init(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx) return;
    const { freq, duration, type } = SFX_TONES[name];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
