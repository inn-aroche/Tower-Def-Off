import { el } from './dom';
import type { CombatSnapshot } from '../sim/types';

/**
 * First-combat FTUE: non-blocking coach marks over the battle canvas. Driven purely by observing
 * the sim snapshot each frame (no hooks into combat logic), so it never interferes with play. The
 * player can still tap through; a Passer link skips it. Calls onDone once, after which the caller
 * persists the "seen" flag so it never shows again.
 */

type Zone = 'hand' | 'board' | 'none';

interface Step {
  text: string;
  zone: Zone;
  /** True when this step's goal is met, given the current snapshot. */
  done: (s: CombatSnapshot) => boolean;
}

function mergeablePair(s: CombatSnapshot): boolean {
  const counts = new Map<string, number>();
  for (const u of s.units) {
    if (u.level !== 1) continue;
    const n = (counts.get(u.unitId) ?? 0) + 1;
    if (n >= 2) return true;
    counts.set(u.unitId, n);
  }
  return false;
}

const STEPS: Step[] = [
  { text: 'Touche une carte en bas, puis pose ton unité sur une case herbe.', zone: 'hand', done: (s) => s.units.length >= 1 },
  { text: 'Bien ! Pose une 2ᵉ unité identique (la même carte).', zone: 'hand', done: mergeablePair },
  { text: 'Fusionne-les : touche une unité, puis l’autre identique.', zone: 'board', done: (s) => s.units.some((u) => u.level >= 2) },
  { text: 'Parfait ! Défends ta base — élimine les vagues.', zone: 'none', done: () => false },
];

export class TutorialCoach {
  private readonly root: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly highlight: HTMLElement;
  private step = 0;
  private finished = false;
  private lastStepDoneAt: number | null = null;

  constructor(host: HTMLElement, private readonly onDone: () => void) {
    this.highlight = el('div', {
      style:
        'position:absolute;border:3px solid #f0c26a;border-radius:14px;box-shadow:0 0 0 2000px rgba(20,12,6,0.28);' +
        'pointer-events:none;transition:all .25s ease;animation:wardensPulse 1.1s ease-in-out infinite',
    });
    this.banner = el('div', {
      style:
        'position:absolute;left:16px;right:16px;bottom:150px;z-index:31;background:rgba(43,30,20,0.95);color:#fff;' +
        'border:1.5px solid #f0c26a;border-radius:14px;padding:12px 14px;font:800 13px "Baloo 2",sans-serif;text-align:center;' +
        'box-shadow:0 6px 16px rgba(0,0,0,.35)',
    });
    const skip = el('button', {
      text: 'Passer ›',
      style:
        'position:absolute;top:52px;right:12px;z-index:32;background:rgba(0,0,0,0.4);color:#f0c26a;border:none;' +
        'border-radius:10px;padding:6px 10px;font:700 11px "Nunito",sans-serif;cursor:pointer;pointer-events:auto',
      onclick: () => this.finish(),
    });
    this.root = el('div', { style: 'position:absolute;inset:0;z-index:30;pointer-events:none' }, [this.highlight, this.banner, skip]);

    if (!document.getElementById('wardens-tut-kf')) {
      const style = el('style', { id: 'wardens-tut-kf' });
      style.textContent = '@keyframes wardensPulse{0%,100%{opacity:.55}50%{opacity:1}}';
      document.head.appendChild(style);
    }
    host.append(this.root);
    this.render();
  }

  update(snapshot: CombatSnapshot): void {
    if (this.finished) return;
    // Advance through any completed steps.
    while (this.step < STEPS.length - 1 && STEPS[this.step].done(snapshot)) {
      this.step++;
      this.lastStepDoneAt = null;
      this.render();
    }
    // Final "defend" step auto-dismisses after a short beat.
    if (this.step === STEPS.length - 1) {
      if (this.lastStepDoneAt === null) this.lastStepDoneAt = snapshot.elapsedSec;
      else if (snapshot.elapsedSec - this.lastStepDoneAt > 3) this.finish();
    }
  }

  private render(): void {
    const s = STEPS[this.step];
    this.banner.textContent = s.text;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (s.zone === 'hand') {
      this.highlight.style.cssText += ';display:block';
      this.setBox(8, h - 108, w - 16, 96);
    } else if (s.zone === 'board') {
      this.setBox(w * 0.12, h * 0.28, w * 0.76, h * 0.34);
    } else {
      this.highlight.style.display = 'none';
    }
  }

  private setBox(x: number, y: number, w: number, hh: number): void {
    this.highlight.style.display = 'block';
    this.highlight.style.left = `${x}px`;
    this.highlight.style.top = `${y}px`;
    this.highlight.style.width = `${w}px`;
    this.highlight.style.height = `${hh}px`;
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.destroy();
    this.onDone();
  }

  destroy(): void {
    this.root.remove();
  }
}
