/**
 * BLOQUE 47 (Paso 1.3): Horneado determinista de primitivas a cuadrícula (/systems/mapgen/bake.ts)
 * Cumple invariantes:
 * - I-03 (/systems puro): 0 imports de DOM, Three o Pixi; determinista por seed.
 * - Orden de capas estricto:
 *   1. Regiones (borde orgánico con ruido FBM sobre la distancia firmada al polígono)
 *   2. Banda de borde (`thickness` tiles bloqueada, con hueco de 3 tiles en cada landmark "exit" cercano al borde)
 *   3. Caminos (spline Catmull-Rom, ancho main 3 / secondary 2 / trail 1, mayor rango gana)
 *   4. Parches (lagos primero; los demás no pisan caminos ni agua; borde orgánico por ruido angular)
 *   5. Stamps (sobrescriben todo; registran solapes, salidas del mapa y bordes)
 */

import {
  BiomeId,
  MapGenPath,
  MapGenPatch,
  MapGenRegion,
  MapGenStampInstance,
  MapSourceSchemaV1,
  PathRank,
} from './schema';
import { resolveRotatedStamp, RotatedStampPlacement } from './stamps';

export type BakedCellType =
  | 'void'
  | 'ground'
  | 'path_main'
  | 'path_secondary'
  | 'path_trail'
  | 'water'
  | 'tall_grass'
  | 'flowers'
  | 'clearing'
  | 'garden'
  | 'border'
  | 'stamp_block'
  | 'stamp_walk'
  | 'door';

export interface StampBakeIssueRecord {
  instanceId: string;
  stampId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outOfBounds: boolean;
  touchesBorder: boolean;
  overlapsWith: string[];
  doorCell: { x: number; y: number } | null;
  approachCell: { x: number; y: number; directionToEnter: 'up' | 'down' | 'left' | 'right' } | null;
  placement: RotatedStampPlacement;
}

export interface PatchBakeRecord {
  id: string;
  type: MapGenPatch['type'];
  center: [number, number];
  cells: [number, number][];
}

export interface BakedMapGrid {
  width: number;
  height: number;
  seed: number;
  cells: BakedCellType[][];
  biomes: BiomeId[][];
  pathSurfaces: (MapGenPath['surface'] | null)[][];
  walkable: boolean[][];
  stampOwner: (string | null)[][];
  stampRecords: StampBakeIssueRecord[];
  patchRecords: PatchBakeRecord[];
  exitGapCells: Set<string>;
  hash: string;
}

// ============================================================================
// DETERMINISTIC NOISE & GEOMETRY HELPERS (Pure Math)
// ============================================================================

export function hash2D(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = hash2D(xi, yi, seed);
  const n10 = hash2D(xi + 1, yi, seed);
  const n01 = hash2D(xi, yi + 1, seed);
  const n11 = hash2D(xi + 1, yi + 1, seed);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

/**
 * Ruido FBM (Fractional Brownian Motion) de 3 octavas en [-1, 1]
 */
export function fbm2D(x: number, y: number, seed: number, octaves = 3): number {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += (valueNoise2D(x * frequency, y * frequency, seed + i * 1013) * 2 - 1) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return maxValue > 0 ? total / maxValue : 0;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInPolygon(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Distancia firmada al polígono: positiva dentro, negativa fuera.
 */
function signedDistanceToPolygon(px: number, py: number, pts: [number, number][]): number {
  if (pts.length < 3) return -999;
  let minDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const d = distToSegment(px, py, x1, y1, x2, y2);
    if (d < minDist) minDist = d;
  }
  const inside = pointInPolygon(px, py, pts);
  return inside ? minDist : -minDist;
}

/**
 * Interpolación spline Catmull-Rom uniforme entre una lista de puntos de control.
 */
export function sampleCatmullRomSpline(points: [number, number][], samplesPerSegment = 16): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];
  if (points.length === 2) {
    const out: [number, number][] = [];
    const [x0, y0] = points[0];
    const [x1, y1] = points[1];
    const steps = Math.max(samplesPerSegment, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    return out;
  }

  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(samplesPerSegment, Math.ceil(segLen * 3));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      sampled.push([x, y]);
    }
  }
  return sampled;
}

const PATH_RANK_PRIORITY: Record<PathRank, number> = {
  trail: 1,
  secondary: 2,
  main: 3,
};

const PATH_RANK_CELL: Record<PathRank, BakedCellType> = {
  trail: 'path_trail',
  secondary: 'path_secondary',
  main: 'path_main',
};

const PATH_RANK_WIDTH: Record<PathRank, number> = {
  trail: 1,
  secondary: 2,
  main: 3,
};

const WALKABLE_CELL_TYPES = new Set<BakedCellType>([
  'ground',
  'path_main',
  'path_secondary',
  'path_trail',
  'tall_grass',
  'flowers',
  'clearing',
  'garden',
  'stamp_walk',
  'door',
]);

export function isCellTypeWalkable(cell: BakedCellType): boolean {
  return WALKABLE_CELL_TYPES.has(cell);
}

/**
 * Calcula un hash FNV-1a hexadecimal determinista de la cuadrícula horneada.
 */
function computeGridHash(cells: BakedCellType[][], biomes: BiomeId[][], walkable: boolean[][]): string {
  let h = 0x811c9dc5;
  const feed = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };

  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      feed(`${cells[y][x]}:${biomes[y][x]}:${walkable[y][x] ? 1 : 0};`);
    }
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Hornea un documento MapSourceSchemaV1 en una cuadrícula BakedMapGrid determinista.
 */
export function bakeMap(source: MapSourceSchemaV1): BakedMapGrid {
  const W = Math.max(1, Math.floor(source.meta.width));
  const H = Math.max(1, Math.floor(source.meta.height));
  const seed = source.meta.seed >>> 0;

  // Inicializar celdas en 'void' hasta que una región las cubra (o si no hay regiones, cubrir interior con ground si se desea,
  // pero en B45/B47 las regiones definen las zonas transitables sobre el lienzo).
  const cells: BakedCellType[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => 'void' as BakedCellType)
  );
  const biomes: BiomeId[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => source.meta.defaultBiome)
  );
  const stampOwner: (string | null)[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => null)
  );

  // ==========================================================================
  // CAPA 1: REGIONES (Borde orgánico con ruido FBM sobre distancia al polígono)
  // ==========================================================================
  for (let rIdx = 0; rIdx < (source.regions || []).length; rIdx++) {
    const reg: MapGenRegion = source.regions[rIdx];
    if (!reg.points || reg.points.length < 3) continue;

    const regSeed = (seed + (rIdx + 1) * 7919) >>> 0;
    const scale = reg.noiseScale > 0 ? reg.noiseScale : 0.18;
    const amp = reg.edgeNoise ?? 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sd = signedDistanceToPolygon(x + 0.5, y + 0.5, reg.points);
        const n = amp > 0 ? fbm2D((x + 0.5) * scale, (y + 0.5) * scale, regSeed, 3) * amp : 0;
        if (sd + n >= 0) {
          cells[y][x] = 'ground';
          biomes[y][x] = reg.biome || source.meta.defaultBiome;
        }
      }
    }
  }

  // ==========================================================================
  // CAPA 2: BANDA DE BORDE (`thickness` tiles bloqueada, con hueco de 3 tiles
  //         en cada landmark "exit" cercano al borde)
  // ==========================================================================
  const thickness = Math.max(0, Math.floor(source.border?.thickness ?? 0));
  const exitGapCells = new Set<string>();

  if (thickness > 0) {
    // Detectar qué celdas del cinturón perimetral pertenecen a un hueco de 3 tiles de un landmark "exit" cercano al borde
    const exitThreshold = Math.max(thickness + 2, 4);
    for (const lm of source.landmarks || []) {
      if (lm.role !== 'exit') continue;

      const distNorth = lm.y;
      const distSouth = H - 1 - lm.y;
      const distWest = lm.x;
      const distEast = W - 1 - lm.x;
      const minDist = Math.min(distNorth, distSouth, distWest, distEast);

      if (minDist <= exitThreshold) {
        if (minDist === distNorth) {
          for (let gy = 0; gy <= Math.max(thickness, lm.y); gy++) {
            for (let gx = lm.x - 1; gx <= lm.x + 1; gx++) {
              if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
                exitGapCells.add(`${gx},${gy}`);
              }
            }
          }
        } else if (minDist === distSouth) {
          for (let gy = Math.min(H - thickness, lm.y); gy < H; gy++) {
            for (let gx = lm.x - 1; gx <= lm.x + 1; gx++) {
              if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
                exitGapCells.add(`${gx},${gy}`);
              }
            }
          }
        } else if (minDist === distWest) {
          for (let gx = 0; gx <= Math.max(thickness, lm.x); gx++) {
            for (let gy = lm.y - 1; gy <= lm.y + 1; gy++) {
              if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
                exitGapCells.add(`${gx},${gy}`);
              }
            }
          }
        } else {
          for (let gx = Math.min(W - thickness, lm.x); gx < W; gx++) {
            for (let gy = lm.y - 1; gy <= lm.y + 1; gy++) {
              if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
                exitGapCells.add(`${gx},${gy}`);
              }
            }
          }
        }
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inBorderBand = x < thickness || x >= W - thickness || y < thickness || y >= H - thickness;
        if (inBorderBand) {
          if (exitGapCells.has(`${x},${y}`)) {
            if (cells[y][x] === 'void') {
              cells[y][x] = 'ground';
            }
          } else {
            cells[y][x] = 'border';
          }
        }
      }
    }
  }

  // ==========================================================================
  // CAPA 3: CAMINOS (Spline Catmull-Rom, ancho main 3 / secondary 2 / trail 1, mayor rango gana)
  // ==========================================================================
  const pathPriorityGrid: number[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => 0)
  );
  const pathSurfaces: (MapGenPath['surface'] | null)[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => null)
  );

  for (let pIdx = 0; pIdx < (source.paths || []).length; pIdx++) {
    const path: MapGenPath = source.paths[pIdx];
    if (!path.points || path.points.length < 2) continue;

    const rank: PathRank = path.rank || 'main';
    const rankPrio = PATH_RANK_PRIORITY[rank] || 1;
    const cellType = PATH_RANK_CELL[rank] || 'path_main';
    const baseWidth = PATH_RANK_WIDTH[rank] || 2;
    const jitterAmp = path.widthJitter ?? 0;
    const pathSeed = (seed + 3001 + pIdx * 409) >>> 0;

    const splinePts = sampleCatmullRomSpline(path.points, 16);

    for (let sIdx = 0; sIdx < splinePts.length; sIdx++) {
      const [sx, sy] = splinePts[sIdx];
      const jitter =
        jitterAmp > 0 ? (valueNoise2D(sx * 0.4, sy * 0.4, pathSeed) - 0.5) * jitterAmp : 0;
      const effectiveW = Math.max(rank === 'main' ? 2 : 1, Math.round(baseWidth + jitter));

      const startOff = -Math.floor((effectiveW - 1) / 2);
      const endOff = startOff + effectiveW - 1;
      const cx = Math.round(sx);
      const cy = Math.round(sy);

      for (let dy = startOff; dy <= endOff; dy++) {
        for (let dx = startOff; dx <= endOff; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          // Paths do not overwrite closed border unless it's an exit gap
          if (cells[ty][tx] === 'border' && !exitGapCells.has(`${tx},${ty}`)) continue;

          if (rankPrio >= pathPriorityGrid[ty][tx]) {
            pathPriorityGrid[ty][tx] = rankPrio;
            cells[ty][tx] = cellType;
            pathSurfaces[ty][tx] = path.surface || (rank === 'main' ? 'cobble' : 'path');
          }
        }
      }
    }
  }

  // ==========================================================================
  // CAPA 4: PARCHES (Lagos primero; los demás no pisan caminos ni agua;
  //         borde orgánico por ruido angular)
  // ==========================================================================
  const patches = [...(source.patches || [])];
  // Ordenar: lagos ('lake') primero, luego el resto manteniendo orden relativo
  patches.sort((a, b) => {
    const aLake = a.type === 'lake' ? 0 : 1;
    const bLake = b.type === 'lake' ? 0 : 1;
    return aLake - bLake;
  });

  const patchRecords: PatchBakeRecord[] = [];

  for (let idx = 0; idx < patches.length; idx++) {
    const patch = patches[idx];
    const [cx, cy] = patch.center;
    const radius = Math.max(0.5, patch.radius);
    const aspect = Math.max(0.25, patch.aspect || 1.0);
    const rotRad = ((patch.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(-rotRad);
    const sinR = Math.sin(-rotRad);
    const noiseAmp = patch.noise ?? 0.25;
    const patchSeed = (seed + 7001 + idx * 613) >>> 0;

    const rx = radius * aspect;
    const ry = radius;
    const boundR = Math.ceil(Math.max(rx, ry) * (1 + noiseAmp) + 2);

    const candidateCells: [number, number][] = [];

    for (let y = Math.max(0, Math.floor(cy - boundR)); y <= Math.min(H - 1, Math.ceil(cy + boundR)); y++) {
      for (let x = Math.max(0, Math.floor(cx - boundR)); x <= Math.min(W - 1, Math.ceil(cx + boundR)); x++) {
        if (cells[y][x] === 'border' || cells[y][x] === 'void') continue;

        const curCell = cells[y][x];
        const isPath =
          curCell === 'path_main' || curCell === 'path_secondary' || curCell === 'path_trail';

        if (patch.type !== 'lake') {
          // Non-lake patches never overwrite paths or water
          if (isPath || curCell === 'water') continue;
        }

        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const lx = dx * cosR - dy * sinR;
        const ly = dx * sinR + dy * cosR;

        const angle = Math.atan2(ly, lx);
        // Angular organic noise around circumference + spatial variation
        const angularNoise =
          fbm2D(
            Math.cos(angle) * 1.7 + (x + 0.5) * 0.22,
            Math.sin(angle) * 1.7 + (y + 0.5) * 0.22,
            patchSeed,
            3
          ) * noiseAmp;

        const normDist = Math.hypot(lx / rx, ly / ry) + angularNoise;
        if (normDist <= 1.0) {
          candidateCells.push([x, y]);
        }
      }
    }

    // Si tiene ruido > 0 y por casualidad llenó el 100% de su caja delimitadora (>= 9 celdas),
    // recortar las esquinas extremas para garantizar silueta orgánica no rectangular
    let finalCells = candidateCells;
    if (noiseAmp > 0 && candidateCells.length >= 9) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [gx, gy] of candidateCells) {
        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy;
        if (gy > maxY) maxY = gy;
      }
      const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
      if (candidateCells.length / boxArea > 0.88) {
        finalCells = candidateCells.filter(([gx, gy]) => {
          const isCorner = (gx === minX || gx === maxX) && (gy === minY || gy === maxY);
          const isSecondCorner =
            (gx === minX && gy === minY + 1) || (gx === maxX && gy === maxY - 1);
          return !isCorner && !isSecondCorner;
        });
      }
    }

    const targetCellType: BakedCellType =
      patch.type === 'lake'
        ? 'water'
        : patch.type === 'tall_grass'
        ? 'tall_grass'
        : patch.type === 'flowers'
        ? 'flowers'
        : patch.type === 'clearing'
        ? 'clearing'
        : 'garden';

    for (const [gx, gy] of finalCells) {
      cells[gy][gx] = targetCellType;
    }

    patchRecords.push({
      id: patch.id,
      type: patch.type,
      center: patch.center,
      cells: finalCells,
    });
  }

  // ==========================================================================
  // CAPA 5: STAMPS (Sobrescriben todo; registran solapes, salidas del mapa y bordes)
  // ==========================================================================
  const stampRecords: StampBakeIssueRecord[] = [];

  for (const st of source.stamps || []) {
    const resolved = resolveRotatedStamp(st.stampId, st.x, st.y, st.rot || 0);
    if (!resolved) continue;

    let outOfBounds = false;
    let touchesBorder = false;
    const overlapsSet = new Set<string>();

    for (let ry = 0; ry < resolved.height; ry++) {
      for (let rx = 0; rx < resolved.width; rx++) {
        const gx = st.x + rx;
        const gy = st.y + ry;

        if (gx < 0 || gx >= W || gy < 0 || gy >= H) {
          outOfBounds = true;
          continue;
        }

        const existingOwner = stampOwner[gy][gx];
        if (existingOwner && existingOwner !== st.id) {
          overlapsSet.add(existingOwner);
          // Also retroactively add to the other stamp's overlap record
          const prevRec = stampRecords.find((r) => r.instanceId === existingOwner);
          if (prevRec && !prevRec.overlapsWith.includes(st.id)) {
            prevRec.overlapsWith.push(st.id);
          }
        }

        if (cells[gy][gx] === 'border' && !resolved.prefab.canOverlapBorder) {
          touchesBorder = true;
        }

        const maskChar = resolved.grid[ry][rx];
        if (maskChar === '#') {
          cells[gy][gx] = 'stamp_block';
        } else if (maskChar === 'D') {
          cells[gy][gx] = 'door';
        } else {
          // '.' transitable -> en un huerto es 'garden', en el resto 'stamp_walk'
          cells[gy][gx] = st.stampId === 'garden_plot' ? 'garden' : 'stamp_walk';
        }

        stampOwner[gy][gx] = st.id;
      }
    }

    stampRecords.push({
      instanceId: st.id,
      stampId: st.stampId,
      x: st.x,
      y: st.y,
      width: resolved.width,
      height: resolved.height,
      outOfBounds,
      touchesBorder,
      overlapsWith: Array.from(overlapsSet),
      doorCell: resolved.doorCell,
      approachCell: resolved.approachCell,
      placement: resolved,
    });
  }

  // Derivar capa walkable y hash determinista
  const walkable: boolean[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (__, x) => isCellTypeWalkable(cells[y][x]))
  );

  const hash = computeGridHash(cells, biomes, walkable);

  return {
    width: W,
    height: H,
    seed,
    cells,
    biomes,
    pathSurfaces,
    walkable,
    stampOwner,
    stampRecords,
    patchRecords,
    exitGapCells,
    hash,
  };
}
