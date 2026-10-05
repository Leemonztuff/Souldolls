/**
 * BLOQUE 44 Req. 3: Tabla estándar de máscara de vecinos para Autotiles (formato RPG Maker A1/A2 y A3/A4).
 * Módulo 100% puro, determinista y sin dependencias de render ni DOM.
 *
 * En runtime NO se compone ningún autotile por cuartos: el horneado offline (/tools/bake-tilesets.mjs)
 * precalcula las 47 variantes de forma de suelo (A1/A2) y las 16 variantes de muros/fachadas (A3/A4)
 * en un atlas horneado con extrusión de 1 px.
 * Este módulo traduce los 8 vecinos booleanos (N, NE, E, SE, S, SW, W, NW) al índice de variante [0..46]
 * (o [0..15] para muros A3/A4) y expone las tablas de sub-cuartos (2x2) para que tanto el horneador offline
 * como las pruebas unitarias verifiquen las 47 formas canónicas.
 */

export interface Neighbor8Flags {
  n: boolean;
  ne: boolean;
  e: boolean;
  se: boolean;
  s: boolean;
  sw: boolean;
  w: boolean;
  nw: boolean;
}

export interface Neighbor4Flags {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

/**
 * Bits de máscara de 8 vecinos:
 * N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128
 */
export const NEIGHBOR_BIT = {
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128,
} as const;

/**
 * Normaliza una máscara de 8 bits (0..255) aplicando la regla de esquinas diagonales:
 * una esquina diagonal (NE, SE, SW, NW) solo influye si AMBOS vecinos ortogonales adyacentes están presentes.
 * El resultado pertenece al conjunto exacto de 47 máscaras canónicas de blob/RPG Maker A1-A2.
 */
export function normalizeAutotileMask8(rawMask: number): number {
  const n = (rawMask & NEIGHBOR_BIT.N) !== 0;
  const e = (rawMask & NEIGHBOR_BIT.E) !== 0;
  const s = (rawMask & NEIGHBOR_BIT.S) !== 0;
  const w = (rawMask & NEIGHBOR_BIT.W) !== 0;

  let canonical = 0;
  if (n) canonical |= NEIGHBOR_BIT.N;
  if (e) canonical |= NEIGHBOR_BIT.E;
  if (s) canonical |= NEIGHBOR_BIT.S;
  if (w) canonical |= NEIGHBOR_BIT.W;

  if (n && e && (rawMask & NEIGHBOR_BIT.NE) !== 0) canonical |= NEIGHBOR_BIT.NE;
  if (s && e && (rawMask & NEIGHBOR_BIT.SE) !== 0) canonical |= NEIGHBOR_BIT.SE;
  if (s && w && (rawMask & NEIGHBOR_BIT.SW) !== 0) canonical |= NEIGHBOR_BIT.SW;
  if (n && w && (rawMask & NEIGHBOR_BIT.NW) !== 0) canonical |= NEIGHBOR_BIT.NW;

  return canonical;
}

/**
 * Construye la máscara normalizada a partir de un objeto de 8 vecinos booleanos.
 */
export function computeCanonicalMask8(neighbors: Neighbor8Flags): number {
  let raw = 0;
  if (neighbors.n) raw |= NEIGHBOR_BIT.N;
  if (neighbors.ne) raw |= NEIGHBOR_BIT.NE;
  if (neighbors.e) raw |= NEIGHBOR_BIT.E;
  if (neighbors.se) raw |= NEIGHBOR_BIT.SE;
  if (neighbors.s) raw |= NEIGHBOR_BIT.S;
  if (neighbors.sw) raw |= NEIGHBOR_BIT.SW;
  if (neighbors.w) raw |= NEIGHBOR_BIT.W;
  if (neighbors.nw) raw |= NEIGHBOR_BIT.NW;
  return normalizeAutotileMask8(raw);
}

/**
 * Las 47 máscaras canónicas ordenadas de manera determinista (0 = interior rodeado por los 8 lados,
 * 46 = isla aislada sin ningún vecino del mismo tipo).
 * Cumple la convención RPG Maker donde shape 0 es el centro completo y shape 46 es la isla.
 */
export const CANONICAL_47_MASKS: readonly number[] = (() => {
  const set = new Set<number>();
  for (let m = 0; m < 256; m++) {
    set.add(normalizeAutotileMask8(m));
  }
  // Sort descending by popcount then value so mask 255 (full interior) is index 0 and mask 0 (island) is index 46
  return Array.from(set).sort((a, b) => {
    if (a === 255) return -1;
    if (b === 255) return 1;
    if (a === 0) return 1;
    if (b === 0) return -1;
    return b - a;
  });
})();

const MASK_TO_SHAPE_INDEX: Map<number, number> = new Map(
  CANONICAL_47_MASKS.map((mask, idx) => [mask, idx])
);

/**
 * Devuelve el índice de variante precalculada [0..46] para suelos/agua (A1/A2) a partir de la máscara de vecinos.
 */
export function getAutotileShape47(rawMask: number): number {
  const canonical = normalizeAutotileMask8(rawMask);
  return MASK_TO_SHAPE_INDEX.get(canonical) ?? 46;
}

/**
 * Devuelve el índice de variante precalculada [0..46] evaluando una cuadrícula 2D en (x, y).
 * Los bordes fuera del mapa se consideran conectados al mismo tile para evitar costuras artificiales en el perímetro.
 */
export function resolveGridAutotileShape47<T>(
  grid: T[][],
  x: number,
  y: number,
  isSameGroup?: (center: T, neighbor: T) => boolean
): number {
  const h = grid.length;
  const w = h > 0 ? grid[0].length : 0;
  const center = grid[y]?.[x];
  const match = (nx: number, ny: number): boolean => {
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
    const nb = grid[ny][nx];
    return isSameGroup ? isSameGroup(center, nb) : nb === center;
  };

  const rawMask =
    (match(x, y - 1) ? NEIGHBOR_BIT.N : 0) |
    (match(x + 1, y - 1) ? NEIGHBOR_BIT.NE : 0) |
    (match(x + 1, y) ? NEIGHBOR_BIT.E : 0) |
    (match(x + 1, y + 1) ? NEIGHBOR_BIT.SE : 0) |
    (match(x, y + 1) ? NEIGHBOR_BIT.S : 0) |
    (match(x - 1, y + 1) ? NEIGHBOR_BIT.SW : 0) |
    (match(x - 1, y) ? NEIGHBOR_BIT.W : 0) |
    (match(x - 1, y - 1) ? NEIGHBOR_BIT.NW : 0);

  return getAutotileShape47(rawMask);
}

/**
 * Devuelve el índice de variante [0..15] para muros y fachadas (A3/A4) usando los 4 vecinos ortogonales (N, E, S, W).
 * Bits: N=1, E=2, S=4, W=8.
 * - 15 (todos conectados) -> variante 0 (centro de muro)
 * - 0 (aislado) -> variante 15
 */
export function getWallAutotileShape16(neighbors: Neighbor4Flags): number {
  let mask4 = 0;
  if (neighbors.n) mask4 |= 1;
  if (neighbors.e) mask4 |= 2;
  if (neighbors.s) mask4 |= 4;
  if (neighbors.w) mask4 |= 8;
  return 15 - mask4;
}

export function resolveGridWallShape16<T>(
  grid: T[][],
  x: number,
  y: number,
  isSameGroup?: (center: T, neighbor: T) => boolean
): number {
  const h = grid.length;
  const w = h > 0 ? grid[0].length : 0;
  const center = grid[y]?.[x];
  const match = (nx: number, ny: number): boolean => {
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
    const nb = grid[ny][nx];
    return isSameGroup ? isSameGroup(center, nb) : nb === center;
  };

  return getWallAutotileShape16({
    n: match(x, y - 1),
    e: match(x + 1, y),
    s: match(x, y + 1),
    w: match(x - 1, y),
  });
}

/**
 * Sub-cuarto de un bloque autotile RPG Maker A1/A2 (de 2x3 tiles = 4x6 subtiles de tamaño TILE_PX/2).
 * Coordenadas (qx, qy) en unidades de medio tile (0..3 en X, 0..5 en Y) dentro del bloque fuente:
 * - Fila 0..1 (y=0..1): bloque de vista previa e inner corners (en qx=2..3, qy=0..1)
 * - Filas 2..5 (y=2..5): matriz 4x4 de bordes exteriores, esquinas exteriores e interior.
 */
export type QuarterCoord = readonly [number, number];

export interface AutotileQuarterBlueprint {
  tl: QuarterCoord;
  tr: QuarterCoord;
  bl: QuarterCoord;
  br: QuarterCoord;
}

/**
 * Calcula qué cuarto de tile (qx, qy en la rejilla 4x6 de un autotile A1/A2 de RPG Maker)
 * corresponde a cada una de las 4 esquinas (TL, TR, BL, BR) para una máscara canónica dada.
 * Usado por /tools/bake-tilesets.mjs para componer las 47 variantes una sola vez offline.
 */
export function getFloorAutotileQuarters(shapeIndex: number): AutotileQuarterBlueprint {
  const mask = CANONICAL_47_MASKS[Math.max(0, Math.min(46, shapeIndex))] ?? 0;
  const n = (mask & NEIGHBOR_BIT.N) !== 0;
  const ne = (mask & NEIGHBOR_BIT.NE) !== 0;
  const e = (mask & NEIGHBOR_BIT.E) !== 0;
  const se = (mask & NEIGHBOR_BIT.SE) !== 0;
  const s = (mask & NEIGHBOR_BIT.S) !== 0;
  const sw = (mask & NEIGHBOR_BIT.SW) !== 0;
  const w = (mask & NEIGHBOR_BIT.W) !== 0;
  const nw = (mask & NEIGHBOR_BIT.NW) !== 0;

  // Top-Left quarter (depende de W, N, NW)
  let tl: QuarterCoord;
  if (!n && !w) {
    tl = [0, 2]; // Esquina exterior TL
  } else if (!n && w) {
    tl = [2, 2]; // Borde superior horizontal
  } else if (n && !w) {
    tl = [0, 4]; // Borde izquierdo vertical
  } else if (!nw) {
    tl = [2, 0]; // Esquina interior TL
  } else {
    tl = [2, 4]; // Interior lleno TL
  }

  // Top-Right quarter (depende de E, N, NE)
  let tr: QuarterCoord;
  if (!n && !e) {
    tr = [3, 2]; // Esquina exterior TR
  } else if (!n && e) {
    tr = [1, 2]; // Borde superior horizontal
  } else if (n && !e) {
    tr = [3, 4]; // Borde derecho vertical
  } else if (!ne) {
    tr = [3, 0]; // Esquina interior TR
  } else {
    tr = [1, 4]; // Interior lleno TR
  }

  // Bottom-Left quarter (depende de W, S, SW)
  let bl: QuarterCoord;
  if (!s && !w) {
    bl = [0, 5]; // Esquina exterior BL
  } else if (!s && w) {
    bl = [2, 5]; // Borde inferior horizontal
  } else if (s && !w) {
    bl = [0, 3]; // Borde izquierdo vertical
  } else if (!sw) {
    bl = [2, 1]; // Esquina interior BL
  } else {
    bl = [2, 3]; // Interior lleno BL
  }

  // Bottom-Right quarter (depende de E, S, SE)
  let br: QuarterCoord;
  if (!s && !e) {
    br = [3, 5]; // Esquina exterior BR
  } else if (!s && e) {
    br = [1, 5]; // Borde inferior horizontal
  } else if (s && !e) {
    br = [3, 3]; // Borde derecho vertical
  } else if (!se) {
    br = [3, 1]; // Esquina interior BR
  } else {
    br = [1, 3]; // Interior lleno BR
  }

  return { tl, tr, bl, br };
}

/**
 * Calcula los cuartos (qx, qy en rejilla 4x4 de un bloque A3/A4 de 2x2 tiles)
 * para las 16 formas de muros/fachadas según los 4 vecinos ortogonales.
 */
export function getWallAutotileQuarters(shape16Index: number): AutotileQuarterBlueprint {
  const mask4 = 15 - Math.max(0, Math.min(15, shape16Index));
  const n = (mask4 & 1) !== 0;
  const e = (mask4 & 2) !== 0;
  const s = (mask4 & 4) !== 0;
  const w = (mask4 & 8) !== 0;

  const tlX = w ? 2 : 0;
  const tlY = n ? 2 : 0;

  const trX = e ? 1 : 3;
  const trY = n ? 2 : 0;

  const blX = w ? 2 : 0;
  const blY = s ? 1 : 3;

  const brX = e ? 1 : 3;
  const brY = s ? 1 : 3;

  return {
    tl: [tlX, tlY],
    tr: [trX, trY],
    bl: [blX, blY],
    br: [brX, brY],
  };
}
