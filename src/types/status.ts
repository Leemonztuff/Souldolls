/**
 * Non-volatile and volatile status condition definitions
 */

export type StatusConditionType = 'burn' | 'paralysis' | 'poison' | 'sleep';

export interface StatusEffectRule {
  id: StatusConditionType;
  name: string;
  nameEs: string;
  description: string;
  dotDamagePercent: number; // e.g. 0.0625 (1/16) or 0.125 (1/8)
  speedMultiplier: number;  // e.g. 0.5 for paralysis
  attackMultiplier: number; // e.g. 0.5 for burn
  skipTurnChance: number;   // e.g. 0.25 for paralysis, 1.0 for sleep
  minDurationTurns?: number;
  maxDurationTurns?: number;
  color: string;
}
