import { ElementType } from './elements';
import { StatusConditionType } from './status';
import { PartBlock } from './bodies';

export type MoveCategory = 'physical' | 'special' | 'status';

export type StatType = 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed' | 'accuracy' | 'evasion';

export type MoveEffect =
  | { type: 'damage' }
  | { type: 'heal'; percent: number }
  | {
      type: 'statStage';
      target: 'user' | 'target';
      stat: 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed' | 'accuracy' | 'evasion';
      stages: number; // e.g. -2, -1, +1, +2
      chance: number; // 0.0 to 1.0
    }
  | {
      type: 'status';
      condition: StatusConditionType;
      chance: number; // 0.0 to 1.0
    }
  | { type: 'recoil'; percentOfDamage: number }
  | { type: 'drain'; percentOfDamage: number }
  | { type: 'multiHit'; minHits: number; maxHits: number }
  | { type: 'flinch'; chance: number };

export type VfxPreset =
  | 'projectile'
  | 'burst'
  | 'beam'
  | 'slash'
  | 'aura'
  | 'rain'
  | 'quake'
  | 'shadow_wave'
  | 'lightning'
  | 'leaf_storm'
  | 'frost'
  | 'cyclone'
  | 'sparkle';

export interface MoveVfx {
  preset: VfxPreset;
  colorA: string;
  colorB: string;
  projectile?: string;
  soundName?: string;
}

export type MoveTarget = 'single' | 'all_opponents' | 'all' | 'ally' | 'all_allies' | 'self';

export interface Move {
  id: string;
  name: string;
  type: ElementType;
  category: MoveCategory;
  power: number; // 0 for status moves
  accuracy: number; // 1-100, or 100 for always hits
  pp: number;
  priority: number; // 0 is default, >0 is high priority
  target?: MoveTarget;
  partTargeting: PartBlock; // Head, torso, arms, legs hit probability weight (e.g. { head: 15, torso: 50, arms: 15, legs: 20 })
  tags: string[]; // ['weapon', 'kick', 'beam', 'spell', 'punch', 'slash', 'contact', etc.]
  effect: MoveEffect[];
  vfx: MoveVfx;
  description: string;
}
