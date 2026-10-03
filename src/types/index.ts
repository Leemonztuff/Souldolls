/**
 * Global Type Definitions for Souldolls RPG Engine
 */

export * from './elements';
export * from './status';
export * from './moves';
export * from './items';
export * from './bodies';
export * from './souldolls';
export * from './loot';
export * from './maps';
export * from './quests';
export * from './dialogue';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type InputAction =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'CONFIRM'
  | 'CANCEL'
  | 'MENU'
  | 'SELECT'
  | 'RUN';

export interface PlayerState {
  name: string;
  position: Vector3D;
  direction: Direction;
  mapId: string;
  money: number;
  badges: string[]; // Sellos de gremio
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  textSpeed: 'slow' | 'mid' | 'fast';
  showTouchControls: boolean;
  outfitStyle: 'clasico' | 'atrevido';
}

export interface GameState {
  version: number;
  timestamp: number;
  playtimeSeconds: number;
  player: PlayerState;
  party: import('./souldolls').Souldoll[];
  storage: import('./souldolls').Souldoll[];
  bodies: Record<string, import('./bodies').BodyInstance>;
  inventory: Record<string, number>;
  flags: Record<string, boolean>;
  vars: Record<string, number | string>;
  quests: Record<string, import('./quests').QuestProgressState>;
  soulCodex: Record<string, { seen: boolean; caught: boolean }>;
  pokedex?: Record<string, { seen: boolean; caught: boolean }>; // Compatibility alias
  keyItems: string[];
  settings: GameSettings;
}

export interface SaveSlotSummary {
  id: number;
  exists: boolean;
  playerName?: string;
  money?: number;
  badgesCount?: number;
  playtimeFormatted?: string;
  timestamp?: number;
}

export interface EventMap {
  'scene:change': { sceneName: string; params?: any };
  'scene:push': { sceneName: string; params?: any };
  'scene:pop': void;
  'input:action': { action: InputAction; pressed: boolean };
  'save:saved': { slot: number };
  'save:loaded': { slot: number };
  'audio:play-sfx': { sound: string; pitch?: number };
  'dialogue:start': { treeId?: string; lines?: string[]; speaker?: string };
  'toast:message': { text: string; duration?: number };
  'debug:toggle': void;
  'map:warp': { targetMapId: string; targetX: number; targetY: number; targetDirection: Direction };
  'battle:encounter': { speciesId: string; level: number };
  'quest:started': { questId: string };
  'quest:updated': { questId: string; objectiveId: string; current: number; total: number };
  'quest:completed': { questId: string };
  'creature:caught': { speciesId: string; level: number };
  'creature:evolved': { speciesId: string; newSpeciesId: string };
  'soul:caught': { speciesId: string; level: number };
  'soul:ascended': { speciesId: string; newSpeciesId: string };
  'soulcodex:updated': { speciesId: string; status: string };
  'pokedex:updated': { speciesId: string; status: string };
  'quest:progress': any;
  'trainer:defeated': { trainerId: string };
  'item:obtained': { itemId: string; count: number };
  'dialogue:choice': { choiceIndex: number };
}
