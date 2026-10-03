import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 10;
const H = 8;

const ground: TileType[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => 'interior_floor')
);
const decor: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);
const collision: boolean[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => false)
);

// Perimeter walls
for (let x = 0; x < W; x++) {
  decor[0][x] = 'wall';
  collision[0][x] = true;
  decor[H - 1][x] = 'wall';
  collision[H - 1][x] = true;
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'wall';
  collision[y][0] = true;
  decor[y][W - 1] = 'wall';
  collision[y][W - 1] = true;
}

// Exit rug at bottom (x: 5, y: 7)
collision[7][5] = false;

// Shop Counter (y: 3, x: 2..5)
for (let x = 2; x <= 5; x++) {
  decor[3][x] = 'building_wall';
  collision[3][x] = true;
}

// Merchandise shelves (y: 1..2, x: 7..8; y: 4..5, x: 8)
[[1, 7], [1, 8], [2, 7], [2, 8], [4, 8], [5, 8]].forEach(([y, x]) => {
  decor[y][x] = 'building_wall';
  collision[y][x] = true;
});

export const INTERIOR_SHOP_MAP: MapData = {
  id: 'interior_shop',
  name: 'Tienda de Objetos',
  category: 'interior',
  indoor: true,
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  signs: [
    {
      x: 7,
      y: 1,
      text: '📦 ESTANTE DE PRODUCTOS\n"Cápsulas: $200 | Pociones: $300 | Antídotos: $100 | Revivir: $1500"',
    },
  ],
  warps: [
    {
      x: 5,
      y: 7,
      targetMapId: 'villa_brote',
      targetX: 22,
      targetY: 18,
      targetDirection: 'down',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_shop_clerk',
      name: 'Tendero',
      paletteId: 'clerk',
      x: 3,
      y: 2,
      direction: 'down',
      dialogueLines: [
        '¡Buenas! Bienvenido a la Tienda de Villa Brote.',
        '¿En qué puedo servirte hoy? Tenemos las mejores Cápsulas y suministros médicos para tu viaje.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 5, y: 6, direction: 'up' },
  },
  ambientMusic: 'shop',
  sunlightColor: 0xffedd5,
  skyColor: 0x0f172a,
};
