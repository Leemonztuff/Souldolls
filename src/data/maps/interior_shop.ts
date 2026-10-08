import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';

const W = 12;
const H = 10;

const ground: TileType[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => 'interior_floor')
);
const decor: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);
const collision: boolean[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => false)
);

// 1. Perimeter walls
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

// Exit doorway at bottom (x: 5, 6, y: 9)
collision[H - 1][5] = false;
collision[H - 1][6] = false;
decor[H - 1][5] = 'door';
decor[H - 1][6] = 'door';

// 2. Back wall shelves (y: 1, x: 2..9)
for (let x = 2; x <= 9; x++) {
  collision[1][x] = true;
  decor[1][x] = 'shelf';
}

// 3. Counter (y: 4, x: 4..7)
for (let x = 4; x <= 7; x++) {
  collision[4][x] = true;
  decor[4][x] = 'counter';
}

// 4. Left side: Mannequins and Safe (x: 1, y: 3..6)
collision[3][1] = true;
decor[3][1] = 'mannequin';
collision[4][1] = true;
decor[4][1] = 'mannequin';
collision[5][1] = true;
decor[5][1] = 'mannequin';
collision[6][1] = true;
decor[6][1] = 'safe';

// 5. Right side: Weapon rack, Crystals, Notice board (x: 10, y: 3..6)
collision[3][10] = true;
decor[3][10] = 'weapon_rack';
collision[4][10] = true;
decor[4][10] = 'crystals';
collision[5][10] = true;
decor[5][10] = 'crystals';
collision[6][10] = true;
decor[6][10] = 'notice_board';

// 6. Vitrinas (x: 3, y: 6 and x: 8, y: 6)
collision[6][3] = true;
decor[6][3] = 'vitrina';
collision[6][8] = true;
decor[6][8] = 'vitrina';

export const INTERIOR_SHOP_MAP: MapData = {
  id: 'interior_shop',
  name: 'Mercado de Artífices',
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
      x: 1,
      y: 3,
      shopCategory: 'bodies',
      interactLabel: 'Abrir',
      text: 'EXPOSITOR DE CUERPOS\n"Cuerpos de marioneta artesanales. Toca para ver catálogo de Cuerpos."',
    },
    {
      x: 1,
      y: 4,
      shopCategory: 'bodies',
      interactLabel: 'Abrir',
      text: 'EXPOSITOR DE CUERPOS\n"Cuerpos reforzados de hierro y madera con ranuras de equipo."',
    },
    {
      x: 1,
      y: 5,
      shopCategory: 'bodies',
      interactLabel: 'Abrir',
      text: 'EXPOSITOR DE CUERPOS\n"Marionetas de alta resonancia espiritual para almas avanzadas."',
    },
    {
      x: 1,
      y: 6,
      shopCategory: 'gear',
      interactLabel: 'Abrir',
      text: 'CAJA FUERTE DEL GREMIO\n"Depósito seguro de reliquias y armamento de artífices."',
    },
    {
      x: 10,
      y: 3,
      shopCategory: 'gear',
      interactLabel: 'Abrir',
      text: 'ARMERO DE RELIQUIAS\n"Armas y reliquias de combate. Pulsa A para ver catálogo."',
    },
    {
      x: 10,
      y: 4,
      shopCategory: 'crystals',
      interactLabel: 'Abrir',
      text: 'VITRINA DE CRISTALES\n"Cristales de ki puro y maná para reforzar tus almas."',
    },
    {
      x: 10,
      y: 5,
      shopCategory: 'crystals',
      interactLabel: 'Abrir',
      text: 'PEDESTAL DE CRISTALES\n"Cristales resonadores elementales."',
    },
    {
      x: 10,
      y: 6,
      shopCategory: 'quests',
      interactLabel: 'Leer',
      text: 'TABLÓN DE ENCARGOS\n"Misiones activas y pedidos de los Artífices."',
    },
    {
      x: 3,
      y: 6,
      shopCategory: 'bottles',
      interactLabel: 'Abrir',
      text: 'VITRINA DE SOUL BOTTLES\n"Recipientes para capturar almas salvajes en praderas y bosques."',
    },
    {
      x: 8,
      y: 6,
      shopCategory: 'elixirs',
      interactLabel: 'Abrir',
      text: 'BOTICARIO DE ELIXIRES\n"Elixires de restauración de ki y purgas de corrupción."',
    },
    {
      x: 4,
      y: 4,
      shopMode: 'buy',
      interactLabel: 'Abrir',
      text: 'MOSTRADOR DE MERCADER\n"Menú de Compra y Venta del Mercado de Artífices."',
    },
    {
      x: 5,
      y: 4,
      shopMode: 'buy',
      interactLabel: 'Abrir',
      text: 'MOSTRADOR DE MERCADER\n"Menú de Compra y Venta del Mercado de Artífices."',
    },
    {
      x: 6,
      y: 4,
      shopMode: 'buy',
      interactLabel: 'Abrir',
      text: 'MOSTRADOR DE MERCADER\n"Menú de Compra y Venta del Mercado de Artífices."',
    },
    {
      x: 7,
      y: 4,
      shopMode: 'buy',
      interactLabel: 'Abrir',
      text: 'MOSTRADOR DE MERCADER\n"Menú de Compra y Venta del Mercado de Artífices."',
    },
  ],
  warps: [
    {
      x: 5,
      y: 9,
      targetMapId: 'villa_brote',
      targetX: 27,
      targetY: 15,
      targetDirection: 'down',
      interactLabel: 'Entrar',
    },
    {
      x: 6,
      y: 9,
      targetMapId: 'villa_brote',
      targetX: 27,
      targetY: 15,
      targetDirection: 'down',
      interactLabel: 'Entrar',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_shop_clerk',
      name: 'Mercader Artífice',
      paletteId: 'clerk',
      x: 5,
      y: 3,
      direction: 'down',
      interactLabel: 'Hablar',
      dialogueLines: [
        '¡Bienvenido al Mercado de Artífices de Villa Brote!',
        'Tenemos los mejores recipientes Soul Bottles, elixires de ki y chasis para tus Souldolls.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 5, y: 8, direction: 'up' },
  },
  ambientMusic: 'shop',
  sunlightColor: 0xffedd5,
  skyColor: 0x0f172a,
};
