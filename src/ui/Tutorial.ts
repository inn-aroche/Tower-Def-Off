import type { EventBus } from '../core/EventBus';

interface HintStep {
  text: string;
  /** Resolves once whatever this hint is teaching has been demonstrated by the player. */
  advanceOn: (bus: EventBus, done: () => void) => () => void;
  /** Fallback auto-advance so a hint never blocks progress if the trigger event never fires. */
  timeoutMs?: number;
}

const STEPS: HintStep[] = [
  {
    text: "Les ennemis arrivent par le vert et visent le rouge. Pose une tour pour leur barrer la route !",
    advanceOn: (bus, done) => bus.on('towerPlaced', () => done()),
    timeoutMs: 15000,
  },
  {
    text: 'Bien joué — le chemin vient de se rallonger ! Chaque ennemi vaincu rapporte de l\'or.',
    advanceOn: (bus, done) => bus.on('enemyKilled', () => done()),
    timeoutMs: 12000,
  },
  {
    text: 'Astuce : lance la vague suivante en avance pour gagner un bonus d\'or.',
    advanceOn: (bus, done) => bus.on('waveCalledEarly', () => done()),
    timeoutMs: 10000,
  },
];

/** Non-blocking, self-dismissing onboarding hints for the first playthrough of N1 (§13). Shown once, never a text wall. */
export class Tutorial {
  private banner: HTMLDivElement;
  private stepIndex = 0;
  private cleanupCurrent: (() => void) | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private hudObserver: ResizeObserver | null = null;

  constructor(private readonly container: HTMLElement, private readonly bus: EventBus) {
    this.banner = document.createElement('div');
    this.banner.className = 'tutorial-banner';
    this.banner.style.display = 'none';
    container.appendChild(this.banner);
    this.injectStyles();
  }

  start(): void {
    this.stepIndex = 0;
    this.ensureHudObserver();
    this.showStep();
  }

  /** The HUD's top bar can wrap to a second row (early-call button, narrow portrait screens), so
   * its height isn't a fixed constant — track it live instead of guessing a pixel offset. */
  private ensureHudObserver(): void {
    if (this.hudObserver) return;
    const hudTop = this.container.querySelector<HTMLElement>('.hud-top');
    if (!hudTop) return;
    const reposition = () => {
      this.banner.style.top = `${hudTop.getBoundingClientRect().height + 8}px`;
    };
    reposition();
    this.hudObserver = new ResizeObserver(reposition);
    this.hudObserver.observe(hudTop);
  }

  stop(): void {
    this.cleanupCurrent?.();
    this.cleanupCurrent = null;
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.banner.style.display = 'none';
  }

  private showStep(): void {
    this.cleanupCurrent?.();
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);

    const step = STEPS[this.stepIndex];
    if (!step) {
      this.banner.style.display = 'none';
      return;
    }

    this.banner.textContent = step.text;
    this.banner.style.display = 'block';

    const advance = () => {
      this.stepIndex++;
      this.showStep();
    };
    this.cleanupCurrent = step.advanceOn(this.bus, advance);
    if (step.timeoutMs) {
      this.timeoutHandle = setTimeout(advance, step.timeoutMs);
    }
  }

  private injectStyles(): void {
    if (document.getElementById('tutorial-styles')) return;
    const style = document.createElement('style');
    style.id = 'tutorial-styles';
    style.textContent = `
      .tutorial-banner { position: absolute; top: 62px; left: 50%; transform: translateX(-50%); max-width: min(90vw, 480px);
        /* 'top' above is only the first-paint fallback — ensureHudObserver() overrides it inline once the actual HUD height is known. */
        padding: 10px 18px; background: rgba(112,161,255,0.15); border: 1px solid #70a1ff; border-radius: 10px;
        color: #f1f2f6; font-family: system-ui, sans-serif; font-size: 14px; text-align: center; pointer-events: none; }
    `;
    document.head.appendChild(style);
  }
}
