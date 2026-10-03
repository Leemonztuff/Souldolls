import { MapData } from '../../types/maps';
import { TileType } from '../../render/procedural/TileFactory';

const W = 36;
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

// 1. Perimeter Walls & Buildings
for (let x = 0; x < W; x++) {
  // North exit to Ruta Montaña at x 17..18
  if (x < 16 || x > 19) {
    decor[0][x] = 'wall';
    collision[0][x] = true;
  }
  // South exit to Ruta Claro at x 17..18
  if (x < 16 || x > 19) {
    decor[H - 1][x] = 'wall';
    collision[H - 1][x] = true;
  }
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'wall';
  collision[y][0] = true;
  decor[y][W - 1] = 'wall';
  collision[y][W - 1] = true;
}

// 2. Main Cobblestone Avenues
for (let y = 0; y < H; y++) {
  ground[y][17] = 'path';
  ground[y][18] = 'path';
}
for (let x = 4; x <= 31; x++) {
  ground[14][x] = 'path';
  ground[21][x] = 'path';
}

// 3. Grand Gym Building (Top-Center, y: 3..7, x: 13..21)
for (let y = 3; y <= 7; y++) {
  for (let x = 13; x <= 21; x++) {
    collision[y][x] = true;
    if (y === 3) decor[y][x] = 'roof';
    else if (y === 7 && (x === 17 || x === 18)) {
      decor[y][x] = 'door';
      collision[y][x] = false;
    } else {
      decor[y][x] = 'building_wall';
    }
  }
}

// 4. City Buildings (Left & Right districts)
// House West (y: 10..13, x: 5..9)
for (let y = 10; y <= 13; y++) {
  for (let x = 5; x <= 9; x++) {
    collision[y][x] = true;
    if (y === 10) decor[y][x] = 'roof';
    else if (y === 13 && x === 7) {
      decor[y][x] = 'door';
      collision[y][x] = false;
    } else {
      decor[y][x] = 'building_wall';
    }
  }
}

// Shop East (y: 10..13, x: 26..30)
for (let y = 10; y <= 13; y++) {
  for (let x = 26; x <= 30; x++) {
    collision[y][x] = true;
    if (y === 10) decor[y][x] = 'roof';
    else if (y === 13 && x === 28) {
      decor[y][x] = 'door';
      collision[y][x] = false;
    } else {
      decor[y][x] = 'building_wall';
    }
  }
}

// 5. Central Plaza Fountain (y: 16..18, x: 16..19)
for (let y = 16; y <= 18; y++) {
  for (let x = 16; x <= 19; x++) {
    ground[y][x] = 'water';
    collision[y][x] = true;
  }
}

export const CIUDAD_GIMNASIO_MAP: MapData = {
  id: 'ciudad_gimnasio',
  name: 'Ciudad Cumbre',
  category: 'town',
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  signs: [
    {
      x: 20,
      y: 14,
      text: '🏙 CIUDAD CUMBRE\n"La metrópolis en la base de la cordillera sagrada."',
    },
    {
      x: 15,
      y: 8,
      text: '⚔️ GIMNASIO DE CIUDAD CUMBRE\nLíder Ciro — Maestro de las Alturas.',
    },
    {
      x: 15,
      y: 1,
      text: '⬆ PASO DE MONTAÑA\nRuta hacia las cumbres heladas y el Alto Mando.',
    },
  ],
  warps: [
    // South connection to Ruta Claro
    {
      x: 17,
      y: 27,
      targetMapId: 'ruta_claro',
      targetX: 20,
      targetY: 1,
      targetDirection: 'down',
    },
    {
      x: 18,
      y: 27,
      targetMapId: 'ruta_claro',
      targetX: 21,
      targetY: 1,
      targetDirection: 'down',
    },
    // North connection to Ruta Montaña
    {
      x: 17,
      y: 0,
      targetMapId: 'ruta_montana',
      targetX: 19,
      targetY: 26,
      targetDirection: 'up',
    },
    {
      x: 18,
      y: 0,
      targetMapId: 'ruta_montana',
      targetX: 20,
      targetY: 26,
      targetDirection: 'up',
    },
  ],
  triggers: [],
  npcs: [
    {
      id: 'npc_leader_ciro',
      name: 'Líder Ciro',
      paletteId: 'professor',
      x: 17,
      y: 9,
      direction: 'down',
      dialogueLines: [
        '¡Bienvenido al Gimnasio Cumbre!',
        'Las corrientes aéreas de esta cordillera exigen agilidad y determinación indomable.',
      ],
      isTrainer: true,
      trainerData: {
        trainerClass: 'Líder de Gimnasio',
        creatureSpeciesId: 'halconalbor',
        creatureLevel: 28,
      },
    },
    {
      id: 'npc_guard_mountain',
      name: 'Guardia del Paso',
      paletteId: 'hiker',
      x: 16,
      y: 1,
      direction: 'right',
      dialogueLines: [
        'Más allá de esta puerta yacen las nieves perpetuas y el santuario del Alto Mando.',
        'Solo quienes portan la Medalla Cúspide tienen permiso para cruzar el ventisquero.',
      ],
    },
    {
      id: 'npc_citizen_vera',
      name: 'Ciudadana Vera',
      paletteId: 'lass',
      x: 23,
      y: 15,
      direction: 'left',
      dialogueLines: [
        'Dicen que en la cima más alta de la montaña habita una criatura mítica de luz polar...',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 17, y: 25, direction: 'up' },
    from_south: { x: 17, y: 25, direction: 'up' },
    from_north: { x: 17, y: 2, direction: 'down' },
  },
  ambientMusic: 'town',
  sunlightColor: 0xffffff,
  skyColor: 0x93c5fd,
};
