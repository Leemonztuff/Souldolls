export type TileType =
  | 'grass'
  | 'tall_grass'
  | 'path'
  | 'water'
  | 'tree'
  | 'rock'
  | 'cave_floor'
  | 'wall'
  | 'building_wall'
  | 'roof'
  | 'door'
  | 'interior_floor'
  | 'flowers'
  | 'sand'
  | (string & {});

export const ALL_TILE_TYPES: TileType[] = [
  'grass',
  'tall_grass',
  'path',
  'water',
  'tree',
  'rock',
  'cave_floor',
  'wall',
  'building_wall',
  'roof',
  'door',
  'interior_floor',
  'flowers',
  'sand',
];

export type MigrationCategory = 'ground' | 'water' | 'vegetation_rocks' | 'facades' | 'interiors';

export interface TileSheetDefinition {
  id: string;
  kind: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B' | 'C' | 'D' | 'E';
  file: string;
  cols: number;
  rows: number;
}

export interface TileFlagDefinition {
  name: string;
  category: MigrationCategory;
  autotile?: boolean;
  animatedFrames?: number;
  wallHeight?: number;
  passable: [boolean, boolean, boolean, boolean]; // [down, left, right, up]
  bush: boolean;
  counter: boolean;
  ladder: boolean;
  damage: boolean;
  star: boolean;
  terrainTag: number;
  upperStarTile?: string;
  multiTile?: { w: number; h: number };
}

export interface BakedVariantRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BakedTileEntry {
  animatedFrames: number;
  frameStrideU: number;
  shapes: Record<string, BakedVariantRect>;
}

export interface BakedAtlasIndex {
  packId: string;
  tilePx: number;
  extrudePx: number;
  stride: number;
  atlasWidth: number;
  atlasHeight: number;
  imagePng: string;
  imageWebp: string;
  variants: Record<string, BakedTileEntry>;
}
