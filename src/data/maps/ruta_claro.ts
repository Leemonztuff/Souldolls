import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 40;
const H = 30;

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

// 1. Perimeter Trees & Fences
for (let x = 0; x < W; x++) {
  // North opening at x 20..21 for Ciudad Cumbre connection
  if (x < 20 || x > 21) {
    decor[0][x] = 'tree';
    collision[0][x] = true;
  }
  // South opening at x 20..21 for Villa Brote connection
  if (x < 19 || x > 22) {
    decor[H - 1][x] = 'tree';
    collision[H - 1][x] = true;
  }
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'tree';
  collision[y][0] = true;
  // East opening at y 14..15 for Bosque Eco connection
  if (y < 13 || y > 16) {
    decor[y][W - 1] = 'tree';
    collision[y][W - 1] = true;
  }
}

// 2. Large Scenic Lake & River (y: 6..18, x: 4..13)
for (let y = 6; y <= 18; y++) {
  for (let x = 4; x <= 13; x++) {
    // Leave some organic shape
    if (!((y === 6 || y === 18) && (x === 4 || x === 13))) {
      ground[y][x] = 'water';
      collision[y][x] = true;
    }
  }
}
// Sandy shores
for (let y = 5; y <= 19; y++) {
  for (let x = 3; x <= 14; x++) {
    if (ground[y][x] !== 'water' && !collision[y][x]) {
      ground[y][x] = 'sand';
    }
  }
}

// 3. Winding Path System
// From South entrance (20..21, 29) running up through the middle all the way to Ciudad Cumbre (y: 0)
for (let y = 0; y <= 29; y++) {
  ground[y][20] = 'path';
  ground[y][21] = 'path';
}
// Crossing East towards Bosque Eco (y: 14..15, x: 20..39)
for (let x = 20; x <= 39; x++) {
  ground[14][x] = 'path';
  ground[15][x] = 'path';
}
// Branch West towards Lake and Northern clearing
for (let x = 14; x <= 20; x++) {
  ground[20][x] = 'path';
  ground[21][x] = 'path';
}
for (let y = 4; y <= 14; y++) {
  ground[y][20] = 'path';
  ground[y][21] = 'path';
}
for (let x = 14; x <= 20; x++) {
  ground[4][x] = 'path';
}

// 4. Tall Grass Encounter Fields
// Field A (South-West: y: 22..27, x: 4..16)
for (let y = 22; y <= 27; y++) {
  for (let x = 4; x <= 16; x++) {
    if (ground[y][x] === 'grass') {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}
// Field B (Central-East: y: 17..26, x: 25..36)
for (let y = 17; y <= 26; y++) {
  for (let x = 25; x <= 36; x++) {
    if (ground[y][x] === 'grass') {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}
// Field C (North: y: 5..11, x: 24..35)
for (let y = 5; y <= 11; y++) {
  for (let x = 24; x <= 35; x++) {
    if (ground[y][x] === 'grass') {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}

// 5. Natural Obstacles & Clusters of Trees
[[10, 18], [11, 18], [12, 18], [8, 28], [8, 29], [22, 23], [23, 23], [18, 37], [19, 37]].forEach(
  ([y, x]) => {
    decor[y][x] = 'tree';
    collision[y][x] = true;
  }
);

[[9, 14], [16, 14], [25, 17], [12, 33], [7, 30]].forEach(([y, x]) => {
  decor[y][x] = 'rock';
  collision[y][x] = true;
});

// Wild flowers
[[19, 19], [22, 19], [13, 22], [16, 22], [13, 30], [16, 30], [5, 19]].forEach(([y, x]) => {
  ground[y][x] = 'flowers';
});

// 6. Signposts
const signs = [
  {
    x: 22,
    y: 27,
    text: '📍 RUTA CLARO\nSur: Villa Brote.\nEste: Bosque Eco.',
  },
  {
    x: 37,
    y: 13,
    text: '🌲 ENTRADA A BOSQUE ECO\n"Cuidado con las sombras que acechan entre la maleza densa."',
  },
  {
    x: 15,
    y: 19,
    text: '🎣 LAGO SERENO\n"Zona predilecta de criaturas acuáticas."',
  },
];
signs.forEach((s) => {
  collision[s.y][s.x] = true;
});

export const RUTA_CLARO_MAP: MapData = {
  id: 'ruta_claro',
  name: 'Ruta Claro',
  category: 'route',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  encounters,
  encounterRate: 0.14,
  encounterTable: [
    { speciesId: 'maga', minLevel: 3, maxLevel: 6, weight: 25 },
    { speciesId: 'sacerdotisa', minLevel: 3, maxLevel: 6, weight: 25 },
    { speciesId: 'hidromante', minLevel: 3, maxLevel: 6, weight: 20 },
    { speciesId: 'bruja', minLevel: 4, maxLevel: 7, weight: 15 },
    { speciesId: 'monje', minLevel: 4, maxLevel: 7, weight: 15 },
  ],
  signs,
  warps: [
    // North connection to Ciudad Cumbre
    {
      x: 20,
      y: 0,
      targetMapId: 'ciudad_gimnasio',
      targetX: 17,
      targetY: 26,
      targetDirection: 'up',
    },
    {
      x: 21,
      y: 0,
      targetMapId: 'ciudad_gimnasio',
      targetX: 18,
      targetY: 26,
      targetDirection: 'up',
    },
    // South connection to Villa Brote
    {
      x: 20,
      y: 29,
      targetMapId: 'villa_brote',
      targetX: 14,
      targetY: 1,
      targetDirection: 'down',
    },
    {
      x: 21,
      y: 29,
      targetMapId: 'villa_brote',
      targetX: 15,
      targetY: 1,
      targetDirection: 'down',
    },
    // East connection to Bosque Eco
    {
      x: 39,
      y: 14,
      targetMapId: 'bosque_eco',
      targetX: 1,
      targetY: 18,
      targetDirection: 'right',
    },
    {
      x: 39,
      y: 15,
      targetMapId: 'bosque_eco',
      targetX: 1,
      targetY: 19,
      targetDirection: 'right',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_trainer_clara',
      name: 'Chica Clara',
      paletteId: 'lass',
      x: 23,
      y: 18,
      direction: 'left',
      dialogueLines: [
        '¡Mis criaturas y yo hemos estado entrenando en los pastos de Ruta Claro!',
        'Las criaturas de tipo Planta como Brotín son excelentes absorbiendo energía.',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Joven',
        creatureSpeciesId: 'brotin',
        creatureLevel: 6,
      },
    },
    {
      id: 'npc_fisherman_sergio',
      name: 'Pescador Sergio',
      paletteId: 'hiker',
      x: 15,
      y: 12,
      direction: 'left',
      dialogueLines: [
        'Paciencia y calma... Aquilo suele asomarse por las orillas soleadas.',
        'Si usas movimientos de tipo Eléctrico o Planta contra él, ¡obtendrás ventaja!',
      ],
    },
    {
      id: 'npc_hiker_marcos',
      name: 'Montañero Marcos',
      paletteId: 'hiker',
      x: 27,
      y: 8,
      direction: 'down',
      dialogueLines: [
        'Hacia el este el follaje se vuelve mucho más espeso...',
        'Bosque Eco es el hogar de criaturas de Sombra como Umbrito. ¡Prepárate bien!',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 20, y: 28, direction: 'up' },
    from_south: { x: 20, y: 28, direction: 'up' },
    from_east: { x: 38, y: 14, direction: 'left' },
  },
  ambientMusic: 'route',
  sunlightColor: 0xfffaed,
  skyColor: 0x60a5fa,
};
