import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 40;
const H = 28;

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

// 1. Mountain Rock & Cliff Perimeters
for (let x = 0; x < W; x++) {
  decor[0][x] = 'rock';
  collision[0][x] = true;
  // South opening to Ciudad Cumbre at x: 19..20
  if (x < 18 || x > 21) {
    decor[H - 1][x] = 'rock';
    collision[H - 1][x] = true;
  }
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'rock';
  collision[y][0] = true;
  decor[y][W - 1] = 'rock';
  collision[y][W - 1] = true;
}

// 2. High Alpine Rock Ridges and Glacial Formations
for (let y = 4; y <= 22; y++) {
  if (y !== 11 && y !== 12 && y !== 17) {
    decor[y][10] = 'rock';
    collision[y][10] = true;
    decor[y][28] = 'rock';
    collision[y][28] = true;
  }
}

// 3. Winding Ascending Mountain Trail
for (let y = 14; y < H; y++) {
  ground[y][19] = 'path';
  ground[y][20] = 'path';
}
// Switchbacks
for (let x = 11; x <= 27; x++) {
  ground[14][x] = 'path';
  ground[9][x] = 'path';
}
for (let y = 5; y <= 9; y++) {
  ground[y][19] = 'path';
  ground[y][20] = 'path';
}

// 4. Frozen glacial pools (y: 6..8, x: 23..26)
for (let y = 6; y <= 8; y++) {
  for (let x = 23; x <= 26; x++) {
    ground[y][x] = 'water';
    collision[y][x] = true;
  }
}

// 5. Alpine tall grass / snow patches
for (let y = 16; y <= 21; y++) {
  for (let x = 4; x <= 8; x++) {
    encounters[y][x] = 'tall_grass';
    ground[y][x] = 'tall_grass';
  }
}
for (let y = 16; y <= 21; y++) {
  for (let x = 30; x <= 35; x++) {
    encounters[y][x] = 'tall_grass';
    ground[y][x] = 'tall_grass';
  }
}
// Summit Meadow (y: 3..5, x: 17..22)
for (let y = 3; y <= 5; y++) {
  for (let x = 17; x <= 22; x++) {
    encounters[y][x] = 'tall_grass';
    ground[y][x] = 'tall_grass';
  }
}

export const RUTA_MONTANA_MAP: MapData = {
  id: 'ruta_montana',
  name: 'Ruta Escarpada',
  category: 'route',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  encounters,
  signs: [
    {
      x: 21,
      y: 25,
      text: '⛰️ RUTA ESCARPADA\n"Ascenso al Santuario del Alto Mando."',
    },
    {
      x: 18,
      y: 6,
      text: '❄️ CUMBRE DEL MUNDO\nPlataforma de los Cuatro Campeones.',
    },
  ],
  warps: [
    // South connection to Ciudad Cumbre
    {
      x: 19,
      y: 27,
      targetMapId: 'ciudad_gimnasio',
      targetX: 17,
      targetY: 1,
      targetDirection: 'down',
    },
    {
      x: 20,
      y: 27,
      targetMapId: 'ciudad_gimnasio',
      targetX: 18,
      targetY: 1,
      targetDirection: 'down',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_climber_bruno',
      name: 'Montañero Bruno',
      paletteId: 'hiker',
      x: 21,
      y: 18,
      direction: 'left',
      dialogueLines: [
        '¡El aire aquí arriba es frío y puro! Las criaturas de Hielo prosperan en estas rocas.',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Montañero',
        creatureSpeciesId: 'glaciardo',
        creatureLevel: 25,
      },
    },
    {
      id: 'npc_elite_valeria',
      name: 'Campeona Valeria',
      paletteId: 'lass',
      x: 20,
      y: 4,
      direction: 'down',
      dialogueLines: [
        '¡Bienvenido a la Cumbre de la Región!',
        'Soy Valeria, Líder del Alto Mando. Has conquistado los mares y las alturas.',
        '¡Demuestra que eres digno del título de Gran Maestro!',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Alto Mando',
        creatureSpeciesId: 'auroradon',
        creatureLevel: 35,
      },
    },
    {
      id: 'npc_expert_dario',
      name: 'Veterano Darío',
      paletteId: 'professor',
      x: 15,
      y: 10,
      direction: 'right',
      dialogueLines: [
        'El Torneo del Alto Mando solo consagra a aquellos cuyo vínculo con sus compañeros es inquebrantable.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 19, y: 25, direction: 'up' },
    from_south: { x: 19, y: 25, direction: 'up' },
  },
  encounterRate: 0.22,
  encounterTable: [
    { speciesId: 'monje', minLevel: 20, maxLevel: 24, weight: 35 },
    { speciesId: 'paladin', minLevel: 21, maxLevel: 25, weight: 30 },
    { speciesId: 'maestro_trueno', minLevel: 22, maxLevel: 26, weight: 15 },
    { speciesId: 'templario', minLevel: 24, maxLevel: 28, weight: 10 },
    { speciesId: 'archimaga', minLevel: 24, maxLevel: 28, weight: 10 },
  ],
  ambientMusic: 'route',
  sunlightColor: 0xe0f2fe,
  skyColor: 0x93c5fd,
};
