import { ElementType } from './elements';
import { StatusConditionType } from './status';
import { PartBlock } from './bodies';
import { NatureType } from './natures';

export type SoulClassId =
  | 'maga'
  | 'archimaga'
  | 'sacerdotisa'
  | 'hierofante'
  | 'gladiadora'
  | 'titanide'
  | 'bruja'
  | 'hechicera'
  | 'hidromante'
  | 'cantora_marea'
  | 'monje'
  | 'maestro_trueno'
  | 'asesina'
  | 'espectro';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface LearnableMove {
  level: number;
  moveId: string;
}

export interface AscensionRequirement {
  toSpeciesId: string;
  level?: number;
  item?: string;
  sync?: number;
  minBodyTier?: number;
}

export type ExpGroup = 'fast' | 'medium_fast' | 'medium_slow' | 'slow';

export interface SpriteLayers {
  baseBody: string;
  outfit: string;
  weapon: string;
  accessory?: string;
  palette: {
    primary: string;
    secondary: string;
    glow: string;
  };
}

export interface SpriteRecipe {
  baseShape: 'biped' | 'floating' | 'humanoid';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  eyeColor: string;
  features: string[];
  scale: number;
}

export interface BodyRequirement {
  minTier: number; // 1 to 5
}

export interface SoulSpriteConfig {
  sheetPath: string;
  atlasPath: string;
  size: [number, number];
  views: Array<'view_front34' | 'view_front' | 'view_side' | 'view_back' | 'view_back34'>;
  idleSupported: boolean;
}

export interface SoulSpecies {
  id: string;
  name: string;
  classId: SoulClassId;
  dexNumber: number;
  types: ElementType[];
  baseStats: BaseStats;
  weaponId: string; // unique weapon item ID for this soul/class
  bodyRequirement: BodyRequirement; // { minTier: 1..5 }
  soulBottleFlavor: string; // lore text when trapped inside a Soul Bottle
  learnset: LearnableMove[];
  evolution: AscensionRequirement | null; // Ascension requirement
  catchRate: number; // 3 to 255
  baseExp: number;
  expGroup: ExpGroup;
  description: string;
  habitatMapIds: string[];
  abilityId?: string;
  possibleAbilities?: string[];
  layers?: SpriteLayers;
  spriteRecipe?: SpriteRecipe;
  spriteConfig?: SoulSpriteConfig;
}

// Aliases for compatibility
export type CreatureSpecies = SoulSpecies;

export interface SouldollEquipped {
  relic?: string | null;
  weapon?: string | null;
  accessory?: string | null;
}

export interface SouldollMove {
  moveId: string;
  currentPp: number;
  maxPp: number;
}

export interface Souldoll {
  uid: string; // Unique instance ID
  soulSpeciesId: string;
  speciesId: string; // Alias for soulSpeciesId
  nickname?: string;
  level: number;
  currentExp: number;
  sync: number; // Sincronía (0 to 255, previously friendship)
  friendship?: number; // Alias for sync
  bodyInstanceId: string | null; // null = "Alma sellada" (cannot battle)
  
  // Total HP
  currentHp: number;
  maxHp: number;
  
  // Per-part HP (Cabeza, Torso, Brazos, Piernas)
  partHP: PartBlock;
  maxPartHP: PartBlock;

  status: StatusConditionType | null;
  statusTurnsRemaining?: number;

  moves: SouldollMove[];
  equipped: SouldollEquipped;
  heldItemId?: string | null; // Alias for equipped.relic or held item

  stats: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };

  nature?: NatureType;
  abilityId?: string;
  gender?: 'M' | 'F' | 'N';
  isShiny?: boolean;

  ivs?: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  evs?: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
}

// Alias for compatibility
export type CreatureInstance = Souldoll;
