import { Souldoll, SoulSpecies } from '../../types/souldolls';
import { Rng } from '../../core/Rng';
import { ITEMS_DATA } from '../../data/items/items';

export interface CaptureResult {
  success: boolean;
  shakes: number; // 0 to 3 shakes before break/catch
  criticalCapture?: boolean;
}

export class CaptureCalculator {
  public static calculateCapture(
    target: Souldoll,
    targetSpecies: SoulSpecies,
    bottleItemId: string,
    rng: Rng
  ): CaptureResult {
    // 1. Determine Bottle Multiplier
    const item = ITEMS_DATA[bottleItemId];
    let bottleBonus = 1.0;

    if (item && item.effect.type === 'capture') {
      bottleBonus = item.effect.catchRateMultiplier;
    } else if (bottleItemId === 'soul_bottle_plata' || bottleItemId === 'superball') {
      bottleBonus = 1.5;
    } else if (bottleItemId === 'soul_bottle_oro' || bottleItemId === 'ultraball') {
      bottleBonus = 2.0;
    } else if (bottleItemId === 'soul_bottle_cristal' || bottleItemId === 'masterball') {
      return { success: true, shakes: 3 };
    }

    if (bottleBonus >= 255) {
      return { success: true, shakes: 3 };
    }

    // 2. Status Condition Multiplier (ki corruption or slumber)
    let statusBonus = 1.0;
    if (target.status === 'sleep') {
      statusBonus = 2.0;
    } else if (
      target.status === 'paralysis' ||
      target.status === 'poison' ||
      target.status === 'burn'
    ) {
      statusBonus = 1.5;
    }

    // 3. Modified Catch Rate (a)
    const maxHp = target.maxHp;
    const curHp = Math.max(1, target.currentHp);
    const catchRate = targetSpecies.catchRate || 100;

    const hpFactor = (3 * maxHp - 2 * curHp) / (3 * maxHp);
    const a = Math.min(255, Math.floor(hpFactor * catchRate * bottleBonus * statusBonus));

    if (a >= 255) {
      return { success: true, shakes: 3 };
    }

    // 4. Shake Probability (b)
    const b = Math.floor(65536 / Math.pow(255 / Math.max(1, a), 0.1875));

    // 5. 4 Shake Checks
    let shakes = 0;
    for (let i = 0; i < 4; i++) {
      const roll = rng.rangeInt(0, 65535);
      if (roll < b) {
        shakes++;
      } else {
        break;
      }
    }

    return {
      success: shakes === 4,
      shakes: Math.min(3, shakes),
    };
  }
}
