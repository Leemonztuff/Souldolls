import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';
import workshopData from './workshop_interior.json';

const W = workshopData.width; // 14
const H = workshopData.height; // 12

const ground: TileType[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => 'interior_floor')
);
const decor: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);
const collision: boolean[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => false)
);

// 1. Perimeter walls (x = 0, W-1; y = 0, H-1)
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

// 2. Doorway at bottom center (x: 6, y: 11) - Walkable exit
decor[H - 1][6] = 'door';
collision[H - 1][6] = false;

// 3. Top Wall Decor (y: 1)
// [Cristales de maná] (x: 2..3, y: 1)
decor[1][2] = 'mana_crystals';
collision[1][2] = true;
decor[1][3] = 'mana_crystals';
collision[1][3] = true;

// [Vitrina de Souls] (x: 6..7, y: 1)
decor[1][6] = 'soul_vitrine';
collision[1][6] = true;
decor[1][7] = 'soul_vitrine';
collision[1][7] = true;

// [Armas y Reliquias] (x: 10..11, y: 1)
decor[1][10] = 'relics_case';
collision[1][10] = true;
decor[1][11] = 'relics_case';
collision[1][11] = true;

// 4. Left Wall Decor
// [Frascos] (x: 1, y: 3)
decor[3][1] = 'flasks_shelf';
collision[3][1] = true;

// [Elixires] (x: 1, y: 4)
decor[4][1] = 'elixirs_shelf';
collision[4][1] = true;

// [cajas] (x: 1..2, y: 6..7)
decor[6][1] = 'crates';
collision[6][1] = true;
decor[6][2] = 'crates';
collision[6][2] = true;
decor[7][1] = 'crates';
collision[7][1] = true;

// 5. Center Mostrador & Balanza (y: 5)
// [balanza] on counter (x: 5, y: 5)
decor[5][5] = 'counter_scale';
collision[5][5] = true;

// [MOSTRADOR] (x: 6..8, y: 5)
for (let x = 6; x <= 8; x++) {
  decor[5][x] = 'counter';
  collision[5][x] = true;
}

// 6. Right Side Decor
// [Maniquíes de cuerpos] (x: 12, y: 3..4)
decor[3][12] = 'mannequins';
collision[3][12] = true;
decor[4][12] = 'mannequins';
collision[4][12] = true;

// [caja fuerte] (x: 11..12, y: 7)
decor[7][11] = 'safe';
collision[7][11] = true;
decor[7][12] = 'safe';
collision[7][12] = true;

// 7. Lower Area: Alfombra & Tablón
// [alfombra] runner (x: 6..7, y: 6..10) - WALKABLE!
for (let y = 6; y <= 10; y++) {
  decor[y][6] = 'carpet';
  decor[y][7] = 'carpet';
}

// [Tablón de encargos] (x: 11, y: 9)
decor[9][11] = 'bounty_board';
collision[9][11] = true;

export const INTERIOR_CENTER_MAP: MapData = {
  id: workshopData.id,
  name: workshopData.name,
  category: 'interior',
  indoor: true,
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  signs: workshopData.signs,
  warps: [
    {
      x: 6,
      y: 11,
      targetMapId: 'villa_brote',
      targetX: 9,
      targetY: 15,
      targetDirection: 'down',
      interactLabel: 'Entrar',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_nurse_joy',
      name: 'Artífice de Almas',
      paletteId: 'clerk',
      x: 6,
      y: 4,
      direction: 'down',
      interactLabel: 'Hablar',
      dialogueLines: [
        workshopData.dialogues.welcome,
        workshopData.dialogues.first_visit,
        workshopData.dialogues.healing_complete,
      ],
    },
  ],
  spawnPoints: {
    default: { x: 6, y: 10, direction: 'up' },
  },
  ambientMusic: 'center',
  sunlightColor: 0xfffaed,
  skyColor: 0x0f172a,
};
