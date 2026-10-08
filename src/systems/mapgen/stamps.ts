/**
 * BLOQUE 47 (Paso 1.2): Biblioteca de prefabs (Stamps) en /systems/mapgen/stamps.ts
 * Cumple invariantes:
 * - I-03 (/systems puro): sin DOM, Three ni Pixi.
 * - Máscara por filas ('#' bloqueado, '.' transitable, 'D' puerta) y casilla de aproximación frente a la puerta.
 * - Rotación horaria en pasos de 90° (0 -> sur, 90 -> oeste, 180 -> norte, 270 -> este).
 */

import { StampRotation } from './schema';

export type StampServiceType = 'workshop' | 'market' | 'lab' | 'house' | 'cave';
export type StampMaskChar = '#' | '.' | 'D';

export interface StampPrefabDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  mask: string[];
  service?: StampServiceType;
  countsAsFocus: boolean;
  canOverlapBorder?: boolean;
}

export interface RotatedStampPlacement {
  prefab: StampPrefabDefinition;
  width: number;
  height: number;
  grid: StampMaskChar[][];
  doorCell: { x: number; y: number } | null;
  approachCell: { x: number; y: number; directionToEnter: 'up' | 'down' | 'left' | 'right' } | null;
}

export const STAMP_LIBRARY: Record<string, StampPrefabDefinition> = {
  house_small: {
    id: 'house_small',
    name: 'Casa Pequeña (5×4)',
    width: 5,
    height: 4,
    mask: [
      '#####',
      '#####',
      '#####',
      '##D##',
    ],
    service: 'house',
    countsAsFocus: true,
  },
  house_medium: {
    id: 'house_medium',
    name: 'Casa Mediana (6×5)',
    width: 6,
    height: 5,
    mask: [
      '######',
      '######',
      '######',
      '######',
      '###D##',
    ],
    service: 'house',
    countsAsFocus: true,
  },
  workshop: {
    id: 'workshop',
    name: 'Taller de Artífices (7×5)',
    width: 7,
    height: 5,
    mask: [
      '#######',
      '#######',
      '#######',
      '#######',
      '###D###',
    ],
    service: 'workshop',
    countsAsFocus: true,
  },
  market: {
    id: 'market',
    name: 'Mercado de Artífices (8×5)',
    width: 8,
    height: 5,
    mask: [
      '########',
      '########',
      '########',
      '########',
      '####D###',
    ],
    service: 'market',
    countsAsFocus: true,
  },
  lab: {
    id: 'lab',
    name: 'Laboratorio del Maestro Artífice (8×6)',
    width: 8,
    height: 6,
    mask: [
      '########',
      '########',
      '########',
      '########',
      '########',
      '####D###',
    ],
    service: 'lab',
    countsAsFocus: true,
  },
  cave_entrance: {
    id: 'cave_entrance',
    name: 'Entrada de Cueva (5×3)',
    width: 5,
    height: 3,
    mask: [
      '#####',
      '#####',
      '##D##',
    ],
    service: 'cave',
    countsAsFocus: true,
    canOverlapBorder: true,
  },
  fountain_plaza: {
    id: 'fountain_plaza',
    name: 'Plaza con Fuente (7×7)',
    width: 7,
    height: 7,
    mask: [
      '.......',
      '.......',
      '..###..',
      '..###..',
      '..###..',
      '.......',
      '.......',
    ],
    countsAsFocus: true,
  },
  well: {
    id: 'well',
    name: 'Pozo de Piedra (2×2)',
    width: 2,
    height: 2,
    mask: [
      '##',
      '##',
    ],
    countsAsFocus: false,
  },
  statue: {
    id: 'statue',
    name: 'Estatua (1×1)',
    width: 1,
    height: 1,
    mask: ['#'],
    countsAsFocus: false,
  },
  garden_plot: {
    id: 'garden_plot',
    name: 'Huerto (4×3)',
    width: 4,
    height: 3,
    mask: [
      '....',
      '....',
      '....',
    ],
    countsAsFocus: false,
  },
  bridge: {
    id: 'bridge',
    name: 'Puente (5×3)',
    width: 5,
    height: 3,
    mask: [
      '#####',
      '.....',
      '#####',
    ],
    countsAsFocus: false,
  },
  stone_gate: {
    id: 'stone_gate',
    name: 'Portón de Piedra (5×2)',
    width: 5,
    height: 2,
    mask: [
      '#...#',
      '#...#',
    ],
    countsAsFocus: true,
    canOverlapBorder: true,
  },
};

export function getStampPrefab(stampId: string): StampPrefabDefinition | undefined {
  return STAMP_LIBRARY[stampId];
}

/**
 * Rota la cuadrícula de máscara de un stamp en pasos horarios de 90° (0, 90, 180, 270)
 * y calcula la posición absoluta en el mapa de su puerta ('D') y su casilla de aproximación:
 * - rot 0°: puerta mira al sur (+y), aproximación en (doorX, doorY + 1)
 * - rot 90°: puerta mira al oeste (-x), aproximación en (doorX - 1, doorY)
 * - rot 180°: puerta mira al norte (-y), aproximación en (doorX, doorY - 1)
 * - rot 270°: puerta mira al este (+x), aproximación en (doorX + 1, doorY)
 */
export function resolveRotatedStamp(
  stampId: string,
  originX: number,
  originY: number,
  rot: StampRotation
): RotatedStampPlacement | null {
  const prefab = getStampPrefab(stampId);
  if (!prefab) return null;

  const baseW = prefab.width;
  const baseH = prefab.height;
  const baseGrid: StampMaskChar[][] = prefab.mask.map((row) =>
    row.split('').map((ch) => (ch === '#' || ch === 'D' ? ch : '.'))
  );

  let rotGrid: StampMaskChar[][];
  let outW = baseW;
  let outH = baseH;

  if (rot === 0) {
    rotGrid = baseGrid;
  } else if (rot === 90) {
    // 90° clockwise: (x, y) -> (baseH - 1 - y, x)
    outW = baseH;
    outH = baseW;
    rotGrid = Array.from({ length: outH }, (_, ry) =>
      Array.from({ length: outW }, (__, rx) => baseGrid[baseH - 1 - rx][ry])
    );
  } else if (rot === 180) {
    // 180°: (x, y) -> (baseW - 1 - x, baseH - 1 - y)
    rotGrid = Array.from({ length: outH }, (_, ry) =>
      Array.from({ length: outW }, (__, rx) => baseGrid[baseH - 1 - ry][baseW - 1 - rx])
    );
  } else {
    // 270° clockwise: (x, y) -> (y, baseW - 1 - x)
    outW = baseH;
    outH = baseW;
    rotGrid = Array.from({ length: outH }, (_, ry) =>
      Array.from({ length: outW }, (__, rx) => baseGrid[rx][baseW - 1 - ry])
    );
  }

  let doorCell: { x: number; y: number } | null = null;
  for (let ry = 0; ry < outH; ry++) {
    for (let rx = 0; rx < outW; rx++) {
      if (rotGrid[ry][rx] === 'D') {
        doorCell = { x: originX + rx, y: originY + ry };
        break;
      }
    }
    if (doorCell) break;
  }

  let approachCell: { x: number; y: number; directionToEnter: 'up' | 'down' | 'left' | 'right' } | null = null;
  if (doorCell) {
    if (rot === 0) {
      // Door faces South -> approach is 1 tile South, player walks UP to enter
      approachCell = { x: doorCell.x, y: doorCell.y + 1, directionToEnter: 'up' };
    } else if (rot === 90) {
      // Door faces West -> approach is 1 tile West, player walks RIGHT to enter
      approachCell = { x: doorCell.x - 1, y: doorCell.y, directionToEnter: 'right' };
    } else if (rot === 180) {
      // Door faces North -> approach is 1 tile North, player walks DOWN to enter
      approachCell = { x: doorCell.x, y: doorCell.y - 1, directionToEnter: 'down' };
    } else {
      // rot === 270: Door faces East -> approach is 1 tile East, player walks LEFT to enter
      approachCell = { x: doorCell.x + 1, y: doorCell.y, directionToEnter: 'left' };
    }
  }

  return {
    prefab,
    width: outW,
    height: outH,
    grid: rotGrid,
    doorCell,
    approachCell,
  };
}
