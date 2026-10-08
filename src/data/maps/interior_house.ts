import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';
import esText from '../text/es.json';

const W = 8;
const H = 8;
const houseText = (esText as any).dialogue.interior_house;

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

// Exit door at bottom (x: 4, y: 7)
collision[7][4] = false;

// Furniture: Chronicle Crystal (x: 2, y: 1), Bed (x: 6, y: 1), Dining Table (x: 3..4, y: 4)
[[1, 2], [1, 6], [2, 6], [4, 3], [4, 4]].forEach(([y, x]) => {
  decor[y][x] = 'building_wall';
  collision[y][x] = true;
});

export const INTERIOR_HOUSE_MAP: MapData = {
  id: 'interior_house',
  name: houseText.map_name,
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
      x: 2,
      y: 1,
      interactLabel: 'Examinar',
      text: houseText.tv_sign,
    },
    {
      x: 6,
      y: 1,
      interactLabel: 'Examinar',
      text: houseText.bed_sign,
    },
  ],
  warps: [
    {
      x: 4,
      y: 7,
      targetMapId: 'aldea_marioneta',
      targetX: 7,
      targetY: 8,
      targetDirection: 'down',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_mom',
      name: houseText.caretaker_name,
      paletteId: 'lass',
      x: 2,
      y: 4,
      direction: 'right',
      interactLabel: 'Hablar',
      dialogueLines: [
        houseText.caretaker_line_1,
        houseText.caretaker_line_2,
      ],
    },
  ],
  spawnPoints: {
    default: { x: 4, y: 6, direction: 'up' },
  },
  ambientMusic: 'house',
  sunlightColor: 0xfef08a,
  skyColor: 0x0f172a,
};
