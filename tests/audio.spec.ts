import { describe, expect, it } from 'vitest';
import { NullAudioProvider, WebAudioProvider } from '../src/platform/Audio';
import type { AudioProvider } from '../src/platform/types';

describe('audio providers', () => {
  it('NullAudioProvider is a safe no-op', () => {
    const a: AudioProvider = new NullAudioProvider();
    expect(() => {
      a.resume();
      a.setEnabled(true);
      a.play('merge');
    }).not.toThrow();
  });

  it('WebAudioProvider degrades gracefully without an AudioContext (headless/node)', () => {
    // No window.AudioContext in the vitest node env — must not throw, just do nothing.
    const a = new WebAudioProvider();
    expect(() => {
      a.setEnabled(true);
      a.resume();
      a.play('summon');
      a.play('hit');
    }).not.toThrow();
  });
});
