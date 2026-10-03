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

// Perimeter interior walls
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

// Research tables / computer consoles
[[1, 2], [1, 3], [1, 6], [1, 7], [3, 2], [3, 3], [3, 6], [3, 7]].forEach(([y, x]) => {
  decor[y][x] = 'building_wall';
  collision[y][x] = true;
});

// Starter Pedestals (x: 4, 5, 6, y: 3)
[[3, 4], [3, 5]].forEach(([y, x]) => {
  decor[y][x] = 'rock'; // pedestal
  collision[y][x] = true;
});

export const INTERIOR_LAB_MAP: MapData = {
  id: 'interior_lab',
  name: 'Laboratorio del Maestro Artífice',
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
      x: 3,
      y: 1,
      text: '🖥 TERMINAL DE CÓDICE\n"Estudio de la resonancia de almas en marionetas humanoides."',
    },
  ],
  warps: [
    {
      x: 5,
      y: 7,
      targetMapId: 'villa_brote',
      targetX: 22,
      targetY: 9,
      targetDirection: 'down',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_prof_roble_lab',
      name: 'Maestro Artífice',
      paletteId: 'professor',
      x: 5,
      y: 2,
      direction: 'down',
      dialogueLines: [
        '¡Al fin despiertas! Te encontré colapsado cerca de la Aldea Marioneta.',
        'Examiné el flujo de tu energía... ¡es asombroso! Tu ki "no tiene ningún color" ni afinidad elemental fija.',
        'Eres un viajero de otro mundo (isekai). Por eso tu ki puede resonar libremente con cualquier alma de Anima.',
        'Toma una de estas Soul Bottles (Maga, Sacerdotisa o Hidromante) y un Cuerpo de Madera. ¡Tu aventura comienza!',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 5, y: 6, direction: 'up' },
  },
  ambientMusic: 'lab',
  sunlightColor: 0xffffff,
  skyColor: 0x0f172a,
};
