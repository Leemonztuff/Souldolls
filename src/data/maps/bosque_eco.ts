import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 36;
const H = 36;

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

// 1. Dense Perimeter Trees
for (let x = 0; x < W; x++) {
  decor[0][x] = 'tree';
  collision[0][x] = true;
  decor[H - 1][x] = 'tree';
  collision[H - 1][x] = true;
}
for (let y = 0; y < H; y++) {
  // West entrance at y 18..19 for Ruta Claro
  if (y < 17 || y > 20) {
    decor[y][0] = 'tree';
    collision[y][0] = true;
  }
  decor[y][W - 1] = 'tree';
  collision[y][W - 1] = true;
}

// 2. Cave Section in North-East (y: 2..10, x: 22..33)
for (let y = 2; y <= 10; y++) {
  for (let x = 22; x <= 33; x++) {
    ground[y][x] = 'cave_floor';
  }
}
// Cave stone wall enclosure with entrance at x 27..28, y 10
for (let x = 22; x <= 33; x++) {
  decor[2][x] = 'wall';
  collision[2][x] = true;
  if (x < 26 || x > 29) {
    decor[10][x] = 'wall';
    collision[10][x] = true;
  }
}
for (let y = 3; y <= 9; y++) {
  decor[y][22] = 'wall';
  collision[y][22] = true;
  decor[y][33] = 'wall';
  collision[y][33] = true;
}

// 3. Winding Mossy Pathways
// From West entrance (x 0..1, y 18..19) into central clearing
for (let x = 0; x <= 18; x++) {
  ground[18][x] = 'path';
  ground[19][x] = 'path';
}
// Path ascending North towards Cave entrance (x: 18..28, y: 10..18)
for (let y = 10; y <= 18; y++) {
  ground[y][18] = 'path';
  ground[y][19] = 'path';
}
for (let x = 18; x <= 28; x++) {
  ground[10][x] = 'path';
  ground[11][x] = 'path';
}
// Path to South-East ancient shrine (x: 18..30, y: 19..30)
for (let y = 19; y <= 30; y++) {
  ground[y][28] = 'path';
  ground[y][29] = 'path';
}

// 4. Dense Labyrinth Trees & Ancient Boulders
const treeClusters = [
  // West grove
  [12, 6], [13, 6], [14, 6], [12, 7], [13, 7], [14, 7],
  [24, 8], [25, 8], [26, 8], [24, 9], [25, 9],
  // Central thicket
  [6, 12], [7, 12], [8, 12], [6, 13], [7, 13], [8, 13],
  [22, 16], [23, 16], [24, 16], [22, 17], [23, 17],
  // South thicket
  [26, 22], [27, 22], [28, 22], [29, 22],
  [30, 12], [31, 12], [32, 12], [33, 12],
];
treeClusters.forEach(([y, x]) => {
  decor[y][x] = 'tree';
  collision[y][x] = true;
});

const rocks = [
  [15, 12], [22, 6], [8, 18], [14, 25], [25, 26], [32, 26],
  [5, 25], [5, 30], [8, 25], [8, 30], // inside cave pillars
];
rocks.forEach(([y, x]) => {
  decor[y][x] = 'rock';
  collision[y][x] = true;
});

// 5. Tall Grass (Abundant Shadow & Earth Habitats)
// North-West Woods (y: 3..9, x: 3..11)
for (let y = 3; y <= 9; y++) {
  for (let x = 3; x <= 11; x++) {
    if (ground[y][x] === 'grass' && !decor[y][x]) {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}
// South-West Glade (y: 22..32, x: 2..14)
for (let y = 22; y <= 32; y++) {
  for (let x = 2; x <= 14; x++) {
    if (ground[y][x] === 'grass' && !decor[y][x]) {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}
// South-East Deep Woods (y: 16..26, x: 21..27)
for (let y = 16; y <= 26; y++) {
  for (let x = 21; x <= 27; x++) {
    if (ground[y][x] === 'grass' && !decor[y][x]) {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}

// 6. Signposts
const signs = [
  {
    x: 4,
    y: 17,
    text: '🌲 BOSQUE ECO\nOeste: Ruta Claro.\nNoreste: Caverna del Eco Profundo.',
  },
  {
    x: 25,
    y: 11,
    text: '🦇 CUEVA DEL ECO\n"Se dice que en las profundidades aguarda una criatura ancestral."',
  },
];
signs.forEach((s) => {
  collision[s.y][s.x] = true;
});

export const BOSQUE_ECO_MAP: MapData = {
  id: 'bosque_eco',
  name: 'Bosque Eco',
  category: 'forest',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  encounters,
  encounterRate: 0.18,
  encounterTable: [
    { speciesId: 'asesina', minLevel: 8, maxLevel: 12, weight: 30 },
    { speciesId: 'paladin', minLevel: 8, maxLevel: 12, weight: 25 },
    { speciesId: 'sacerdotisa', minLevel: 8, maxLevel: 12, weight: 20 },
    { speciesId: 'bruja', minLevel: 8, maxLevel: 10, weight: 15 },
    { speciesId: 'espectro', minLevel: 16, maxLevel: 20, weight: 5 },
    { speciesId: 'hierofante', minLevel: 16, maxLevel: 20, weight: 5 },
  ],
  signs,
  warps: [
    // West connection back to Ruta Claro
    {
      x: 0,
      y: 18,
      targetMapId: 'ruta_claro',
      targetX: 38,
      targetY: 14,
      targetDirection: 'left',
    },
    {
      x: 0,
      y: 19,
      targetMapId: 'ruta_claro',
      targetX: 38,
      targetY: 15,
      targetDirection: 'left',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_explorer_alicia',
      name: 'Exploradora Alicia',
      paletteId: 'lass',
      x: 16,
      y: 17,
      direction: 'left',
      dialogueLines: [
        '¡La energía en este bosque es misteriosa!',
        'Las criaturas de tipo Sombra como Umbrito son resistentes a los ataques físicos y mágicos.',
      ],
    },
    {
      id: 'npc_boss_guardian',
      name: 'Guardián del Eco',
      paletteId: 'professor',
      x: 27,
      y: 5,
      direction: 'down',
      dialogueLines: [
        '¡Has llegado a lo más profundo de la Cueva del Eco!',
        'Demuestra tu valía y tu comprensión del vínculo con tus criaturas.',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Guardián',
        creatureSpeciesId: 'noctarro',
        creatureLevel: 15,
      },
    },
  ],
  spawnPoints: {
    default: { x: 2, y: 18, direction: 'right' },
    from_west: { x: 2, y: 18, direction: 'right' },
  },
  ambientMusic: 'forest',
  sunlightColor: 0xd8b4fe, // soft violet-tinted atmospheric light
  skyColor: 0x1e1b4b,      // deep dark indigo atmosphere
};
