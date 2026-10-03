export type BodyMaterial = 'madera' | 'hierro' | 'piedra' | 'cristal' | 'arcano';

export type BodyPart = 'head' | 'torso' | 'arms' | 'legs';

export interface PartBlock {
  head: number;
  torso: number;
  arms: number;
  legs: number;
}

export interface PartShare {
  head: number;
  torso: number;
  arms: number;
  legs: number;
}

export interface BodySlots {
  relic: boolean;
  weapon: boolean;
  accessory: boolean;
}

export interface BodyChassis {
  id: string;
  name: string;
  material: BodyMaterial;
  tier: 1 | 2 | 3 | 4 | 5;
  partShare: PartShare; // Head, torso, arms, legs must sum to 1.0
  ivRange: { min: number; max: number };
  evCap: PartBlock;
  slots: BodySlots;
  tags: string[];
  price: number;
  description: string;
}

export interface BodyInstance {
  instanceId: string;
  chassisId: string;
  ivs: PartBlock;
  evs: PartBlock;
  partDurability: PartBlock; // 0-100%
  nickname?: string;
}
