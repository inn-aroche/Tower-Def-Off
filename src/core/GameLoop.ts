/**
 * Fixed-timestep simulation loop (30 Hz) driven externally by requestAnimationFrame.
 * Render code should read `alpha` to interpolate between the previous and current sim tick.
 */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
const MAX_STEPS_PER_FRAME = 5; // avoid spiral-of-death after tab suspend

export class GameLoop {
  private accumulator = 0;
  private lastTime: number | null = null;
  private running = false;

  constructor(private readonly step: (dt: number) => void, private readonly render: (alpha: number) => void) {}

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.lastTime = null;
  }

  /** Call once per requestAnimationFrame with a high-resolution timestamp (ms). */
  tick(nowMs: number): void {
    if (!this.running) return;
    if (this.lastTime === null) {
      this.lastTime = nowMs;
    }
    const frameSeconds = Math.min((nowMs - this.lastTime) / 1000, MAX_STEPS_PER_FRAME * SIM_DT);
    this.lastTime = nowMs;
    this.accumulator += frameSeconds;

    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.step(SIM_DT);
      this.accumulator -= SIM_DT;
      steps++;
    }

    const alpha = this.accumulator / SIM_DT;
    this.render(alpha);
  }
}
