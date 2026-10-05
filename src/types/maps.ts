import { Direction, Vector2D } from './index';
import { TileType } from './tilesets';

export interface MapWarp {
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
  targetDirection: Direction;
  interactLabel?: string;
}

export interface MapTrigger {
  x: number;
  y: number;
  triggerId: string;
  params?: Record<string, any>;
}

export interface MapNPC {
  id: string;
  name: string;
  paletteId: string;
  x: number;
  y: number;
  direction: Direction;
  dialogueLines: string[];
  interactLabel?: string;
  isTrainer?: boolean;
  trainerData?: {
    trainerClass: string;
    creatureSpeciesId: string;
    creatureLevel: number;
  };
  wanderRadius?: number;
}

export interface MapSign {
  x: number;
  y: number;
  text: string;
  interactLabel?: string;
  shopCategory?: string;
  shopMode?: 'buy' | 'sell';
  labInteractable?:
    | 'master_desk'
    | 'starter_pedestal'
    | 'body_tube'
    | 'codex_pedestal'
    | 'anima_world_map'
    | 'rift_diagram'
    | 'soul_purifier';
}

export interface EncounterEntry {
  speciesId: string;
  minLevel: number;
  maxLevel: number;
  weight: number; // probability weight, e.g. 30 for 30%
}

export interface MapData {
  id: string;
  name: string;
  category: 'town' | 'route' | 'forest' | 'cave' | 'interior';
  width: number;
  height: number;
  tileSize: number;
  ground: TileType[][]; // [y][x]
  decor?: (string | null)[][]; // [y][x] e.g. 'tree', 'rock', 'flowers', 'building_wall', 'roof', 'door'
  collision: boolean[][]; // [y][x] true = blocked
  encounters?: (string | null)[][]; // [y][x] 'tall_grass' or null
  encounterTable?: EncounterEntry[];
  encounterRate?: number; // e.g. 0.12 (12% per step in tall grass)
  warps: MapWarp[];
  triggers: MapTrigger[];
  signs: MapSign[];
  npcs: MapNPC[];
  spawnPoints: Record<string, { x: number; y: number; direction: Direction }>;
  ambientMusic?: string;
  sunlightColor?: number;
  skyColor?: number;
  indoor?: boolean;
}

export interface WorldGraphNode {
  id: string;
  name: string;
  connectedMapIds: string[];
  isInterior?: boolean;
}
