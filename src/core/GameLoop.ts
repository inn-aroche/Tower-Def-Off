export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private readonly maxDeltaS = 0.1; // clamp huge gaps (tab backgrounded) to avoid catch-up spirals

  constructor(private readonly onTick: (dtSeconds: number) => void) {}

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, this.maxDeltaS);
      this.lastTime = now;
      this.onTick(dt);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
