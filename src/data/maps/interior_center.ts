import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';
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

// Exit rug at bottom-center (x: 6, y: 11)
collision[H - 1][6] = false;

// Front Reception Counter (y: 4, x: 4..9)
for (let x = 4; x <= 9; x++) {
  decor[4][x] = 'building_wall';
  collision[4][x] = true;
}

// Side decorations and terminals (Resonance Machine, Repair Bench, Almacén)
collision[2][3] = true; // repair bench
decor[2][3] = 'wall';

collision[2][6] = true; // resonance machine
decor[2][6] = 'building_wall';

collision[2][10] = true; // soul storage
decor[2][10] = 'wall';

collision[2][11] = true; // body storage
decor[2][11] = 'wall';

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
      targetX: 7,
      targetY: 18,
      targetDirection: 'down',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_nurse_joy',
      name: 'Artífice de Almas',
      paletteId: 'nurse',
      x: 6,
      y: 3,
      direction: 'down',
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
