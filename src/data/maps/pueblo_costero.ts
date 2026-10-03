import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 32;
const H = 24;

const ground: TileType[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => 'grass')
);
const decor: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);
const collision: boolean[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => false)
);
const encounters: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);

// 1. South and West Ocean
for (let y = 16; y < H; y++) {
  for (let x = 0; x < W; x++) {
    ground[y][x] = 'water';
    collision[y][x] = true;
  }
}
// Sandy beach shore
for (let y = 12; y <= 15; y++) {
  for (let x = 0; x < W; x++) {
    ground[y][x] = 'sand';
  }
}

// 2. Perimeter and borders
for (let x = 0; x < W; x++) {
  decor[0][x] = 'tree';
  collision[0][x] = true;
}
for (let y = 0; y < 16; y++) {
  decor[y][0] = 'tree';
  collision[y][0] = true;
  // East opening for Villa Brote connection at y: 10..12
  if (y < 10 || y > 12) {
    decor[y][W - 1] = 'tree';
    collision[y][W - 1] = true;
  }
}

// 3. Wooden Docks / Paths in town
for (let x = 8; x <= 24; x++) {
  ground[11][x] = 'path';
  ground[6][x] = 'path';
}
for (let y = 4; y <= 16; y++) {
  ground[y][16] = 'path';
  ground[y][17] = 'path';
}
// Dock extending into ocean
for (let y = 16; y <= 21; y++) {
  ground[y][16] = 'path';
  ground[y][17] = 'path';
  collision[y][16] = false;
  collision[y][17] = false;
}

// 4. Coastal Gimnasio (y: 3..6, x: 6..10)
for (let y = 3; y <= 6; y++) {
  for (let x = 6; x <= 10; x++) {
    collision[y][x] = true;
    if (y === 3) decor[y][x] = 'roof';
    else if (y === 6 && x === 8) {
      decor[y][x] = 'door';
      collision[y][x] = false;
    } else {
      decor[y][x] = 'building_wall';
    }
  }
}

// 5. Tall grass patches for encounters
for (let y = 7; y <= 10; y++) {
  for (let x = 20; x <= 25; x++) {
    encounters[y][x] = 'tall_grass';
    ground[y][x] = 'tall_grass';
  }
}

export const PUEBLO_COSTERO_MAP: MapData = {
  id: 'pueblo_costero',
  name: 'Puerto Marea',
  category: 'town',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  encounters,
  signs: [
    {
      x: 18,
      y: 11,
      text: '⚓ PUERTO MAREA\n"Donde la brisa marina despierta las mareas."',
    },
    {
      x: 9,
      y: 7,
      text: '🏛 GIMNASIO DE PUERTO MAREA\nLíder: Marina — Maestra de las corrientes.',
    },
  ],
  warps: [
    // East connection to Villa Brote
    {
      x: 31,
      y: 11,
      targetMapId: 'villa_brote',
      targetX: 1,
      targetY: 11,
      targetDirection: 'right',
    },
    {
      x: 31,
      y: 12,
      targetMapId: 'villa_brote',
      targetX: 1,
      targetY: 12,
      targetDirection: 'right',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_leader_marina',
      name: 'Líder Marina',
      paletteId: 'lass',
      x: 8,
      y: 8,
      direction: 'down',
      dialogueLines: [
        '¡Te doy la bienvenida al Gimnasio de Puerto Marea!',
        'Las olas moldean a los entrenadores fuertes. ¡Enfrenta el poder del océano!',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Líder de Gimnasio',
        creatureSpeciesId: 'morsaval',
        creatureLevel: 20,
      },
    },
    {
      id: 'npc_sailor_paco',
      name: 'Marinero Paco',
      paletteId: 'hiker',
      x: 18,
      y: 18,
      direction: 'up',
      dialogueLines: [
        'El mar hoy está en calma, pero en aguas profundas habitan Fokita y Morsaval.',
        'Solo quienes obtienen la Medalla Marina pueden surcar las aguas tempestuosas.',
      ],
    },
    {
      id: 'npc_surfer_leo',
      name: 'Surfista Leo',
      paletteId: 'lass',
      x: 14,
      y: 13,
      direction: 'right',
      dialogueLines: [
        '¡La arena dorada y el agua fresca son ideales para descansar tras un largo viaje!',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 30, y: 11, direction: 'left' },
    from_east: { x: 30, y: 11, direction: 'left' },
  },
  encounterRate: 0.18,
  encounterTable: [
    { speciesId: 'hidromante', minLevel: 10, maxLevel: 14, weight: 60 },
    { speciesId: 'maga', minLevel: 10, maxLevel: 13, weight: 30 },
    { speciesId: 'cantora_marea', minLevel: 16, maxLevel: 18, weight: 10 },
  ],
  ambientMusic: 'town',
  sunlightColor: 0xfef08a,
  skyColor: 0x38bdf8,
};
