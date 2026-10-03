/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 */
export class Rng {
  private _seed: number;

  constructor(seed = Date.now()) {
    this._seed = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this._seed = seed >>> 0;
  }

  public getSeed(): number {
    return this._seed;
  }

  /** Returns a pseudo-random float between 0 (inclusive) and 1 (exclusive) */
  public next(): number {
    let t = (this._seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in range [min, max] inclusive */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in range [min, max) */
  public rangeFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with given probability [0.0 - 1.0] */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Picks a random element from an array */
  public pick<T>(array: T[]): T | null {
    if (!array || array.length === 0) return null;
    const index = this.rangeInt(0, array.length - 1);
    return array[index];
  }

  /** Fisher-Yates array shuffle */
  public shuffle<T>(array: T[]): T[] {
    const clone = [...array];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }
}

export const GlobalRng = new Rng(1337);
