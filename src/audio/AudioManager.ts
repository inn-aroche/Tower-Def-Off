// Procedural WebAudio SFX — no audio asset files needed, keeps the build fully self-contained.
export type SfxKind = 'place' | 'upgrade' | 'sell' | 'shoot' | 'hit' | 'waveClear' | 'defeat' | 'ultimate' | 'nodeUnlock' | 'tap';

export class AudioManager {
  private ctx: AudioContext | null = null;
  enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(kind: SfxKind): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const spec = SPECS[kind];
    for (const note of spec) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      if (note.slideTo) osc.frequency.linearRampToValueAtTime(note.slideTo, now + note.start + note.dur);
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(note.volume, now + note.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }
  }
}

interface Note {
  type: OscillatorType;
  freq: number;
  slideTo?: number;
  start: number;
  dur: number;
  volume: number;
}

const SPECS: Record<SfxKind, Note[]> = {
  tap: [{ type: 'triangle', freq: 440, start: 0, dur: 0.05, volume: 0.15 }],
  place: [{ type: 'square', freq: 300, slideTo: 500, start: 0, dur: 0.09, volume: 0.18 }],
  upgrade: [
    { type: 'square', freq: 400, start: 0, dur: 0.07, volume: 0.16 },
    { type: 'square', freq: 600, start: 0.07, dur: 0.09, volume: 0.16 },
  ],
  sell: [{ type: 'triangle', freq: 500, slideTo: 250, start: 0, dur: 0.12, volume: 0.15 }],
  shoot: [{ type: 'triangle', freq: 700, slideTo: 500, start: 0, dur: 0.05, volume: 0.06 }],
  hit: [{ type: 'square', freq: 180, start: 0, dur: 0.05, volume: 0.08 }],
  waveClear: [
    { type: 'triangle', freq: 523, start: 0, dur: 0.1, volume: 0.18 },
    { type: 'triangle', freq: 659, start: 0.1, dur: 0.1, volume: 0.18 },
    { type: 'triangle', freq: 784, start: 0.2, dur: 0.18, volume: 0.18 },
  ],
  defeat: [
    { type: 'sawtooth', freq: 220, slideTo: 110, start: 0, dur: 0.5, volume: 0.15 },
  ],
  ultimate: [
    { type: 'sawtooth', freq: 200, slideTo: 800, start: 0, dur: 0.25, volume: 0.2 },
  ],
  nodeUnlock: [
    { type: 'triangle', freq: 660, start: 0, dur: 0.08, volume: 0.16 },
    { type: 'triangle', freq: 990, start: 0.08, dur: 0.12, volume: 0.16 },
  ],
};
