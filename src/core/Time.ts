/**
 * Time and delta tracking service
 */
export class Time {
  private static _dt = 0;
  private static _totalTime = 0;
  private static _scale = 1.0;
  private static _fps = 60;
  private static _frameCount = 0;
  private static _lastFpsUpdate = 0;

  public static update(rawDt: number): void {
    // Clamp delta time to avoid large jumps during pauses / tab switches
    const clampedDt = Math.min(rawDt, 0.1);
    this._dt = clampedDt * this._scale;
    this._totalTime += this._dt;

    // Calculate approximate FPS
    this._frameCount++;
    const now = performance.now();
    if (now - this._lastFpsUpdate >= 1000) {
      this._fps = Math.round((this._frameCount * 1000) / (now - this._lastFpsUpdate));
      this._frameCount = 0;
      this._lastFpsUpdate = now;
    }
  }

  public static get dt(): number {
    return this._dt;
  }

  public static get totalTime(): number {
    return this._totalTime;
  }

  public static get fps(): number {
    return this._fps;
  }

  public static get scale(): number {
    return this._scale;
  }

  public static setScale(scale: number): void {
    this._scale = Math.max(0, scale);
  }
}
