import type { AudioProvider, SfxName } from './types';

/** No-op audio (default; used in tests/headless and when sound is off). */
export class NullAudioProvider implements AudioProvider {
  resume(): void {}
  setEnabled(): void {}
  play(): void {}
}

/**
 * Procedural WebAudio SFX — no asset files, so it works everywhere (incl. the shared artifact).
 * Sounds are short synthesized envelopes. Swap for sampled audio behind this same interface later.
 * Autoplay policy: call resume() from a user gesture before the first play.
 */
export class WebAudioProvider implements AudioProvider {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private readonly lastPlayed = new Map<SfxName, number>();

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  resume(): void {
    if (!this.ensure()) return;
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(sound: SfxName): void {
    if (!this.enabled || !this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    // Throttle spammy sounds (many hits/kills per second).
    const minGap = sound === 'hit' ? 0.05 : sound === 'kill' ? 0.04 : 0;
    if (minGap > 0) {
      const last = this.lastPlayed.get(sound) ?? -1;
      if (now - last < minGap) return;
      this.lastPlayed.set(sound, now);
    }
    switch (sound) {
      case 'summon':
        this.tone(now, 'triangle', 300, 460, 0.13, 0.5);
        break;
      case 'merge':
        this.tone(now, 'triangle', 523, 523, 0.1, 0.6);
        this.tone(now + 0.08, 'triangle', 784, 880, 0.16, 0.6);
        break;
      case 'kill':
        this.noise(now, 0.12, 900, 0.5);
        break;
      case 'baseHit':
        this.tone(now, 'sine', 130, 70, 0.22, 0.9);
        this.noise(now, 0.16, 500, 0.5);
        break;
      case 'hit':
        this.tone(now, 'square', 880, 720, 0.035, 0.18);
        break;
    }
  }

  private tone(at: number, type: OscillatorType, from: number, to: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, filterHz: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterHz, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterHz * 0.25), at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }
}
