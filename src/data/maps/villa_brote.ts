import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 30;
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

// 1. Perimeter Trees & Fences
for (let x = 0; x < W; x++) {
  if (x < 13 || x > 16) {
    decor[0][x] = 'tree';
    collision[0][x] = true;
  }
  decor[H - 1][x] = 'tree';
  collision[H - 1][x] = true;
}
for (let y = 0; y < H; y++) {
  if (y < 11 || y > 12) {
    decor[y][0] = 'tree';
    collision[y][0] = true;
  }
  decor[y][W - 1] = 'tree';
  collision[y][W - 1] = true;
}

// 2. Central Plaza & Paths
// North-South main thoroughfare (leading to Ruta Claro at x 14..15, y 0)
for (let y = 0; y <= 22; y++) {
  ground[y][14] = 'path';
  ground[y][15] = 'path';
}
// West avenue to Puerto Marea
for (let x = 0; x <= 13; x++) {
  ground[11][x] = 'path';
  ground[12][x] = 'path';
}
// East-West avenues connecting buildings
for (let x = 3; x <= 26; x++) {
  ground[9][x] = 'path';
  ground[18][x] = 'path';
}
// Paths leading up to building doors
for (let y = 7; y <= 9; y++) {
  ground[y][6] = 'path';
  ground[y][22] = 'path';
}
for (let y = 17; y <= 18; y++) {
  ground[y][7] = 'path';
  ground[y][22] = 'path';
}

// 3. Central Fountain (y: 11..13, x: 13..16)
for (let y = 11; y <= 13; y++) {
  for (let x = 13; x <= 16; x++) {
    ground[y][x] = 'water';
    collision[y][x] = true;
  }
}
// Paved circle around fountain
for (let y = 10; y <= 14; y++) {
  for (let x = 12; x <= 17; x++) {
    if (ground[y][x] !== 'water') ground[y][x] = 'path';
  }
}

// 4. Building 1: Casa del Jugador (top-left: x 4..8, y 4..7, door at 6, 7)
const buildHouse = (startX: number, startY: number, width: number, height: number, doorX: number) => {
  for (let y = startY; y <= startY + height; y++) {
    for (let x = startX; x <= startX + width; x++) {
      collision[y][x] = true;
      if (y === startY) {
        decor[y][x] = 'roof';
      } else if (y === startY + height && x === doorX) {
        decor[y][x] = 'door';
        collision[y][x] = false; // Walkable door to trigger warp
      } else {
        decor[y][x] = 'building_wall';
      }
    }
  }
};

// Player House
buildHouse(4, 3, 4, 4, 6);
// Professor Lab (larger)
buildHouse(19, 3, 6, 5, 22);
// Healing Center (Hospital)
buildHouse(4, 13, 6, 4, 7);
// Shop (Tienda)
buildHouse(19, 13, 6, 4, 22);

// 5. Flower beds and scenic decor
[[8, 12], [8, 17], [10, 8], [10, 21], [15, 8], [15, 21], [19, 12], [19, 17]].forEach(([y, x]) => {
  ground[y][x] = 'flowers';
});

// Small garden plots
for (let x = 9; x <= 11; x++) {
  ground[5][x] = 'flowers';
  ground[6][x] = 'flowers';
}

// 6. Signposts
const signs = [
  {
    x: 8,
    y: 8,
    text: '🏠 REFUGIO DEL ALMA\n"Un lugar para el descanso del Soultrainer."',
  },
  {
    x: 24,
    y: 9,
    text: '🔬 ESTUDIO DE RESONANCIA\n"Investigación sobre el ki y la forma de las almas."',
  },
  {
    x: 9,
    y: 18,
    text: '🛠 TALLER DE ARTÍFICES\n"Forja de chasis y purga de ki corrupto."',
  },
  {
    x: 24,
    y: 18,
    text: '🏪 MERCADO DE ALMAS\n"Soul Bottles, Elixires y suministros de contención."',
  },
  {
    x: 16,
    y: 2,
    text: '⬆ NORTE: SENDEROS SALVAJES\n"El ki salvaje acecha más allá de los límites."',
  },
];
signs.forEach((s) => {
  collision[s.y][s.x] = true;
});

export const VILLA_BROTE_MAP: MapData = {
  id: 'villa_brote',
  name: 'Aldea Marioneta',
  category: 'town',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  signs,
  warps: [
    // West exit to Puerto Marea
    {
      x: 0,
      y: 11,
      targetMapId: 'pueblo_costero',
      targetX: 30,
      targetY: 11,
      targetDirection: 'left',
    },
    {
      x: 0,
      y: 12,
      targetMapId: 'pueblo_costero',
      targetX: 30,
      targetY: 12,
      targetDirection: 'left',
    },
    // North exit to Ruta Claro
    {
      x: 14,
      y: 0,
      targetMapId: 'ruta_claro',
      targetX: 20,
      targetY: 28,
      targetDirection: 'up',
    },
    {
      x: 15,
      y: 0,
      targetMapId: 'ruta_claro',
      targetX: 21,
      targetY: 28,
      targetDirection: 'up',
    },
    // Doors to Interiors
    {
      x: 6,
      y: 7,
      targetMapId: 'interior_house',
      targetX: 4,
      targetY: 6,
      targetDirection: 'up',
    },
    {
      x: 22,
      y: 8,
      targetMapId: 'interior_lab',
      targetX: 5,
      targetY: 6,
      targetDirection: 'up',
    },
    {
      x: 7,
      y: 17,
      targetMapId: 'interior_center',
      targetX: 6,
      targetY: 10,
      targetDirection: 'up',
    },
    {
      x: 22,
      y: 17,
      targetMapId: 'interior_shop',
      targetX: 5,
      targetY: 8,
      targetDirection: 'up',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_guide_leo',
      name: 'Guía Leo',
      paletteId: 'hiker',
      x: 13,
      y: 4,
      direction: 'down',
      dialogueLines: [
        '¡Bienvenido a Villa Brote!',
        'Al norte está Ruta Claro, donde las criaturas salvajes habitan entre la hierba alta.',
        'Antes de partir, te recomiendo visitar al Prof. Roble en su laboratorio al este.',
      ],
    },
    {
      id: 'npc_girl_mia',
      name: 'Mía',
      paletteId: 'lass',
      x: 11,
      y: 11,
      direction: 'right',
      dialogueLines: [
        'La fuente de la plaza es el corazón de nuestro pueblo.',
        'Dicen que el agua que brota aquí tiene propiedades restauradoras.',
      ],
    },
    {
      id: 'npc_clerk_outdoor',
      name: 'Repartidor',
      paletteId: 'clerk',
      x: 20,
      y: 18,
      direction: 'left',
      dialogueLines: [
        '¡Acaban de llegar nuevas provisiones a la Tienda de Objetos!',
        'No olvides llevar suficientes Cápsulas antes de aventurarte al bosque.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 6, y: 8, direction: 'down' },
    from_north: { x: 14, y: 1, direction: 'down' },
    from_house: { x: 6, y: 8, direction: 'down' },
    from_lab: { x: 22, y: 9, direction: 'down' },
    from_center: { x: 7, y: 18, direction: 'down' },
    from_shop: { x: 22, y: 18, direction: 'down' },
  },
  ambientMusic: 'town',
  sunlightColor: 0xfffaed,
  skyColor: 0x38bdf8,
};
