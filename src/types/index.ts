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
export * from './gacha';
export * from './tilesets';

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

export type BustAnimationMode = 'off' | 'subtle' | 'normal';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  textSpeed: 'slow' | 'mid' | 'fast';
  showTouchControls: boolean;
  outfitStyle: 'clasico' | 'atrevido';
  bustAnimation?: BustAnimationMode;
  // Bloque 43: Controles del Overworld y Opciones de HUD
  runMode?: 'hold' | 'toggle';
  showCameraButton?: boolean;
  showObjectiveHint?: boolean;
  controlsScale?: 0.85 | 1.0 | 1.15;
  controlsPosition?: 'compact' | 'normal' | 'wide';
  separateControlsPanel?: boolean;
  touchScale?: number | 'small' | 'normal' | 'large';
  touchPosition?: 'compact' | 'normal' | 'wide';
  separateControlPanel?: boolean;
}

export interface GameState {
  version: number;
  timestamp: number;
  playtimeSeconds: number;
  player: PlayerState;
  badges?: string[]; // Compatibility alias for player.badges
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
  // Bloque 28A: Fragmentos de alma y gacha
  saveId?: string;
  rngSeed?: number;
  bodyPieces?: Record<string, number>; // Contador de piezas por chassisId
  kiDust?: number; // Polvo de ki
  scanLedger?: import('./gacha').ScanLedgerEntry[];
  gachaPity?: Record<string, number>; // Contador de pity por tableId
  gachaDailyRedeems?: {
    dateKey: string; // YYYY-MM-DD
    count: number;
  };
  gachaDiscoveries?: string[]; // IDs de premios descubiertos en el gacha
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
  // Bloque 43 Req. 6: Eventos de servicios físicos emitidos solo desde diálogos de NPC
  OpenShop: { mode?: 'buy' | 'sell'; category?: string; source?: string };
  OpenWorkshop: { tab?: string; source?: string };
  OpenStorage: { tab?: string; source?: string };
  // Bloque 28A: Eventos del EventBus para Gacha y Fragmentos
  FragmentUsed: { itemId: string; remaining: number };
  QrScanned: { hash: string; payload: string };
  GachaRolled: { result: import('./gacha').GachaResult };
  BodyPieceGained: { chassisId: string; count: number; totalForChassis: number };
  BodyAssembled: { chassisId: string; bodyInstanceId: string };
  ScrollGained: { scrollId: string; moveId: string; convertedToKiDust?: number };
  TechniqueLearned: { souldollUid: string; speciesId: string; moveId: string; replacedMoveId?: string };
  // Bloque 46 Req. 3: Evento emitido al elegir y vincular la primera Souldoll
  'starter:chosen': {
    soulSpeciesId: string;
    souldollUid: string;
    nickname: string;
    rivalSpeciesId: string;
  };
}
