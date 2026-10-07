import { Time } from './Time';

export type UpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (alpha: number) => void;
export type FrameP95Callback = (p95Ms: number) => void;

/**
 * Fixed Timestep (60Hz logic) + Variable Render interpolation GameLoop
 */
export class GameLoop {
  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private readonly frameTimes = new Float32Array(120);
  private readonly sortedFrameTimes = new Float32Array(120);
  private frameSampleCount = 0;
  private frameSampleWrite = 0;
  private lastP95Report = 0;

  // Fixed 60Hz logic timestep in seconds (1/60s)
  private readonly fixedDt = 1 / 60;
  // Prevent spiral of death if the game hangs or tab is inactive
  private readonly maxAccumulatedTime = 0.25;

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback, onFrameP95?: FrameP95Callback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onFrameP95 = onFrameP95;
  }

  private onFrameP95?: FrameP95Callback;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameSampleCount = 0;
    this.frameSampleWrite = 0;
    this.lastP95Report = 0;
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
    const frameMs = frameTime * 1000;
    this.frameTimes[this.frameSampleWrite] = frameMs;
    this.frameSampleWrite = (this.frameSampleWrite + 1) % this.frameTimes.length;
    this.frameSampleCount = Math.min(this.frameSampleCount + 1, this.frameTimes.length);

    if (this.onFrameP95 && currentTime - this.lastP95Report >= 1000 && this.frameSampleCount >= 5) {
      this.lastP95Report = currentTime;
      for (let i = 0; i < this.frameSampleCount; i++) {
        this.sortedFrameTimes[i] = this.frameTimes[i];
      }
      this.sortedFrameTimes.subarray(0, this.frameSampleCount).sort();
      const p95Index = Math.max(0, Math.ceil(this.frameSampleCount * 0.95) - 1);
      this.onFrameP95(this.sortedFrameTimes[p95Index]);
    }

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
