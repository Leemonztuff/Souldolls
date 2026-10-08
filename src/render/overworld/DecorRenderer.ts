import * as THREE from 'three';
import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';
import { GlobalSaveService } from '../../services/SaveService';

export interface DecorAtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot: [number, number];
  group: string;
  glow?: string;
  anim?: boolean;
  sway?: number;
  flat?: boolean;
  interact?: 'doll_arm_buried' | 'sparkle_hidden' | 'mana_berry_plant' | 'bones';
  ppu?: number;
}

export interface DecorAtlasData {
  image: string;
  size: [number, number];
  ppu: number;
  frames: Record<string, DecorAtlasFrame>;
}

export interface DecorUVRegion {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
  pivot: [number, number];
  group: string;
  glow?: string;
  anim?: boolean;
  sway: number;
  flat: boolean;
  interact?: string;
  ppu: number;
}

export interface BiomeRule {
  id: string;
  layer: 'grass' | 'flowers' | 'mushrooms' | 'fireflies';
  group?: string;
  frames?: string[];
  density: number;
  tileTypes: TileType[];
  avoidTypes?: TileType[];
  avoidRadius?: number;
  shoreOnly?: boolean;
  encounterOnly?: boolean;
  excludeEncounterTiles?: boolean;
  cluster?: {
    noiseScale: number;
    threshold: number;
  };
  scaleRange: [number, number];
  tint?: string;
  swayMultiplier?: number;
  timeOfDay?: 'day' | 'night' | 'night_or_forest';
}

export interface BiomeConfig {
  biome: string;
  groundTextureId: string;
  baseGroundColor: string;
  mapIds: string[];
  rules: BiomeRule[];
}

export interface BiomesDataFile {
  biomes: Record<string, BiomeConfig>;
}

export type QualityProfile = 'Bajo' | 'Medio' | 'Alto';

export interface InteractiveDecorEntry {
  x: number;
  z: number;
  type: 'doll_arm_buried' | 'sparkle_hidden' | 'mana_berry_plant' | 'bones';
  frameName: string;
  flagId: string;
  mesh: THREE.Mesh;
  glowMesh?: THREE.Mesh;
  harvestedAtStep?: number;
  itemReward?: string;
}

export const DEFAULT_OVERWORLD_DECOR_ATLAS: DecorAtlasData = {
  image: 'overworld_decor_atlas.png',
  size: [1024, 1024],
  ppu: 150,
  frames: {
    flower_daisy_a: { x: 46, y: 56, w: 52, h: 78, pivot: [0.5, 1.0], group: 'flower_daisy', sway: 1.0, ppu: 185 },
    flower_daisy_b: { x: 153, y: 51, w: 68, h: 82, pivot: [0.5, 1.0], group: 'flower_daisy', sway: 1.0, ppu: 185 },
    flower_daisy_cluster: { x: 261, y: 30, w: 113, h: 104, pivot: [0.5, 1.0], group: 'flower_daisy', sway: 0.9, ppu: 185 },
    flower_white_wild: { x: 414, y: 46, w: 78, h: 88, pivot: [0.5, 1.0], group: 'flower_daisy', sway: 1.1, ppu: 185 },
    flower_blue_a: { x: 522, y: 46, w: 77, h: 88, pivot: [0.5, 1.0], group: 'flower_blue', sway: 1.1, ppu: 185 },
    mushroom_red_a: { x: 655, y: 46, w: 72, h: 88, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },
    mushroom_brown_a: { x: 768, y: 46, w: 87, h: 88, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },
    mushroom_purple_a: { x: 896, y: 46, w: 77, h: 88, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },

    flower_pink_a: { x: 46, y: 184, w: 52, h: 72, pivot: [0.5, 1.0], group: 'flower_pink', sway: 1.0, ppu: 185 },
    flower_pink_b: { x: 143, y: 174, w: 88, h: 82, pivot: [0.5, 1.0], group: 'flower_pink', sway: 1.0, ppu: 185 },
    flower_pink_cluster: { x: 261, y: 158, w: 113, h: 98, pivot: [0.5, 1.0], group: 'flower_pink', sway: 0.9, ppu: 185 },
    mushroom_red_b: { x: 418, y: 160, w: 69, h: 96, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },
    mushroom_red_cluster: { x: 522, y: 160, w: 83, h: 96, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },
    mushroom_brown_b: { x: 655, y: 174, w: 72, h: 82, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 170 },
    mushroom_ki_cyan: { x: 764, y: 158, w: 96, h: 108, pivot: [0.5, 1.0], group: 'mushroom_ki', glow: '#5FE3D2', sway: 0.3, ppu: 160 },
    mushroom_ki_violet: { x: 886, y: 160, w: 96, h: 108, pivot: [0.5, 1.0], group: 'mushroom_ki', glow: '#9B6BFF', sway: 0.3, ppu: 160 },

    flower_yellow_a: { x: 46, y: 296, w: 57, h: 83, pivot: [0.5, 1.0], group: 'flower_yellow', sway: 1.0, ppu: 185 },
    flower_yellow_b: { x: 148, y: 302, w: 83, h: 82, pivot: [0.5, 1.0], group: 'flower_yellow', sway: 1.0, ppu: 185 },
    flower_yellow_cluster: { x: 261, y: 274, w: 113, h: 106, pivot: [0.5, 1.0], group: 'flower_yellow', sway: 0.9, ppu: 185 },
    flower_yellow_c: { x: 419, y: 290, w: 63, h: 90, pivot: [0.5, 1.0], group: 'flower_yellow', sway: 1.1, ppu: 185 },
    flower_yellow_d: { x: 527, y: 288, w: 72, h: 92, pivot: [0.5, 1.0], group: 'flower_yellow', sway: 1.1, ppu: 185 },
    grass_ki_glow: { x: 654, y: 278, w: 76, h: 102, pivot: [0.5, 1.0], group: 'grass_ki', glow: '#5FE3D2', sway: 1.2, ppu: 145 },
    grass_tuft_a: { x: 768, y: 294, w: 87, h: 86, pivot: [0.5, 1.0], group: 'grass', sway: 1.2, ppu: 150 },
    grass_tuft_b: { x: 885, y: 280, w: 104, h: 104, pivot: [0.5, 1.0], group: 'grass', sway: 1.3, ppu: 145 },

    flower_blue_b: { x: 30, y: 409, w: 83, h: 93, pivot: [0.5, 1.0], group: 'flower_blue', sway: 1.0, ppu: 185 },
    flower_blue_c: { x: 148, y: 428, w: 83, h: 74, pivot: [0.5, 1.0], group: 'flower_blue', sway: 1.0, ppu: 185 },
    flower_blue_cluster: { x: 261, y: 399, w: 113, h: 103, pivot: [0.5, 1.0], group: 'flower_blue', sway: 0.9, ppu: 185 },
    flower_blue_d: { x: 409, y: 409, w: 83, h: 93, pivot: [0.5, 1.0], group: 'flower_blue', sway: 1.1, ppu: 185 },
    flower_blue_e: { x: 522, y: 409, w: 83, h: 93, pivot: [0.5, 1.0], group: 'flower_blue', sway: 1.1, ppu: 185 },
    flower_poppy_a: { x: 650, y: 404, w: 83, h: 98, pivot: [0.5, 1.0], group: 'flower_poppy', sway: 1.1, ppu: 185 },
    flower_poppy_b: { x: 768, y: 404, w: 88, h: 98, pivot: [0.5, 1.0], group: 'flower_poppy', sway: 1.1, ppu: 185 },
    flower_poppy_cluster: { x: 880, y: 399, w: 114, h: 103, pivot: [0.5, 1.0], group: 'flower_poppy', sway: 1.0, ppu: 185 },

    mushroom_red_large: { x: 36, y: 536, w: 77, h: 84, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 160 },
    mushroom_brown_large: { x: 148, y: 537, w: 83, h: 83, pivot: [0.5, 1.0], group: 'mushroom', sway: 0.2, ppu: 160 },
    mushroom_ki_cyan_cluster: { x: 272, y: 522, w: 96, h: 108, pivot: [0.5, 1.0], group: 'mushroom_ki', glow: '#5FE3D2', sway: 0.3, ppu: 150 },
    mushroom_ki_violet_cluster: { x: 400, y: 522, w: 96, h: 108, pivot: [0.5, 1.0], group: 'mushroom_ki', glow: '#9B6BFF', sway: 0.3, ppu: 150 },
    moss_glow: { x: 540, y: 544, w: 52, h: 64, pivot: [0.5, 1.0], group: 'moss_ki', glow: '#5FE3D2', sway: 0.4, ppu: 150 },
    sprout: { x: 624, y: 552, w: 47, h: 52, pivot: [0.5, 1.0], group: 'grass', sway: 0.8, ppu: 160 },
    sprout_b: { x: 691, y: 558, w: 47, h: 54, pivot: [0.5, 1.0], group: 'grass', sway: 0.8, ppu: 160 },
    clover_patch: { x: 762, y: 544, w: 104, h: 81, pivot: [0.5, 1.0], group: 'grass', sway: 0.7, ppu: 155 },
    bush_clover: { x: 885, y: 528, w: 105, h: 98, pivot: [0.5, 1.0], group: 'grass', sway: 0.9, ppu: 140 },

    reed_a: { x: 30, y: 655, w: 94, h: 145, pivot: [0.5, 1.0], group: 'reed', sway: 1.4, ppu: 140 },
    reed_b: { x: 143, y: 650, w: 103, h: 144, pivot: [0.5, 1.0], group: 'reed', sway: 1.4, ppu: 140 },
    lilypad_a: { x: 271, y: 701, w: 98, h: 98, pivot: [0.5, 0.5], group: 'water_deco', flat: true, sway: 0.2, ppu: 160 },
    lilypad_flower_a: { x: 394, y: 701, w: 103, h: 99, pivot: [0.5, 0.5], group: 'water_deco', flat: true, sway: 0.2, ppu: 160 },
    lilypad_flower_b: { x: 517, y: 716, w: 98, h: 78, pivot: [0.5, 0.5], group: 'water_deco', flat: true, sway: 0.2, ppu: 160 },
    fern_bush: { x: 634, y: 681, w: 109, h: 115, pivot: [0.5, 1.0], group: 'forest_floor', sway: 1.1, ppu: 140 },
    moss_patch: { x: 762, y: 704, w: 104, h: 92, pivot: [0.5, 1.0], group: 'forest_floor', sway: 0.5, ppu: 155 },
    tall_grass_blade_a: { x: 890, y: 688, w: 47, h: 111, pivot: [0.5, 1.0], group: 'tall_grass', sway: 1.5, ppu: 135 },
    tall_grass_blade_b: { x: 942, y: 720, w: 47, h: 69, pivot: [0.5, 1.0], group: 'grass', sway: 1.2, ppu: 150 },

    twig_a: { x: 40, y: 834, w: 78, h: 57, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.0, ppu: 170 },
    twig_b: { x: 40, y: 916, w: 73, h: 57, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.0, ppu: 170 },
    stick_a: { x: 143, y: 829, w: 67, h: 67, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.0, ppu: 170 },
    stick_b: { x: 143, y: 911, w: 73, h: 67, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.0, ppu: 170 },
    leaves_a: { x: 240, y: 829, w: 58, h: 62, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.1, ppu: 170 },
    leaves_b: { x: 240, y: 916, w: 64, h: 57, pivot: [0.5, 1.0], group: 'forest_debris', sway: 0.1, ppu: 170 },
    pebbles_a: { x: 327, y: 829, w: 68, h: 67, pivot: [0.5, 1.0], group: 'cave_debris', sway: 0.0, ppu: 170 },
    pebbles_b: { x: 327, y: 911, w: 68, h: 67, pivot: [0.5, 1.0], group: 'cave_debris', sway: 0.0, ppu: 170 },
    bones: { x: 414, y: 829, w: 68, h: 67, pivot: [0.5, 1.0], group: 'bones', interact: 'bones', sway: 0.0, ppu: 130 },
    bones_b: { x: 414, y: 906, w: 74, h: 72, pivot: [0.5, 1.0], group: 'bones', interact: 'bones', sway: 0.0, ppu: 130 },
    doll_arm_buried: { x: 522, y: 890, w: 103, h: 88, pivot: [0.5, 1.0], group: 'interactive', interact: 'doll_arm_buried', sway: 0.0, ppu: 120 },
    firefly_1: { x: 756, y: 862, w: 40, h: 38, pivot: [0.5, 0.5], group: 'firefly', glow: '#FFE875', anim: true, sway: 0.0, ppu: 160 },
    firefly_2: { x: 794, y: 874, w: 42, h: 42, pivot: [0.5, 0.5], group: 'firefly', glow: '#FFE875', anim: true, sway: 0.0, ppu: 160 },
    firefly_3: { x: 726, y: 906, w: 34, h: 32, pivot: [0.5, 0.5], group: 'firefly', glow: '#5FE3D2', anim: true, sway: 0.0, ppu: 160 },
    sparkle_hidden: { x: 754, y: 932, w: 80, h: 44, pivot: [0.5, 0.5], group: 'interactive', interact: 'sparkle_hidden', glow: '#FFF3A1', anim: true, sway: 0.0, ppu: 120 },
    mana_berry_plant: { x: 890, y: 840, w: 99, h: 138, pivot: [0.5, 1.0], group: 'interactive', interact: 'mana_berry_plant', glow: '#5FE3D2', sway: 0.6, ppu: 120 },
  },
};

export const DEFAULT_BIOMES_DATA: BiomesDataFile = {
  biomes: {
    aldea_marioneta: {
      biome: 'aldea_marioneta',
      groundTextureId: 'grass_village_base',
      baseGroundColor: '#5CBF5A',
      mapIds: ['villa_brote', 'pueblo_costero', 'ciudad_gimnasio'],
      rules: [
        {
          id: 'village_grass',
          layer: 'grass',
          group: 'grass',
          density: 0.9,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water', 'sand', ' wall' as TileType, 'interior_floor'],
          scaleRange: [0.68, 0.88],
        },
        {
          id: 'village_flowerbeds',
          layer: 'flowers',
          frames: ['flower_pink_cluster', 'flower_daisy_cluster', 'flower_pink_b', 'flower_daisy_b', 'flower_yellow_b'],
          density: 1.5,
          tileTypes: ['flowers'],
          avoidTypes: ['path', 'water'],
          scaleRange: [0.65, 0.85],
        },
        {
          id: 'village_daisies',
          layer: 'flowers',
          group: 'flower_daisy',
          density: 0.9,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.28, threshold: 0.56 },
          scaleRange: [0.62, 0.82],
        },
        {
          id: 'village_pink_flowers',
          layer: 'flowers',
          group: 'flower_pink',
          density: 0.85,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.30, threshold: 0.58 },
          scaleRange: [0.62, 0.82],
        },
        {
          id: 'village_reeds',
          layer: 'grass',
          group: 'reed',
          density: 1.1,
          tileTypes: ['grass', 'sand'],
          shoreOnly: true,
          scaleRange: [0.75, 0.95],
        },
        {
          id: 'village_lilypads',
          layer: 'flowers',
          group: 'water_deco',
          density: 0.7,
          tileTypes: ['water'],
          scaleRange: [0.72, 0.95],
        },
      ],
    },
    ruta_claro: {
      biome: 'ruta_claro',
      groundTextureId: 'grass_meadow_base',
      baseGroundColor: '#5CBF5A',
      mapIds: ['ruta_claro', 'test_route'],
      rules: [
        {
          id: 'meadow_grass_normal',
          layer: 'grass',
          group: 'grass',
          density: 1.1,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water', 'sand'],
          excludeEncounterTiles: true,
          scaleRange: [0.70, 0.90],
        },
        {
          id: 'meadow_tall_grass_encounter',
          layer: 'grass',
          frames: ['grass_tuft_b', 'bush_clover', 'tall_grass_blade_a', 'grass_tuft_a', 'clover_patch'],
          density: 2.8,
          tileTypes: ['grass'],
          encounterOnly: true,
          scaleRange: [0.92, 1.12],
          tint: '#3B8E3E',
          swayMultiplier: 1.45,
        },
        {
          id: 'meadow_daisies',
          layer: 'flowers',
          group: 'flower_daisy',
          density: 1.1,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          excludeEncounterTiles: true,
          cluster: { noiseScale: 0.24, threshold: 0.52 },
          scaleRange: [0.64, 0.84],
        },
        {
          id: 'meadow_yellow_flowers',
          layer: 'flowers',
          group: 'flower_yellow',
          density: 1.2,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          excludeEncounterTiles: true,
          cluster: { noiseScale: 0.22, threshold: 0.50 },
          scaleRange: [0.64, 0.84],
        },
        {
          id: 'meadow_poppies',
          layer: 'flowers',
          group: 'flower_poppy',
          density: 1.0,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          excludeEncounterTiles: true,
          cluster: { noiseScale: 0.26, threshold: 0.54 },
          scaleRange: [0.65, 0.85],
        },
        {
          id: 'meadow_blue_flowers',
          layer: 'flowers',
          group: 'flower_blue',
          density: 1.0,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          excludeEncounterTiles: true,
          cluster: { noiseScale: 0.25, threshold: 0.52 },
          scaleRange: [0.64, 0.84],
        },
        {
          id: 'meadow_reeds',
          layer: 'grass',
          group: 'reed',
          density: 1.3,
          tileTypes: ['grass', 'sand'],
          shoreOnly: true,
          scaleRange: [0.78, 0.98],
        },
        {
          id: 'meadow_lilypads',
          layer: 'flowers',
          group: 'water_deco',
          density: 0.75,
          tileTypes: ['water'],
          scaleRange: [0.75, 0.95],
        },
      ],
    },
    bosque_eco: {
      biome: 'bosque_eco',
      groundTextureId: 'forest_moss_base',
      baseGroundColor: '#45994E',
      mapIds: ['bosque_eco'],
      rules: [
        {
          id: 'forest_undergrowth',
          layer: 'grass',
          frames: ['fern_bush', 'moss_patch', 'clover_patch', 'sprout', 'grass_tuft_a'],
          density: 1.8,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water'],
          excludeEncounterTiles: true,
          scaleRange: [0.88, 1.14],
          tint: '#4EA858',
        },
        {
          id: 'forest_tall_grass_encounter',
          layer: 'grass',
          frames: ['grass_ki_glow', 'grass_tuft_b', 'fern_bush', 'tall_grass_blade_a', 'bush_clover'],
          density: 4.4,
          tileTypes: ['grass'],
          encounterOnly: true,
          scaleRange: [1.10, 1.35],
          tint: '#2E7D4E',
          swayMultiplier: 1.5,
        },
        {
          id: 'forest_mushrooms_ki',
          layer: 'mushrooms',
          group: 'mushroom_ki',
          density: 2.2,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.25, threshold: 0.40 },
          scaleRange: [0.88, 1.22],
        },
        {
          id: 'forest_moss_ki',
          layer: 'mushrooms',
          frames: ['moss_glow', 'grass_ki_glow'],
          density: 1.9,
          tileTypes: ['grass', 'flowers'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.28, threshold: 0.44 },
          scaleRange: [0.90, 1.18],
        },
        {
          id: 'forest_mushrooms_natural',
          layer: 'mushrooms',
          group: 'mushroom',
          density: 1.5,
          tileTypes: ['grass'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.28, threshold: 0.48 },
          scaleRange: [0.85, 1.12],
        },
        {
          id: 'forest_debris',
          layer: 'grass',
          group: 'forest_debris',
          density: 1.3,
          tileTypes: ['grass', 'path'],
          avoidTypes: ['water'],
          scaleRange: [0.82, 1.08],
        },
        {
          id: 'forest_reeds',
          layer: 'grass',
          group: 'reed',
          density: 1.8,
          tileTypes: ['grass'],
          shoreOnly: true,
          scaleRange: [0.90, 1.18],
        },
        {
          id: 'forest_lilypads',
          layer: 'flowers',
          group: 'water_deco',
          density: 1.0,
          tileTypes: ['water'],
          scaleRange: [0.88, 1.15],
        },
        {
          id: 'forest_fireflies',
          layer: 'fireflies',
          group: 'firefly',
          density: 0.65,
          tileTypes: ['grass', 'flowers', 'water'],
          timeOfDay: 'night_or_forest',
          scaleRange: [0.85, 1.25],
        },
      ],
    },
    cueva_eco: {
      biome: 'cueva_eco',
      groundTextureId: 'cave_stone_base',
      baseGroundColor: '#334155',
      mapIds: ['cueva_eco', 'ruta_montana'],
      rules: [
        {
          id: 'cave_mushrooms_ki',
          layer: 'mushrooms',
          group: 'mushroom_ki',
          density: 1.9,
          tileTypes: ['cave_floor', 'rock', 'grass', 'sand'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.25, threshold: 0.42 },
          scaleRange: [0.85, 1.20],
        },
        {
          id: 'cave_moss_crystals',
          layer: 'mushrooms',
          frames: ['moss_glow', 'grass_ki_glow'],
          density: 1.6,
          tileTypes: ['cave_floor', 'rock', 'grass'],
          avoidTypes: ['path', 'water'],
          cluster: { noiseScale: 0.28, threshold: 0.45 },
          scaleRange: [0.85, 1.15],
        },
        {
          id: 'cave_encounter_patches',
          layer: 'grass',
          frames: ['grass_ki_glow', 'moss_glow', 'mushroom_ki_cyan', 'mushroom_ki_violet'],
          density: 3.6,
          tileTypes: ['cave_floor', 'grass'],
          encounterOnly: true,
          scaleRange: [1.02, 1.28],
          tint: '#48B5A8',
          swayMultiplier: 1.3,
        },
        {
          id: 'cave_debris_bones',
          layer: 'grass',
          frames: ['pebbles_a', 'pebbles_b', 'bones', 'bones_b'],
          density: 0.9,
          tileTypes: ['cave_floor', 'sand', 'grass'],
          avoidTypes: ['water', 'path'],
          cluster: { noiseScale: 0.32, threshold: 0.52 },
          scaleRange: [0.80, 1.05],
        },
      ],
    },
  },
};

/**
 * Deterministic Seeded RNG (Mulberry32)
 */
class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Deterministic 2D Smooth Value Noise for flower/mushroom clustering
 */
function hash2D(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);

  const n00 = hash2D(ix, iz, seed);
  const n10 = hash2D(ix + 1, iz, seed);
  const n01 = hash2D(ix, iz + 1, seed);
  const n11 = hash2D(ix + 1, iz + 1, seed);

  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

interface FireflyParticle {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
  radius: number;
}

interface LeafBurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface FootOccluderItem {
  x: number;
  z: number;
  frameName: string;
  scale: number;
  tint?: string;
}

/**
 * Overworld Decor Atlas & Chunked InstancedMesh Billboard Renderer (Bloque 36)
 */
export class OverworldDecorManager {
  private static instance: OverworldDecorManager;

  public atlasData: DecorAtlasData = DEFAULT_OVERWORLD_DECOR_ATLAS;
  public biomesData: BiomesDataFile = DEFAULT_BIOMES_DATA;

  private sharedTexture: THREE.Texture | null = null;
  private atlasImage: HTMLImageElement | null = null;
  private geometryCache = new Map<string, THREE.PlaneGeometry>();
  private materialCache = new Map<string, THREE.MeshBasicMaterial>();
  private fallbackMaterials = new Map<string, THREE.MeshBasicMaterial>();

  // Shared GPU Uniforms updated once per frame (Zero CPU per-instance loop!)
  public sharedUniforms = {
    uTime: { value: 0 },
    uCameraYaw: { value: 0 },
    uPitchTilt: { value: -0.22 },
    uSquashTile: { value: new THREE.Vector4(-999, -999, 1.0, 0.0) },
  };

  // Debug & Quality Controls (Req. 7 & 8)
  public mapSeed = 1337;
  public qualityProfile: QualityProfile = 'Alto';
  public layerVisibility: Record<'grass' | 'flowers' | 'mushrooms' | 'glow' | 'fireflies', boolean> = {
    grass: true,
    flowers: true,
    mushrooms: true,
    glow: true,
    fireflies: true,
  };
  public ruleDensityMultipliers: Record<string, number> = {};

  // Telemetry for F2 Debug Overlay
  public totalInstancesCount = 0;
  public activeChunksCount = 0;
  public chunkGroups: Map<string, THREE.Group> = new Map();
  private layerMeshes: Record<'grass' | 'flowers' | 'mushrooms' | 'glow' | 'fireflies', THREE.Object3D[]> = {
    grass: [],
    flowers: [],
    mushrooms: [],
    glow: [],
    fireflies: [],
  };

  // Dynamic elements
  private fireflies: FireflyParticle[] = [];
  private leafPool: LeafBurstParticle[] = [];
  private footOccluders: THREE.Mesh[] = [];
  private encounterTuftsByTile = new Map<string, FootOccluderItem[]>();
  private interactiveEntries: InteractiveDecorEntry[] = [];
  private stepCounter = 0;

  // Squash animation timer
  private squashTimer = 0;
  private squashDuration = 0.28;

  private currentMap: MapData | null = null;
  private parentGroup: THREE.Group | null = null;
  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadJsonConfigs();
    this.initTexture();
  }

  public static getInstance(): OverworldDecorManager {
    if (!OverworldDecorManager.instance) {
      OverworldDecorManager.instance = new OverworldDecorManager();
    }
    return OverworldDecorManager.instance;
  }

  private loadJsonConfigs(): void {
    if (typeof window !== 'undefined') {
      fetch('/data/art/overworld_decor_atlas.json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: DecorAtlasData | null) => {
          if (data && data.frames) {
            this.atlasData = data;
            this.geometryCache.clear();
            this.listeners.forEach((cb) => cb());
          }
        })
        .catch(() => {});

      fetch('/data/decor/biomes.json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: BiomesDataFile | null) => {
          if (data && data.biomes) {
            this.biomesData = data;
            this.listeners.forEach((cb) => cb());
          }
        })
        .catch(() => {});
    }
  }

  private initTexture(): void {
    const rawImg = this.atlasData.image || 'overworld_decor_atlas.png';
    const imagePath = rawImg.startsWith('/') ? rawImg : `/assets/atlases/${rawImg}`;
    if (typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();

      this.sharedTexture = loader.load(imagePath, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.premultiplyAlpha = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
      });
    } else {
      this.sharedTexture = new THREE.Texture();
    }

    this.sharedTexture.colorSpace = THREE.SRGBColorSpace;
    this.sharedTexture.magFilter = THREE.NearestFilter;
    this.sharedTexture.minFilter = THREE.NearestFilter;
    this.sharedTexture.generateMipmaps = false;
    this.sharedTexture.premultiplyAlpha = false;
    this.sharedTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.sharedTexture.wrapT = THREE.ClampToEdgeWrapping;

    if (typeof Image !== 'undefined') {
      this.atlasImage = new Image();
      this.atlasImage.src = imagePath;
    }
  }

  public getSharedTexture(): THREE.Texture {
    if (!this.sharedTexture) this.initTexture();
    return this.sharedTexture!;
  }

  public getAtlasImage(): HTMLImageElement | null {
    return this.atlasImage;
  }

  /**
   * Reutiliza AtlasRegion de los Bloques 33/34 con inset de 0.5 px (Req. 1)
   */
  public AtlasRegion(frameName: string): DecorUVRegion | null {
    const frame = this.atlasData.frames[frameName];
    if (!frame) return null;

    const [W, H] = this.atlasData.size;
    const u0 = (frame.x + 0.5) / W;
    const u1 = (frame.x + frame.w - 0.5) / W;
    const v0 = 1 - (frame.y + frame.h - 0.5) / H;
    const v1 = 1 - (frame.y + 0.5) / H;

    return {
      u0,
      v0,
      u1,
      v1,
      w: frame.w,
      h: frame.h,
      pivot: frame.pivot || [0.5, 1.0],
      group: frame.group || 'grass',
      glow: frame.glow,
      anim: frame.anim,
      sway: frame.sway ?? 1.0,
      flat: !!frame.flat,
      interact: frame.interact,
      ppu: frame.ppu || this.atlasData.ppu || 76,
    };
  }

  public getFramesByGroup(groupName: string): string[] {
    return Object.entries(this.atlasData.frames)
      .filter(([, f]) => f.group === groupName)
      .map(([k]) => k);
  }

  /**
   * Req. 3: Geometría PlaneGeometry vertical con pivote en los pies (translate 0, h/2, 0),
   * o plano horizontal ("flat": true) para nenúfares.
   */
  public getFrameGeometry(frameName: string): { geometry: THREE.PlaneGeometry; isFallback: boolean; worldH: number } {
    const region = this.AtlasRegion(frameName);
    if (!region) {
      const fallbackGeo = new THREE.PlaneGeometry(0.8, 0.8);
      fallbackGeo.translate(0, 0.4, 0);
      return { geometry: fallbackGeo, isFallback: true, worldH: 0.8 };
    }

    const cacheKey = `${frameName}_${region.w}x${region.h}_${region.ppu}_${region.flat}`;
    const worldW = region.w / region.ppu;
    const worldH = region.h / region.ppu;

    if (this.geometryCache.has(cacheKey)) {
      return { geometry: this.geometryCache.get(cacheKey)!, isFallback: false, worldH };
    }

    const geo = new THREE.PlaneGeometry(worldW, worldH);
    if (region.flat) {
      geo.rotateX(-Math.PI / 2);
    } else {
      const pivot = region.pivot || [0.5, 1.0];
      const dx = (0.5 - pivot[0]) * worldW;
      const dy = (pivot[1] - 0.5) * worldH;
      geo.translate(dx, dy, 0);
    }

    const { u0, v0, u1, v1 } = region;
    const uvs = new Float32Array([
      u0, v1,
      u1, v1,
      u0, v0,
      u1, v0,
    ]);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.attributes.uv.needsUpdate = true;

    this.geometryCache.set(cacheKey, geo);
    return { geometry: geo, isFallback: false, worldH };
  }

  /**
   * Req. 3: Material con GPU Vertex Shader Sway (onBeforeCompile),
   * yaw compartido por cámara (90° Q/E), inclinación hacia cámara (-pitch*0.4),
   * alphaTest 0.5, transparent false, DoubleSide, depthWrite true, polygonOffset.
   */
  public getBillboardMaterial(
    swayAmount: number,
    worldH: number,
    isFlat: boolean,
    tintHex?: string,
    isAdditiveGlow = false,
    glowColorHex?: string
  ): THREE.MeshBasicMaterial {
    const key = `${swayAmount.toFixed(2)}_${worldH.toFixed(2)}_${isFlat}_${tintHex || 'none'}_${isAdditiveGlow}_${glowColorHex || 'none'}`;
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key)!;
    }

    const color = new THREE.Color(isAdditiveGlow ? (glowColorHex || '#5FE3D2') : (tintHex || '#ffffff'));

    const mat = new THREE.MeshBasicMaterial({
      map: this.getSharedTexture(),
      color,
      alphaTest: isAdditiveGlow ? 0.05 : 0.5,
      transparent: isAdditiveGlow,
      opacity: isAdditiveGlow ? 0.72 : 1.0,
      blending: isAdditiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !isAdditiveGlow,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const shared = this.sharedUniforms;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uCameraYaw = shared.uCameraYaw;
      shader.uniforms.uPitchTilt = shared.uPitchTilt;
      shader.uniforms.uSquashTile = shared.uSquashTile;
      shader.uniforms.uSway = { value: swayAmount };
      shader.uniforms.uWorldH = { value: Math.max(0.05, worldH) };
      shader.uniforms.uIsFlat = { value: isFlat ? 1.0 : 0.0 };
      shader.uniforms.uIsGlow = { value: isAdditiveGlow ? 1.0 : 0.0 };

      shader.vertexShader = `
        uniform float uTime;
        uniform float uCameraYaw;
        uniform float uPitchTilt;
        uniform vec4 uSquashTile;
        uniform float uSway;
        uniform float uWorldH;
        uniform float uIsFlat;
        uniform float uIsGlow;
        varying float vGlowPulse;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec3 instPos = vec3(0.0);
        #ifdef USE_INSTANCING
          instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float phase = instPos.x * 3.17 + instPos.z * 5.73;
        vGlowPulse = 0.65 + 0.35 * sin(uTime * 2.8 + phase);

        if (uIsFlat < 0.5) {
          float hRatio = clamp(position.y / uWorldH, 0.0, 1.0);
          float swayOffset = sin(uTime * 2.5 + phase) * 0.085 * hRatio * uSway;
          transformed.x += swayOffset;

          // Step squash animation on tall grass tile
          if (uSquashTile.w > 0.5) {
            float dx = instPos.x - uSquashTile.x;
            float dz = instPos.z - uSquashTile.y;
            if (dx * dx + dz * dz < 0.42) {
              transformed.y *= uSquashTile.z;
              transformed.x += sign(dx + 0.01) * (1.0 - uSquashTile.z) * 0.22 * hRatio;
            }
          }

          // Pitch tilt (-pitch * 0.4) to avoid ground clipping
          float cp = cos(uPitchTilt);
          float sp = sin(uPitchTilt);
          float ty = transformed.y * cp - transformed.z * sp;
          float tz = transformed.y * sp + transformed.z * cp;
          transformed.y = ty;
          transformed.z = tz;

          // Shared cameraYaw billboard rotation (90 deg steps Q/E)
          float cy = cos(uCameraYaw);
          float sy = sin(uCameraYaw);
          float tx = transformed.x * cy + transformed.z * sy;
          float tz2 = -transformed.x * sy + transformed.z * cy;
          transformed.x = tx;
          transformed.z = tz2;
        }
        `
      );

      shader.fragmentShader = `
        uniform float uIsGlow;
        varying float vGlowPulse;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        if (uIsGlow > 0.5) {
          gl_FragColor.a *= vGlowPulse;
        }
        `
      );
    };

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * Req. 9: FALLBACK cuadrado magenta con el nombre del frame
   */
  public getFallbackMaterial(frameName: string): THREE.MeshBasicMaterial {
    if (this.fallbackMaterials.has(frameName)) {
      return this.fallbackMaterials.get(frameName)!;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MISSING', 64, 48);
    ctx.fillText(frameName.slice(0, 14), 64, 76);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    this.fallbackMaterials.set(frameName, mat);
    return mat;
  }

  public getBiomeByName(biomeName?: string): BiomeConfig | null {
    if (!biomeName) return null;
    if (biomeName === 'town') return this.biomesData.biomes.aldea_marioneta || null;
    if (biomeName === 'meadow') return this.biomesData.biomes.aldea_marioneta || this.biomesData.biomes.ruta_claro || null;
    if (biomeName === 'forest') return this.biomesData.biomes.bosque_eco || null;
    if (biomeName === 'coastal') return this.biomesData.biomes.ruta_claro || null;
    if (biomeName === 'mountain') return this.biomesData.biomes.ruta_claro || null;
    if (biomeName === 'cave') return this.biomesData.biomes.cueva_eco || null;
    return this.biomesData.biomes[biomeName] || null;
  }

  public getBiomeForMap(map: MapData, tileX?: number, tileZ?: number): BiomeConfig | null {
    if (map.indoor) return null;
    if (
      tileX !== undefined &&
      tileZ !== undefined &&
      map.regionBiomes &&
      map.regionBiomes[tileZ]?.[tileX]
    ) {
      const regionBiome = this.getBiomeByName(map.regionBiomes[tileZ][tileX]);
      if (regionBiome) return regionBiome;
    }
    for (const biome of Object.values(this.biomesData.biomes)) {
      if (biome.mapIds.includes(map.id)) {
        return biome;
      }
    }
    if (map.category === 'forest') return this.biomesData.biomes.bosque_eco || null;
    if (map.category === 'cave') return this.biomesData.biomes.cueva_eco || null;
    if (map.category === 'town') return this.biomesData.biomes.aldea_marioneta || null;
    return this.biomesData.biomes.ruta_claro || null;
  }

  public getMaxInstancesForQuality(): number {
    switch (this.qualityProfile) {
      case 'Bajo':
        return 900;
      case 'Medio':
        return 2600;
      case 'Alto':
      default:
        return 6500;
    }
  }

  private isWaterShore(map: MapData, x: number, z: number): boolean {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < map.width && nz >= 0 && nz < map.height) {
        if (map.ground[nz][nx] === 'water') return true;
      }
    }
    return false;
  }

  private isBlockedOrReservedTile(map: MapData, x: number, z: number, allowWater: boolean): boolean {
    const groundType = map.ground[z]?.[x];
    if (!groundType) return true;

    if (!allowWater && groundType === 'water') return true;
    if (!allowWater && map.collision[z]?.[x]) return true;

    const decorType = map.decor?.[z]?.[x];
    if (decorType && decorType !== 'flowers' && decorType !== 'tall_grass') {
      return true;
    }

    if (map.warps?.some((w) => Math.abs(w.x - x) <= 0 && Math.abs(w.y - z) <= 0)) {
      return true;
    }
    if (map.npcs?.some((n) => n.x === x && n.y === z)) {
      return true;
    }
    if (map.signs?.some((s) => s.x === x && s.y === z)) {
      return true;
    }
    return false;
  }

  /**
   * Returns list of rules that apply to a specific tile (used by F2 Cursor Tile Inspector - Req. 8)
   */
  public getRulesForTile(map: MapData, x: number, z: number): string[] {
    const biome = this.getBiomeForMap(map, x, z);
    if (!biome || x < 0 || z < 0 || x >= map.width || z >= map.height) return [];

    const groundType = map.ground[z][x];
    const isEncounter = map.encounters?.[z]?.[x] === 'tall_grass';
    const isShore = this.isWaterShore(map, x, z);
    const matched: string[] = [];

    for (const rule of biome.rules) {
      if (!rule.tileTypes.includes(groundType)) continue;
      if (rule.encounterOnly && !isEncounter) continue;
      if (rule.excludeEncounterTiles && isEncounter) continue;
      if (rule.shoreOnly && !isShore) continue;
      if (rule.avoidTypes?.includes(groundType)) continue;
      matched.push(`${rule.id} (${rule.layer})`);
    }
    return matched;
  }

  /**
   * Builds all chunked InstancedMesh billboards, fireflies, and interactive decor for a map.
   */
  public buildForMap(map: MapData, parentGroup: THREE.Group): void {
    this.clear();
    this.currentMap = map;
    this.parentGroup = parentGroup;

    if (map.indoor) return;

    const biome = this.getBiomeForMap(map);
    if (!biome) return;

    const maxBudget = this.getMaxInstancesForQuality();
    const CHUNK_SIZE = 16;

    // Map from chunkKey ("cx_cz") -> frameKey -> matrix & config array
    interface PendingInstance {
      matrix: THREE.Matrix4;
      frameName: string;
      layer: 'grass' | 'flowers' | 'mushrooms' | 'fireflies';
      tint?: string;
      swayMultiplier: number;
    }

    const chunkBuckets = new Map<string, Map<string, PendingInstance[]>>();
    let totalCount = 0;

    // Compute deterministic seed for this map
    let mapHash = this.mapSeed;
    for (let i = 0; i < map.id.length; i++) {
      mapHash = (mapHash * 31 + map.id.charCodeAt(i)) | 0;
    }

    const dummy = new THREE.Object3D();

    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        if (totalCount >= maxBudget) break;

        const tileBiome = this.getBiomeForMap(map, x, z) || biome;
        const groundType = map.ground[z][x];
        const isEncounter = map.encounters?.[z]?.[x] === 'tall_grass';
        const isShore = this.isWaterShore(map, x, z);
        const chunkKey = `${Math.floor(x / CHUNK_SIZE)}_${Math.floor(z / CHUNK_SIZE)}`;

        for (let rIdx = 0; rIdx < tileBiome.rules.length; rIdx++) {
          const rule = tileBiome.rules[rIdx];

          if (rule.layer === 'fireflies') continue; // Fireflies handled as floating particles below
          if (!rule.tileTypes.includes(groundType)) continue;
          if (rule.encounterOnly && !isEncounter) continue;
          if (rule.excludeEncounterTiles && isEncounter) continue;
          if (rule.shoreOnly && !isShore) continue;
          if (rule.avoidTypes?.includes(groundType)) continue;

          const allowWater = rule.group === 'water_deco';
          if (this.isBlockedOrReservedTile(map, x, z, allowWater)) continue;

          // Check cluster noise threshold if rule uses organic patches
          if (rule.cluster) {
            const nVal = smoothNoise2D(x * rule.cluster.noiseScale, z * rule.cluster.noiseScale, mapHash + rIdx * 97);
            if (nVal < rule.cluster.threshold) continue;
          }

          const candidateFrames = rule.frames || (rule.group ? this.getFramesByGroup(rule.group) : []);
          if (candidateFrames.length === 0) continue;

          const tileSeed = (mapHash ^ (x * 73856093) ^ (z * 19349663) ^ (rIdx * 83492791)) >>> 0;
          const rng = new SeededRng(tileSeed);

          const ruleMult = this.ruleDensityMultipliers[rule.id] ?? 1.0;
          // Bloque 45 Req. 3: Densidad concentrada junto a bordes, árboles, agua y edificios; ~0 en carriles de paso
          const nearStructureBoost =
            rule.encounterOnly || groundType === 'flowers'
              ? 1.0
              : this.isNearEdgeOrStructure(map, x, z)
              ? 1.25
              : this.isAdjacentToPath(map, x, z)
              ? 0.25
              : 0.45;
          const effectiveDensity = rule.density * ruleMult * nearStructureBoost;
          const baseCount = Math.floor(effectiveDensity);
          const frac = effectiveDensity - baseCount;
          const spawnCount = baseCount + (rng.next() < frac ? 1 : 0);

          for (let i = 0; i < spawnCount; i++) {
            if (totalCount >= maxBudget) break;

            const frameName = candidateFrames[Math.floor(rng.next() * candidateFrames.length)];
            const region = this.AtlasRegion(frameName);

            // Offset within tile (-0.38 .. +0.38) so tufts never spill onto adjacent path lanes
            const ox = rng.range(-0.38, 0.38);
            const oz = rng.range(-0.38, 0.38);
            const scale = Math.min(0.7, rng.range(rule.scaleRange[0], rule.scaleRange[1]));

            const wx = x + ox;
            const wz = z + oz;
            const wy = region?.flat ? 0.02 : 0.01;

            dummy.position.set(wx, wy, wz);
            dummy.rotation.set(0, region?.flat ? rng.range(0, Math.PI * 2) : 0, 0);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            const matCopy = dummy.matrix.clone();
            const bucketKey = `${frameName}__${rule.tint || 'none'}__${rule.swayMultiplier || 1}`;

            if (!chunkBuckets.has(chunkKey)) {
              chunkBuckets.set(chunkKey, new Map());
            }
            const frameMap = chunkBuckets.get(chunkKey)!;
            if (!frameMap.has(bucketKey)) {
              frameMap.set(bucketKey, []);
            }
            frameMap.get(bucketKey)!.push({
              matrix: matCopy,
              frameName,
              layer: rule.layer,
              tint: rule.tint,
              swayMultiplier: rule.swayMultiplier || 1.0,
            });

            // Record encounter tufts for foot occlusion (Req. 4)
            if (isEncounter && i < 2) {
              const tKey = `${x}_${z}`;
              if (!this.encounterTuftsByTile.has(tKey)) {
                this.encounterTuftsByTile.set(tKey, []);
              }
              this.encounterTuftsByTile.get(tKey)!.push({
                x: wx,
                z: wz,
                frameName,
                scale,
                tint: rule.tint,
              });
            }

            totalCount++;
          }
        }
      }
    }

    // Build InstancedMesh per chunk and per frame bucket
    chunkBuckets.forEach((frameMap, chunkKey) => {
      const chunkGroup = new THREE.Group();
      chunkGroup.name = `decor_chunk_${chunkKey}`;

      frameMap.forEach((instances) => {
        if (instances.length === 0) return;
        const sample = instances[0];
        const region = this.AtlasRegion(sample.frameName);
        const { geometry, isFallback, worldH } = this.getFrameGeometry(sample.frameName);

        const swayVal = (region ? region.sway : 1.0) * sample.swayMultiplier;
        const isFlat = region ? region.flat : false;

        const mat = isFallback
          ? this.getFallbackMaterial(sample.frameName)
          : this.getBillboardMaterial(swayVal, worldH, isFlat, sample.tint, false);

        const instMesh = new THREE.InstancedMesh(geometry, mat, instances.length);
        instMesh.castShadow = false;
        instMesh.receiveShadow = true;

        for (let i = 0; i < instances.length; i++) {
          instMesh.setMatrixAt(i, instances[i].matrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
        instMesh.computeBoundingSphere();

        const layerName = sample.layer === 'mushrooms' ? 'mushrooms' : sample.layer === 'flowers' ? 'flowers' : 'grass';
        instMesh.visible = this.layerVisibility[layerName];
        this.layerMeshes[layerName].push(instMesh);
        chunkGroup.add(instMesh);

        // Req. 3: If frame has "glow", create additive companion InstancedMesh
        if (region?.glow && !isFallback) {
          const glowMat = this.getBillboardMaterial(swayVal, worldH, isFlat, undefined, true, region.glow);
          const glowInst = new THREE.InstancedMesh(geometry, glowMat, instances.length);
          const glowScaleMat = new THREE.Matrix4().makeScale(1.12, 1.08, 1.12);
          const tempMat = new THREE.Matrix4();

          for (let i = 0; i < instances.length; i++) {
            tempMat.copy(instances[i].matrix).multiply(glowScaleMat);
            glowInst.setMatrixAt(i, tempMat);
          }
          glowInst.instanceMatrix.needsUpdate = true;
          glowInst.computeBoundingSphere();
          glowInst.visible = this.layerVisibility.glow && this.layerVisibility[layerName];
          this.layerMeshes.glow.push(glowInst);
          chunkGroup.add(glowInst);
        }
      });

      parentGroup.add(chunkGroup);
      this.chunkGroups.set(chunkKey, chunkGroup);
    });

    this.totalInstancesCount = totalCount;
    this.activeChunksCount = this.chunkGroups.size;

    // Build floating Fireflies for forest / night (Req. 3)
    this.buildFireflies(map, biome, parentGroup, mapHash);

    // Build Interactive Decor props (Req. 6: doll_arm_buried, sparkle_hidden, mana_berry_plant, bones)
    this.buildInteractiveDecor(map, parentGroup, mapHash);

    // Pre-allocate Leaf Burst particle pool & Foot Occluders pool (Req. 4 & 7)
    this.initDynamicPools(parentGroup);
  }

  private buildFireflies(map: MapData, biome: BiomeConfig, parentGroup: THREE.Group, mapHash: number): void {
    const fireflyFrames = ['firefly_1', 'firefly_2', 'firefly_3'];
    const rng = new SeededRng((mapHash ^ 0x9e3779b9) >>> 0);
    const isForest = biome.biome === 'bosque_eco' || map.category === 'forest';
    const count = isForest ? 28 : 12;

    for (let i = 0; i < count; i++) {
      const fName = fireflyFrames[i % fireflyFrames.length];
      const region = this.AtlasRegion(fName);
      const { geometry, worldH } = this.getFrameGeometry(fName);
      const mat = this.getBillboardMaterial(0, worldH, false, undefined, true, region?.glow || '#FFE875');

      const mesh = new THREE.Mesh(geometry, mat);
      const bx = rng.range(2, map.width - 3);
      const bz = rng.range(2, map.height - 3);
      const by = rng.range(0.35, 1.15);

      mesh.position.set(bx, by, bz);
      mesh.visible = this.layerVisibility.fireflies;
      parentGroup.add(mesh);
      this.layerMeshes.fireflies.push(mesh);

      this.fireflies.push({
        mesh,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(1.2, 2.4),
        radius: rng.range(0.35, 0.85),
      });
    }
  }

  private isNearEdgeOrStructure(map: MapData, x: number, z: number): boolean {
    if (x <= 2 || x >= map.width - 3 || z <= 2 || z >= map.height - 3) return true;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.height) continue;
        const g = map.ground[nz]?.[nx];
        const d = map.decor?.[nz]?.[nx];
        if (g === 'water' || d === 'tree' || d === 'rock' || d === 'building_wall' || d === 'roof' || d === 'wall') {
          return true;
        }
      }
    }
    return false;
  }

  private isAdjacentToPath(map: MapData, x: number, z: number): boolean {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < map.width && nz >= 0 && nz < map.height) {
        const g = map.ground[nz][nx];
        if (g === 'path' || g === 'cobble' || g === 'plaza') return true;
      }
    }
    return false;
  }

  /**
   * Req. 6 & Bloque 45 Req. 2: INTERACTIVOS (doll_arm_buried, sparkle_hidden, mana_berry_plant, bones)
   * Se colocan exclusivamente en las coordenadas de puntos de interés (landmarks) horneadas en `map.decor`,
   * nunca sueltos al azar en mitad de un prado.
   */
  private buildInteractiveDecor(map: MapData, parentGroup: THREE.Group, _mapHash: number): void {
    const saveState = GlobalSaveService.getCurrentState();
    const loreSpecs: Record<
      string,
      { type: 'doll_arm_buried' | 'sparkle_hidden' | 'mana_berry_plant' | 'bones'; frameName: string; reward?: string }
    > = {
      doll_arm_buried: { type: 'doll_arm_buried', frameName: 'doll_arm_buried' },
      sparkle_hidden: { type: 'sparkle_hidden', frameName: 'sparkle_hidden', reward: 'elixir_ki' },
      mana_berry_plant: { type: 'mana_berry_plant', frameName: 'mana_berry_plant', reward: 'cristal_fuego' },
      bones: { type: 'bones', frameName: 'bones' },
    };

    if (!map.decor) return;

    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const cellDecor = map.decor[tz]?.[tx];
        if (!cellDecor || !loreSpecs[cellDecor]) continue;

        const spec = loreSpecs[cellDecor];
        const flagId = `decor_${spec.type}_${map.id}_${tx}_${tz}`;
        const isCollected = spec.type === 'sparkle_hidden' && !!saveState.flags?.[flagId];

        const region = this.AtlasRegion(spec.frameName);
        const { geometry, worldH } = this.getFrameGeometry(spec.frameName);
        const mat = this.getBillboardMaterial(region?.sway || 0.2, worldH, false);

        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(tx, 0.02, tz);
        mesh.visible = !isCollected;
        parentGroup.add(mesh);

        let glowMesh: THREE.Mesh | undefined;
        if (region?.glow) {
          const glowMat = this.getBillboardMaterial(region.sway || 0.2, worldH, false, undefined, true, region.glow);
          glowMesh = new THREE.Mesh(geometry, glowMat);
          glowMesh.position.set(tx, 0.02, tz);
          glowMesh.scale.set(1.15, 1.15, 1.15);
          glowMesh.visible = !isCollected && this.layerVisibility.glow;
          parentGroup.add(glowMesh);
        }

        this.interactiveEntries.push({
          x: tx,
          z: tz,
          type: spec.type,
          frameName: spec.frameName,
          flagId,
          mesh,
          glowMesh,
          itemReward: spec.reward,
        });
      }
    }
  }

  private initDynamicPools(parentGroup: THREE.Group): void {
    // 1. Pre-allocate 10 leaf burst particles for tall-grass step effect (Req. 4 & 7)
    const { geometry: leafGeo, worldH } = this.getFrameGeometry('leaves_a');
    const leafMat = this.getBillboardMaterial(0, worldH, false, '#5CBF5A');

    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.scale.set(0.35, 0.35, 0.35);
      m.visible = false;
      parentGroup.add(m);
      this.leafPool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.45 });
    }

    // 2. Pre-allocate 6 foreground foot-occluder tufts (renderOrder = 25) (Req. 4)
    const { geometry: tuftGeo, worldH: tuftH } = this.getFrameGeometry('grass_tuft_b');
    const tuftMat = this.getBillboardMaterial(1.4, tuftH, false, '#2E7D4E');
    tuftMat.depthTest = true;

    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(tuftGeo, tuftMat);
      m.renderOrder = 25;
      m.visible = false;
      parentGroup.add(m);
      this.footOccluders.push(m);
    }
  }

  /**
   * Called when the player steps onto a new tile (Req. 4 & 6)
   */
  public onPlayerStep(tileX: number, tileZ: number): void {
    this.stepCounter++;

    // Regrow harvested mana_berry_plant after 25 steps (Req. 6)
    for (const entry of this.interactiveEntries) {
      if (
        entry.type === 'mana_berry_plant' &&
        entry.harvestedAtStep !== undefined &&
        this.stepCounter - entry.harvestedAtStep >= 25
      ) {
        entry.harvestedAtStep = undefined;
        entry.mesh.scale.set(1, 1, 1);
        if (entry.glowMesh) entry.glowMesh.visible = this.layerVisibility.glow;
      }
    }

    if (!this.currentMap) return;
    const isEncounter = this.currentMap.encounters?.[tileZ]?.[tileX] === 'tall_grass';
    if (!isEncounter) return;

    // Trigger tall-grass squash animation (scale Y: 0.6 -> 1.0)
    this.squashTimer = this.squashDuration;
    this.sharedUniforms.uSquashTile.value.set(tileX, tileZ, 0.6, 1.0);

    // Emit burst of leaf particles
    let spawned = 0;
    for (const p of this.leafPool) {
      if (p.life <= 0 && spawned < 5) {
        const angle = (spawned / 5) * Math.PI * 2 + Math.random() * 0.5;
        p.mesh.position.set(tileX + Math.cos(angle) * 0.2, 0.15, tileZ + Math.sin(angle) * 0.2);
        p.vx = Math.cos(angle) * 0.85;
        p.vy = 1.4 + Math.random() * 0.5;
        p.vz = Math.sin(angle) * 0.85;
        p.life = p.maxLife;
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  /**
   * Checks if there is an interactive decor item at (tileX, tileZ) or the current player tile (Req. 6)
   */
  public interactAt(
    tileX: number,
    tileZ: number,
    playerX: number,
    playerZ: number
  ): { title: string; lines: string[]; rewardItem?: string } | null {
    const entry = this.interactiveEntries.find(
      (e) => (e.x === tileX && e.z === tileZ) || (e.x === playerX && e.z === playerZ)
    );
    if (!entry) return null;

    const saveState = GlobalSaveService.getCurrentState();

    if (entry.type === 'doll_arm_buried') {
      return {
        title: 'Brazo de Marioneta Antiguo',
        lines: [
          'Un brazo de chasis de Souldoll de una era olvidada sobresale entre la tierra y las raíces.',
          'Sus conductos de bronce aún conservan grabados de los primeros Artífices: "Cuando el Eco despierte, las almas sin contenedor buscarán su hogar."',
        ],
      };
    }

    if (entry.type === 'bones') {
      return {
        title: 'Restos Antiguos',
        lines: [
          'Huesos blanqueados por el paso del tiempo y el flujo de ki salvaje.',
        ],
      };
    }

    if (entry.type === 'sparkle_hidden') {
      if (saveState.flags?.[entry.flagId]) return null;
      saveState.flags = saveState.flags || {};
      saveState.flags[entry.flagId] = true;
      entry.mesh.visible = false;
      if (entry.glowMesh) entry.glowMesh.visible = false;

      const item = entry.itemReward || 'elixir_ki';
      saveState.inventory[item] = (saveState.inventory[item] || 0) + 1;
      GlobalSaveService.save(GlobalSaveService.getActiveSlot());

      const itemNames: Record<string, string> = {
        elixir_ki: 'Elixir de Ki Pequeño',
        soul_bottle_plata: 'Soul Bottle Plata',
        cristal_fuego: 'Cristal de Maná (Fuego)',
      };
      return {
        title: '✨ Objeto Oculto Encontrado',
        lines: [`¡Has descubierto un brillo oculto entre la maleza!`, `Obtuviste: 1x ${itemNames[item] || item}.`],
        rewardItem: item,
      };
    }

    if (entry.type === 'mana_berry_plant') {
      if (entry.harvestedAtStep !== undefined) {
        const remaining = Math.max(1, 25 - (this.stepCounter - entry.harvestedAtStep));
        return {
          title: '🌱 Arbusto de Cristales de Maná',
          lines: [`El arbusto ya fue cosechado recientemente. Rebrotará con ki fresco tras caminar unos ${remaining} pasos más.`],
        };
      }

      entry.harvestedAtStep = this.stepCounter;
      entry.mesh.scale.set(0.65, 0.65, 0.65);
      if (entry.glowMesh) entry.glowMesh.visible = false;

      const item = entry.itemReward || 'cristal_fuego';
      saveState.inventory[item] = (saveState.inventory[item] || 0) + 1;
      GlobalSaveService.save(GlobalSaveService.getActiveSlot());

      return {
        title: '💎 Arbusto de Cristales de Maná',
        lines: [
          '¡Has cosechado un Cristal de Maná resonante de las ramas del arbusto!',
          'El arbusto volverá a cristalizar energía tras caminar un rato.',
        ],
        rewardItem: item,
      };
    }

    return null;
  }

  /**
   * Updates GPU uniforms, tall-grass squash, leaf particles, fireflies, and foot occlusion.
   */
  public update(dt: number, cameraYaw: number, cameraPitch = 0.55, playerWorldX = 0, playerWorldZ = 0): void {
    this.sharedUniforms.uTime.value += dt;
    this.sharedUniforms.uCameraYaw.value = cameraYaw;
    this.sharedUniforms.uPitchTilt.value = -cameraPitch * 0.4;

    // 1. Update tall-grass squash animation (0.6 -> 1.0)
    if (this.squashTimer > 0) {
      this.squashTimer = Math.max(0, this.squashTimer - dt);
      const progress = 1.0 - this.squashTimer / this.squashDuration;
      const scaleY = 0.6 + 0.4 * progress;
      this.sharedUniforms.uSquashTile.value.z = scaleY;
      if (this.squashTimer === 0) {
        this.sharedUniforms.uSquashTile.value.w = 0.0;
      }
    }

    // 2. Update Leaf Burst particles
    for (const p of this.leafPool) {
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 4.2 * dt; // gravity
        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    }

    // 3. Update Fireflies (floating noise trajectories, active in forest or at night)
    const t = this.sharedUniforms.uTime.value;
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 6;
    const isForest = this.currentMap?.id === 'bosque_eco' || this.currentMap?.category === 'forest';
    const showFireflies = this.layerVisibility.fireflies && (isForest || isNight);

    for (const f of this.fireflies) {
      f.mesh.visible = showFireflies;
      if (showFireflies) {
        f.mesh.position.x = f.baseX + Math.sin(t * f.speed + f.phase) * f.radius;
        f.mesh.position.y = f.baseY + Math.sin(t * (f.speed * 1.3) + f.phase * 2.0) * 0.18;
        f.mesh.position.z = f.baseZ + Math.cos(t * (f.speed * 0.85) + f.phase) * f.radius;
      }
    }

    // 4. Foreground foot occlusion for tufts within ~0.6 tiles in front of player (Req. 4)
    const px = Math.round(playerWorldX);
    const pz = Math.round(playerWorldZ);
    const nearbyTufts = this.encounterTuftsByTile.get(`${px}_${pz}`) || [];

    for (let i = 0; i < this.footOccluders.length; i++) {
      const occ = this.footOccluders[i];
      if (i < nearbyTufts.length && this.layerVisibility.grass) {
        const tuft = nearbyTufts[i];
        occ.position.set(tuft.x, 0.015, tuft.z);
        occ.scale.set(tuft.scale, tuft.scale, tuft.scale);
        occ.visible = true;
      } else {
        occ.visible = false;
      }
    }
  }

  public setLayerVisible(layer: 'grass' | 'flowers' | 'mushrooms' | 'glow' | 'fireflies', visible: boolean): void {
    this.layerVisibility[layer] = visible;
    this.layerMeshes[layer].forEach((obj) => {
      obj.visible = visible;
    });
  }

  public rebuildCurrentMap(): void {
    if (this.currentMap && this.parentGroup) {
      this.buildForMap(this.currentMap, this.parentGroup);
    }
  }

  public updateFrameRect(frameName: string, rect: Partial<DecorAtlasFrame>): void {
    const existing = this.atlasData.frames[frameName];
    if (!existing) return;
    Object.assign(existing, rect);
    this.geometryCache.clear();
    this.rebuildCurrentMap();
    this.listeners.forEach((cb) => cb());
  }

  public onUpdated(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public clear(): void {
    this.chunkGroups.forEach((group) => {
      group.parent?.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) {
          obj.dispose();
        }
      });
    });
    this.chunkGroups.clear();

    this.fireflies.forEach((f) => f.mesh.parent?.remove(f.mesh));
    this.fireflies = [];

    this.leafPool.forEach((p) => p.mesh.parent?.remove(p.mesh));
    this.leafPool = [];

    this.footOccluders.forEach((m) => m.parent?.remove(m));
    this.footOccluders = [];

    this.interactiveEntries.forEach((e) => {
      e.mesh.parent?.remove(e.mesh);
      e.glowMesh?.parent?.remove(e.glowMesh);
    });
    this.interactiveEntries = [];

    this.encounterTuftsByTile.clear();
    this.layerMeshes = { grass: [], flowers: [], mushrooms: [], glow: [], fireflies: [] };
    this.totalInstancesCount = 0;
    this.activeChunksCount = 0;
  }
}

export const GlobalOverworldDecor = OverworldDecorManager.getInstance();
