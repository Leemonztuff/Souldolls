import { Time } from './Time';

export type UpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (alpha: number) => void;

/**
 * Fixed Timestep (60Hz logic) + Variable Render interpolation GameLoop
 */
export class GameLoop {
  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  // Fixed 60Hz logic timestep in seconds (1/60s)
  private readonly fixedDt = 1 / 60;
  // Prevent spiral of death if the game hangs or tab is inactive
  private readonly maxAccumulatedTime = 0.25;

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    // Delta time in seconds
    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp frameTime to avoid large catch-up bursts
    if (frameTime > this.maxAccumulatedTime) {
      frameTime = this.maxAccumulatedTime;
    }

    Time.update(frameTime);
    this.accumulator += frameTime * Time.scale;

    // Consume fixed timesteps for deterministic game logic
    while (this.accumulator >= this.fixedDt) {
      this.onUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Alpha is the fractional progress toward the next tick (for smooth interpolation)
    const alpha = this.accumulator / this.fixedDt;
    this.onRender(alpha);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
