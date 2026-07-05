export type SfxName = 'towerPlace' | 'towerUpgrade' | 'enemyKill' | 'enemyLeak' | 'waveComplete' | 'refuse';

const SFX_TONES: Record<SfxName, { freq: number; duration: number; type: OscillatorType }> = {
  towerPlace: { freq: 440, duration: 0.08, type: 'square' },
  towerUpgrade: { freq: 660, duration: 0.12, type: 'triangle' },
  enemyKill: { freq: 220, duration: 0.06, type: 'square' },
  enemyLeak: { freq: 110, duration: 0.25, type: 'sawtooth' },
  waveComplete: { freq: 523, duration: 0.3, type: 'sine' },
  refuse: { freq: 90, duration: 0.1, type: 'square' },
};

/** Detuned low sine pad + slow LFO on the filter cutoff — a discreet ambient loop with no audio assets. */
const AMBIENT_BASE_FREQS = [65.4, 98.0, 130.8]; // C2, G2, C3 — a quiet open fifth+octave drone

/**
 * Procedural audio via raw Web Audio API — no audio asset files needed for the MVP, keeping the
 * initial bundle well under the 8 Mo budget. Swap in real SFX/music files under public/audio/
 * without changing this interface. Ambient music is muted (not stopped) during ads/interstitials
 * per platform SDK requirements — stopping and restarting oscillators would click/pop.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private ambientGain: GainNode | null = null;
  private ambientNodes: OscillatorNode[] = [];
  private ambientTargetVolume = 0.05;

  init(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.ambientGain) {
      const target = muted ? 0 : this.ambientTargetVolume;
      this.ambientGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.2);
    }
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

  startAmbient(): void {
    if (!this.ctx || this.ambientNodes.length > 0) return;

    const gain = this.ctx.createGain();
    gain.gain.value = this.muted ? 0 : this.ambientTargetVolume;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.connect(filter).connect(this.ctx.destination);

    for (const freq of AMBIENT_BASE_FREQS) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      this.ambientNodes.push(osc);
    }

    // Slow LFO sweeping the filter cutoff so the drone breathes instead of sitting static.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.ambientNodes.push(lfo);

    this.ambientGain = gain;
  }

  stopAmbient(): void {
    for (const osc of this.ambientNodes) osc.stop();
    this.ambientNodes = [];
    this.ambientGain = null;
  }

  setAmbientEnabled(enabled: boolean): void {
    if (enabled) this.startAmbient();
    else this.stopAmbient();
  }
}
