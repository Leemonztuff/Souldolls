import { BattleSide } from '../systems/battle/BattleTypes';
import { CreatureInstance } from './index';
import { WeatherType } from './weather';

export interface AbilityHookContext {
  user: CreatureInstance;
  target?: CreatureInstance;
  side: BattleSide;
  damage?: number;
  move?: any;
  weather?: WeatherType;
}

export interface AbilityDamageModifier {
  damageMultiplier?: number;
  immune?: boolean;
  message?: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  onSwitchIn?: (ctx: AbilityHookContext) => { message: string; statChanges?: Array<{ target: 'self' | 'target'; stat: string; stages: number }> } | null;
  onDamage?: (ctx: AbilityHookContext) => AbilityDamageModifier | null;
  onTurnEnd?: (ctx: AbilityHookContext) => { healPercent?: number; message?: string } | null;
}
