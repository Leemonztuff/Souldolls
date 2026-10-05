import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';

const W = 20;
const H = 20;

// Initialize 20x20 grids
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

// 1. Perimeter Trees (Solid Border)
for (let x = 0; x < W; x++) {
  decor[0][x] = 'tree';
  collision[0][x] = true;
  decor[H - 1][x] = 'tree';
  collision[H - 1][x] = true;
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'tree';
  collision[y][0] = true;
  decor[y][W - 1] = 'tree';
  collision[y][W - 1] = true;
}

// Extra dense forest clusters
[[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [1, 17], [1, 18], [2, 18], [3, 18], [17, 1], [18, 1], [18, 2], [18, 17], [18, 18], [17, 18]].forEach(
  ([y, x]) => {
    decor[y][x] = 'tree';
    collision[y][x] = true;
  }
);

// 2. Main Dirt Path (Going from bottom (10, 18) to top (10, 2), with branches)
for (let y = 3; y <= 18; y++) {
  ground[y][9] = 'path';
  ground[y][10] = 'path';
}
// Branch to the east (towards the lake)
for (let x = 11; x <= 14; x++) {
  ground[9][x] = 'path';
  ground[10][x] = 'path';
}
// Branch to the west (towards small clearing)
for (let x = 4; x <= 8; x++) {
  ground[14][x] = 'path';
}

// 3. Water Pond (Top-Right: y: 3..7, x: 13..17)
for (let y = 3; y <= 7; y++) {
  for (let x = 13; x <= 17; x++) {
    ground[y][x] = 'water';
    collision[y][x] = true;
  }
}
// Sand shoreline around water
for (let y = 2; y <= 8; y++) {
  for (let x = 12; x <= 18; x++) {
    if (ground[y][x] !== 'water' && !collision[y][x]) {
      ground[y][x] = 'sand';
    }
  }
}

// 4. Tall Grass Patches (Wild Encounters)
// West patch (y: 6..12, x: 2..7)
for (let y = 6; y <= 12; y++) {
  for (let x = 2; x <= 7; x++) {
    if (ground[y][x] === 'grass' && !decor[y][x]) {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}

// East patch (y: 12..16, x: 12..17)
for (let y = 12; y <= 16; y++) {
  for (let x = 12; x <= 17; x++) {
    if (ground[y][x] === 'grass' && !decor[y][x]) {
      ground[y][x] = 'tall_grass';
      encounters[y][x] = 'tall_grass';
    }
  }
}

// 5. Flowers & Rocks
[[8, 8], [9, 8], [11, 8], [15, 9], [15, 11], [4, 8], [4, 11]].forEach(([y, x]) => {
  ground[y][x] = 'flowers';
});

[[5, 4], [16, 4], [11, 16], [8, 17]].forEach(([y, x]) => {
  decor[y][x] = 'rock';
  collision[y][x] = true;
});

// 6. Signposts
const signs = [
  {
    x: 8,
    y: 16,
    text: '📍 RUTA 1 - Sendero Esmeralda\nAl norte: Laboratorio del Profesor.\nAl este: Lago Cristalino.',
  },
  {
    x: 12,
    y: 8,
    text: '🌊 LAGO CRISTALINO\nCuidado con las corrientes profundas.',
  },
];
collision[16][8] = true;
collision[8][12] = true;

export const TEST_ROUTE_MAP: MapData = {
  id: 'route_1',
  name: 'Ruta 1 - Sendero Esmeralda',
  category: 'route',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  encounters,
  warps: [],
  triggers: [],
  signs,
  npcs: [
    {
      id: 'npc_lass_clara',
      name: 'Chica Clara',
      paletteId: 'lass',
      x: 8,
      y: 13,
      direction: 'right',
      dialogueLines: [
        '¡Hola entrenador!',
        'Si caminas por el pasto alto, ¡encontrarás criaturas salvajes!',
        '¡Asegúrate de llevar Pociones y Cápsulas!',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Joven',
        creatureSpeciesId: 'brotin',
        creatureLevel: 4,
      },
    },
    {
      id: 'npc_prof_roble',
      name: 'Prof. Roble',
      paletteId: 'professor',
      x: 10,
      y: 4,
      direction: 'down',
      dialogueLines: [
        '¡Ah, bienvenido a la aventura!',
        'Las criaturas de este mundo tienen afinidades elementales únicas.',
        'Explora con libertad y completa la enciclopedia.',
      ],
    },
    {
      id: 'npc_hiker_bruno',
      name: 'Montañero Bruno',
      paletteId: 'hiker',
      x: 15,
      y: 11,
      direction: 'left',
      dialogueLines: [
        '¡El aire fresco de la montaña es inigualable!',
        'Las criaturas de tipo Tierra como Rocalín resisten cualquier golpe eléctrico.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 10, y: 17, direction: 'up' },
    north: { x: 10, y: 2, direction: 'down' },
  },
  ambientMusic: 'route',
  sunlightColor: 0xfffaed,
  skyColor: 0x60a5fa,
};
