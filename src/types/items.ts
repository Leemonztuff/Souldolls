import { StatusConditionType } from './status';

export type ItemCategory =
  | 'elixir'
  | 'bottle'
  | 'purge'
  | 'reincarnation'
  | 'crystal'
  | 'relic'
  | 'weapon'
  | 'resonance_core'
  | 'repair_kit'
  | 'body_part'
  | 'key'
  | 'general';

export type ItemEffect =
  | { type: 'heal_hp'; amount: number }
  | { type: 'capture'; catchRateMultiplier: number }
  | { type: 'cure_status'; status: 'all' | StatusConditionType }
  | { type: 'revive'; hpPercent: number }
  | { type: 'evolution'; stoneType?: string; resonanceLevel?: number }
  | { type: 'buff'; stat: string; value: number }
  | { type: 'repair'; amount: number }
  | { type: 'mana_crystal'; effect: 'boost_atk' | 'restore_pp' | 'regen_hp' | 'boost_speed' | 'boost_def' | 'boost_crit' }
  | { type: 'relic_passive'; passiveId: string }
  | { type: 'weapon_stat'; atkBonus: number; spAtkBonus: number }
  | { type: 'teach_move'; moveId: string }
  | { type: 'badge'; gymId: string };

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  effect: ItemEffect;
  price: number;
  description: string;
  iconColor: string;
  weaponClass?: string;
}
