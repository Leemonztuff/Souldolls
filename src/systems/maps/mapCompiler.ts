import { Direction } from '../../types';
import { TileType } from '../../types/tilesets';
import { MapData, MapNPC, MapSign, MapWarp, EncounterEntry } from '../../types/maps';

export type AuthoringStage =
  | 1 // 1. BLOCKOUT en gris
  | 2 // 2. Caminos e hitos
  | 3 // 3. Edificios y stamps
  | 4 // 4. Terreno y agrupaciones (parches orgánicos)
  | 5 // 5. Decorado (scatter con ruido y agrupaciones 3/5/7)
  | 6; // 6. Iluminación y atmósfera final

export interface MapRegionSpec {
  id: string;
  biome: 'meadow' | 'forest' | 'plaza' | 'lake' | 'beach' | 'cave' | 'mountain';
  shape: 'circle' | 'polygon' | 'rect_noisy';
  center?: [number, number];
  radius?: [number, number];
  points?: Array<[number, number]>;
  bounds?: [number, number, number, number]; // [x0, y0, x1, y1]
  groundTile: TileType;
  noiseAmplitude?: number;
  noiseFrequency?: number;
}

export interface MapPathSpec {
  id: string;
  kind: 'main' | 'secondary' | 'trail';
  width: 1 | 2 | 3;
  tile: TileType;
  waypoints: Array<[number, number]>;
  wobble?: number;
}

export interface MapPatchSpec {
  id: string;
  kind: 'tall_grass' | 'flowers' | 'clearing' | 'lake' | 'sand_bank' | 'cave_floor';
  center: [number, number];
  radiusX: number;
  radiusY: number;
  noise: number;
  minTiles: number;
  groundTile: TileType;
  isEncounter?: boolean;
  isWater?: boolean;
}

export interface MapStampSpec {
  id: string;
  prefab:
    | 'house_small'
    | 'house_medium'
    | 'workshop_landmark'
    | 'market_landmark'
    | 'resonance_lab'
    | 'gym_sanctuary'
    | 'fountain_plaza'
    | 'orchard_garden'
    | 'wooden_bridge'
    | 'cave_sanctuary'
    | 'shortcut_gate';
  x: number;
  y: number;
  width: number;
  height: number;
  doorOffset?: [number, number];
  warp?: MapWarp;
  label?: string;
}

export interface MapBorderGap {
  side: 'north' | 'south' | 'east' | 'west';
  start: number;
  end: number;
}

export interface MapBorderSpec {
  style: 'forest_belt' | 'cliff_belt' | 'coastal_ocean' | 'citadel_wall';
  depth: number;
  primaryDecor: 'tree' | 'rock' | 'wall';
  gaps: MapBorderGap[];
}

export interface MapScatterRuleSpec {
  id: string;
  decorType: 'tree' | 'rock' | 'flowers';
  clusterSizes: Array<3 | 5 | 7>;
  density: number;
  minDistanceToPath: number;
  minDistanceBetweenClusters: number;
  preferNearBorders: boolean;
  allowedGround: TileType[];
}

export interface MapLandmarkSpec {
  id: string;
  name: string;
  role: 'focus' | 'secret' | 'rest' | 'danger';
  x: number;
  y: number;
  radius: number;
  loreProp?: {
    type: 'doll_arm_buried' | 'sparkle_hidden' | 'mana_berry_plant' | 'bones';
    offsetX: number;
    offsetY: number;
    reward?: string;
  };
}

export interface MapAuthoringBlueprint {
  id: string;
  name: string;
  category: MapData['category'];
  seed: number;
  width: number;
  height: number;
  baseGround: TileType;
  skyColor: number;
  sunlightColor: number;
  ambientMusic: string;
  borders: MapBorderSpec;
  regions: MapRegionSpec[];
  paths: MapPathSpec[];
  patches: MapPatchSpec[];
  stamps: MapStampSpec[];
  scatter: MapScatterRuleSpec[];
  landmarks: MapLandmarkSpec[];
  signs: MapSign[];
  warps: MapWarp[];
  npcs: MapNPC[];
  spawnPoints: MapData['spawnPoints'];
  encounterRate?: number;
  encounterTable?: EncounterEntry[];
}

/**
 * Generador determinista con semilla fija (Mulberry32) y ruido 2D suave.
 */
export class MapRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x1337beef;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 0.9999));
  }
}

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
 * Compilador determinista de planos de autoría (`MapAuthoringBlueprint`) a `MapData`
 * con soporte para las 6 etapas obligatorias del Bloque 45:
 * (1) BLOCKOUT en gris -> (2) caminos e hitos -> (3) edificios y stamps ->
 * (4) terreno y agrupaciones -> (5) decorado -> (6) iluminación.
 */
export function compileMapBlueprint(
  bp: MapAuthoringBlueprint,
  upToStage: AuthoringStage = 6
): MapData {
  const W = bp.width;
  const H = bp.height;

  // Stage 1: BLOCKOUT en gris (cave_floor / stone blockout before terrain stage)
  const initialGround: TileType = upToStage >= 4 ? bp.baseGround : 'cave_floor';

  const ground: TileType[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => initialGround)
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

  // Reserved mask for paths, doors, warps, stamps and landmarks so scatter never blocks lanes
  const reservedLane: boolean[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => false)
  );

  const inBounds = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

  const isGap = (side: MapBorderGap['side'], coord: number): boolean => {
    return bp.borders.gaps.some((g) => g.side === side && coord >= g.start && coord <= g.end);
  };

  // --- STAGE 1: ORGANIC PERIMETER BORDER BELT ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const distN = y;
      const distS = H - 1 - y;
      const distW = x;
      const distE = W - 1 - x;

      const nNoise = Math.floor(valueNoise2D(x * 0.35, y * 0.35, bp.seed + 11) * 1.6);
      const beltDepth = Math.max(1, bp.borders.depth + (x === 0 || x === W - 1 || y === 0 || y === H - 1 ? 0 : nNoise - 1));

      let onBorder = false;
      if (distN < beltDepth && !isGap('north', x)) onBorder = true;
      if (distS < beltDepth && !isGap('south', x)) onBorder = true;
      if (distW < beltDepth && !isGap('west', y)) onBorder = true;
      if (distE < beltDepth && !isGap('east', y)) onBorder = true;

      // Coastal ocean special south border
      if (bp.borders.style === 'coastal_ocean' && y >= H - 8) {
        onBorder = false;
      }

      if (onBorder) {
        decor[y][x] = upToStage >= 3 ? bp.borders.primaryDecor : 'wall';
        collision[y][x] = true;
      }
    }
  }

  // Reserve warps & spawn points with safety radius
  for (const w of bp.warps) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = w.x + dx;
        const ny = w.y + dy;
        if (inBounds(nx, ny)) {
          reservedLane[ny][nx] = true;
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            decor[ny][nx] = null;
            collision[ny][nx] = false;
          }
        }
      }
    }
  }

  // --- STAGE 4 (or pre-regions): BIOME REGIONS ---
  if (upToStage >= 4) {
    for (const reg of bp.regions) {
      const amp = reg.noiseAmplitude ?? 0.22;
      const freq = reg.noiseFrequency ?? 0.25;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let inside = false;
          const n = (valueNoise2D(x * freq, y * freq, bp.seed + 31) - 0.5) * 2 * amp;
          if (reg.shape === 'circle' && reg.center && reg.radius) {
            const dx = (x - reg.center[0]) / reg.radius[0];
            const dy = (y - reg.center[1]) / reg.radius[1];
            inside = dx * dx + dy * dy <= 1.0 + n;
          } else if (reg.shape === 'rect_noisy' && reg.bounds) {
            const [x0, y0, x1, y1] = reg.bounds;
            const margin = n * 2.2;
            inside = x >= x0 + margin && x <= x1 - margin && y >= y0 + margin && y <= y1 - margin;
          }
          if (inside) {
            ground[y][x] = reg.groundTile;
            if (reg.groundTile === 'water') {
              decor[y][x] = null;
              collision[y][x] = true;
            }
          }
        }
      }
    }
  }

  // --- STAGE 2: SPLINE PATHS & LANDMARKS ---
  if (upToStage >= 2) {
    for (const path of bp.paths) {
      const pts = path.waypoints;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const dist = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
        const steps = Math.ceil(dist * 3);

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const wobbleOffset =
            path.wobble && s > 2 && s < steps - 2
              ? (valueNoise2D(t * 4, i * 3, bp.seed + 73) - 0.5) * path.wobble
              : 0;
          const cx = Math.round(x0 + (x1 - x0) * t + (y0 === y1 ? 0 : wobbleOffset));
          const cy = Math.round(y0 + (y1 - y0) * t + (x0 === x1 ? 0 : wobbleOffset));

          const halfMin = path.width === 3 ? -1 : path.width === 2 ? 0 : 0;
          const halfMax = path.width === 3 ? 1 : path.width === 2 ? 1 : 0;

          for (let oy = halfMin; oy <= halfMax; oy++) {
            for (let ox = halfMin; ox <= halfMax; ox++) {
              const px = cx + ox;
              const py = cy + oy;
              if (inBounds(px, py)) {
                ground[py][px] = upToStage >= 4 ? path.tile : 'path';
                decor[py][px] = null;
                collision[py][px] = false;
                reservedLane[py][px] = true;
              }
            }
          }

          // Reserve 1-tile buffer around main/secondary paths so scatter never chokes lanes
          for (let by = -1; by <= 2; by++) {
            for (let bx = -1; bx <= 2; bx++) {
              const rx = cx + bx;
              const ry = cy + by;
              if (inBounds(rx, ry)) {
                reservedLane[ry][rx] = true;
              }
            }
          }
        }
      }
    }

    // Reserve landmarks
    for (const lm of bp.landmarks) {
      for (let dy = -lm.radius; dy <= lm.radius; dy++) {
        for (let dx = -lm.radius; dx <= lm.radius; dx++) {
          const lx = lm.x + dx;
          const ly = lm.y + dy;
          if (inBounds(lx, ly) && dx * dx + dy * dy <= lm.radius * lm.radius) {
            reservedLane[ly][lx] = true;
          }
        }
      }
    }
  }

  // --- STAGE 4: ORGANIC PATCHES (TALL GRASS >= 6 TILES, LAKES, CLEARINGS, FLOWERS) ---
  if (upToStage >= 4) {
    for (let pIdx = 0; pIdx < bp.patches.length; pIdx++) {
      const patch = bp.patches[pIdx];
      const [cx, cy] = patch.center;
      const rx = Math.max(1.5, patch.radiusX);
      const ry = Math.max(1.5, patch.radiusY);
      const placedCoords: Array<[number, number]> = [];

      const minY = Math.max(1, Math.floor(cy - ry - 2));
      const maxY = Math.min(H - 2, Math.ceil(cy + ry + 2));
      const minX = Math.max(1, Math.floor(cx - rx - 2));
      const maxX = Math.min(W - 2, Math.ceil(cx + rx + 2));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          // Organic blob equation: ellipse + angular harmonic + 2D value noise (never rectangular!)
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const angle = Math.atan2(ny, nx);
          const harmonic =
            0.14 * Math.sin(angle * 3 + pIdx * 1.7) + 0.09 * Math.cos(angle * 5 - pIdx * 1.1);
          const nVal =
            (valueNoise2D(x * 0.45, y * 0.45, bp.seed + 199 + pIdx * 37) - 0.5) *
            2 *
            patch.noise;
          const distSq = nx * nx + ny * ny;

          if (distSq <= 1.0 + harmonic + nVal) {
            if (patch.isWater) {
              if (!reservedLane[y][x]) {
                ground[y][x] = 'water';
                decor[y][x] = null;
                collision[y][x] = true;
                placedCoords.push([x, y]);
              }
            } else if (patch.isEncounter) {
              // Do not overwrite main paths, water, or solid border walls
              if (ground[y][x] !== 'path' && ground[y][x] !== 'water' && !collision[y][x]) {
                ground[y][x] = 'tall_grass';
                encounters[y][x] = 'tall_grass';
                placedCoords.push([x, y]);
              }
            } else {
              if (ground[y][x] !== 'path' && ground[y][x] !== 'water' && !collision[y][x]) {
                ground[y][x] = patch.groundTile;
                placedCoords.push([x, y]);
              }
            }
          }
        }
      }

      // Guarantee minimum tile count (>= 6 tiles for tall_grass) with organic spiral growth if needed
      if (patch.isEncounter && placedCoords.length < Math.max(6, patch.minTiles)) {
        const spiralOffsets = [
          [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1],
          [1, 1], [-1, 1], [1, -1], [-1, -1],
          [2, 0], [0, 2], [-2, 0], [0, -2], [2, 1], [1, 2],
        ];
        for (const [ox, oy] of spiralOffsets) {
          if (placedCoords.length >= Math.max(6, patch.minTiles)) break;
          const tx = Math.round(cx + ox);
          const ty = Math.round(cy + oy);
          if (
            inBounds(tx, ty) &&
            ground[ty][tx] !== 'path' &&
            ground[ty][tx] !== 'water' &&
            !collision[ty][tx] &&
            encounters[ty][tx] !== 'tall_grass'
          ) {
            ground[ty][tx] = 'tall_grass';
            encounters[ty][tx] = 'tall_grass';
            placedCoords.push([tx, ty]);
          }
        }
      }
    }
  }

  // --- STAGE 3: BUILDINGS & STAMPS (PREFABS WITH ROOF, EAVES, WINDOWS, CHIMNEY, DOOR & WARP) ---
  if (upToStage >= 3) {
    for (const stamp of bp.stamps) {
      const sx = stamp.x;
      const sy = stamp.y;
      const sw = stamp.width;
      const sh = stamp.height;

      if (stamp.prefab === 'fountain_plaza') {
        // Organic circular plaza with central 2x2 water basin (no harsh uniform rectangle)
        const fcx = sx + (sw - 1) / 2;
        const fcy = sy + (sh - 1) / 2;
        const rx = sw / 2;
        const ry = sh / 2;
        for (let y = sy - 1; y <= sy + sh; y++) {
          for (let x = sx - 1; x <= sx + sw; x++) {
            if (!inBounds(x, y)) continue;
            const d = Math.hypot((x - fcx) / rx, (y - fcy) / ry);
            if (d <= 0.48) {
              ground[y][x] = upToStage >= 4 ? 'water' : 'cave_floor';
              decor[y][x] = null;
              collision[y][x] = true;
              reservedLane[y][x] = true;
            } else if (d <= 1.08) {
              ground[y][x] = 'path';
              decor[y][x] = null;
              collision[y][x] = false;
              reservedLane[y][x] = true;
            }
          }
        }
        continue;
      }

      if (stamp.prefab === 'orchard_garden') {
        for (let y = sy; y < sy + sh; y++) {
          for (let x = sx; x < sx + sw; x++) {
            if (!inBounds(x, y)) continue;
            if ((x + y) % 2 === 0) {
              ground[y][x] = upToStage >= 4 ? 'flowers' : 'cave_floor';
            }
            reservedLane[y][x] = true;
          }
        }
        continue;
      }

      if (stamp.prefab === 'wooden_bridge') {
        for (let y = sy; y < sy + sh; y++) {
          for (let x = sx; x < sx + sw; x++) {
            if (!inBounds(x, y)) continue;
            ground[y][x] = 'path';
            decor[y][x] = null;
            collision[y][x] = false;
            reservedLane[y][x] = true;
          }
        }
        continue;
      }

      if (stamp.prefab === 'cave_sanctuary') {
        for (let y = sy; y < sy + sh; y++) {
          for (let x = sx; x < sx + sw; x++) {
            if (!inBounds(x, y)) continue;
            ground[y][x] = 'cave_floor';
            encounters[y][x] = null;
            reservedLane[y][x] = true;
            const isRim = y === sy || y === sy + sh - 1 || x === sx || x === sx + sw - 1;
            const doorX = stamp.doorOffset ? sx + stamp.doorOffset[0] : sx + Math.floor(sw / 2);
            const isGate = y === sy + sh - 1 && Math.abs(x - doorX) <= 1;
            if (isRim && !isGate) {
              decor[y][x] = 'wall';
              collision[y][x] = true;
            } else {
              decor[y][x] = null;
              collision[y][x] = false;
            }
          }
        }
        continue;
      }

      // Standard Architectural Stamp (house_small 5x4, house_medium 6x5, workshop_landmark, market_landmark, resonance_lab, gym_sanctuary)
      const doorX = stamp.doorOffset ? sx + stamp.doorOffset[0] : sx + Math.floor(sw / 2);
      const doorY = stamp.doorOffset ? sy + stamp.doorOffset[1] : sy + sh - 1;

      for (let y = sy; y < sy + sh; y++) {
        for (let x = sx; x < sx + sw; x++) {
          if (!inBounds(x, y)) continue;
          encounters[y][x] = null;
          reservedLane[y][x] = true;

          // Upper half of footprint is pitched roof ('roof' star layer), lower half is timber/plaster facade
          const roofRows = Math.max(1, Math.floor(sh * 0.45));
          if (y < sy + roofRows) {
            decor[y][x] = 'roof';
            collision[y][x] = true;
          } else if (x === doorX && y === doorY) {
            decor[y][x] = 'door';
            ground[y][x] = 'path';
            collision[y][x] = false; // Walkable door trigger
          } else {
            decor[y][x] = 'building_wall';
            collision[y][x] = true;
          }
        }
      }

      // Clear a 2-tile porch in front of the door so the player is never blocked
      for (let py = doorY + 1; py <= doorY + 2; py++) {
        for (let px = doorX - 1; px <= doorX + 1; px++) {
          if (inBounds(px, py)) {
            if (px === doorX) ground[py][px] = 'path';
            decor[py][px] = null;
            collision[py][px] = false;
            encounters[py][px] = null;
            reservedLane[py][px] = true;
          }
        }
      }

      // Reserve 1-tile perimeter around building for eaves & contact shadow
      for (let by = sy - 1; by <= sy + sh; by++) {
        for (let bx = sx - 1; bx <= sx + sw; bx++) {
          if (inBounds(bx, by)) {
            reservedLane[by][bx] = true;
          }
        }
      }
    }
  }

  // Reserve NPCs & Signs and trainer line-of-sight lanes
  for (const s of bp.signs) {
    if (inBounds(s.x, s.y)) {
      decor[s.y][s.x] = null;
      collision[s.y][s.x] = true;
      encounters[s.y][s.x] = null;
      reservedLane[s.y][s.x] = true;
      if (inBounds(s.x, s.y + 1)) {
        decor[s.y + 1][s.x] = null;
        collision[s.y + 1][s.x] = false;
        reservedLane[s.y + 1][s.x] = true;
      }
    }
  }

  for (const npc of bp.npcs) {
    if (inBounds(npc.x, npc.y)) {
      decor[npc.y][npc.x] = null;
      collision[npc.y][npc.x] = false;
      encounters[npc.y][npc.x] = null;
      reservedLane[npc.y][npc.x] = true;

      // Clear trainer line of sight (3 tiles ahead in facing direction)
      const dirVec: Record<Direction, [number, number]> = {
        up: [0, -1],
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0],
      };
      const [dx, dy] = dirVec[npc.direction] || [0, 1];
      const losLen = npc.isTrainer ? 3 : 1;
      for (let step = 1; step <= losLen; step++) {
        const lx = npc.x + dx * step;
        const ly = npc.y + dy * step;
        if (inBounds(lx, ly) && ground[ly][lx] !== 'water') {
          decor[ly][lx] = null;
          collision[ly][lx] = false;
          reservedLane[ly][lx] = true;
        }
      }
    }
  }

  // --- STAGE 5: SCATTER CLUSTERS (3/5/7) & CONTEXTUAL LORE OBJECTS ---
  if (upToStage >= 5) {
    const rng = new MapRng(bp.seed + 503);
    const placedClusterCenters: Array<[number, number]> = [];

    for (const rule of bp.scatter) {
      const targetClusters = Math.max(1, Math.round((W * H * rule.density) / 55));

      for (let c = 0; c < targetClusters * 5; c++) {
        if (placedClusterCenters.length >= targetClusters * bp.scatter.length) break;

        const cx = rng.int(3, W - 4);
        const cy = rng.int(3, H - 4);

        if (reservedLane[cy][cx] || collision[cy][cx]) continue;
        if (!rule.allowedGround.includes(ground[cy][cx])) continue;

        // Enforce minimum distance between clusters
        if (
          placedClusterCenters.some(
            ([px, py]) => Math.hypot(px - cx, py - cy) < rule.minDistanceBetweenClusters
          )
        ) {
          continue;
        }

        // Prefer near borders or water/trees if requested
        if (rule.preferNearBorders) {
          const nearEdge = cx <= 6 || cx >= W - 7 || cy <= 6 || cy >= H - 7;
          const nVal = valueNoise2D(cx * 0.25, cy * 0.25, bp.seed + 701);
          if (!nearEdge && nVal < 0.58) continue;
        }

        const clusterSize = rule.clusterSizes[rng.int(0, rule.clusterSizes.length - 1)] || 3;
        const offsets: Array<[number, number]> = [
          [0, 0],
          [1, 0],
          [0, 1],
          [-1, 0],
          [1, 1],
          [-1, 1],
          [0, -1],
        ];

        let membersPlaced = 0;
        for (const [ox, oy] of offsets) {
          if (membersPlaced >= clusterSize) break;
          const tx = cx + ox;
          const ty = cy + oy;
          if (!inBounds(tx, ty)) continue;
          if (reservedLane[ty][tx] || collision[ty][tx]) continue;
          if (ground[ty][tx] === 'path' || ground[ty][tx] === 'water' || encounters[ty][tx] === 'tall_grass') {
            continue;
          }

          if (rule.decorType === 'flowers') {
            ground[ty][tx] = 'flowers';
          } else {
            decor[ty][tx] = rule.decorType;
            collision[ty][tx] = true;
          }
          membersPlaced++;
        }

        if (membersPlaced > 0) {
          placedClusterCenters.push([cx, cy]);
        }
      }
    }

    // Place contextual lore/secret objects strictly next to their landmark (Req. 2: never loose in open meadow)
    for (const lm of bp.landmarks) {
      if (lm.loreProp) {
        const lx = lm.x + lm.loreProp.offsetX;
        const ly = lm.y + lm.loreProp.offsetY;
        if (inBounds(lx, ly) && ground[ly][lx] !== 'water' && !collision[ly][lx]) {
          decor[ly][lx] = lm.loreProp.type;
        }
      }
    }
  }

  // --- STAGE 6: LIGHTING & ATMOSPHERE ---
  const skyColor = upToStage >= 6 ? bp.skyColor : 0x475569;
  const sunlightColor = upToStage >= 6 ? bp.sunlightColor : 0xcbd5e1;

  return {
    id: bp.id,
    name: bp.name,
    category: bp.category,
    width: W,
    height: H,
    tileSize: 1,
    ground,
    decor,
    collision,
    encounters,
    encounterRate: bp.encounterRate,
    encounterTable: bp.encounterTable,
    signs: bp.signs,
    warps: bp.warps,
    triggers: [],
    npcs: bp.npcs,
    spawnPoints: bp.spawnPoints,
    ambientMusic: bp.ambientMusic,
    sunlightColor,
    skyColor,
    authoringBlueprint: bp,
    authoringStage: upToStage,
  } as MapData & { authoringBlueprint?: MapAuthoringBlueprint; authoringStage?: AuthoringStage };
}
