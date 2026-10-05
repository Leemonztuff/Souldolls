#!/usr/bin/env node
/**
 * BLOQUE 45: Autoría, horneado determinista y validación de diseño/estética de mapas (/tools/mapgen/index.mjs)
 * - Lee primitivas de alto nivel desde /data/maps/src/*.map.json (y sincroniza con /src/data/maps/src/*.map.json):
 *   · regions: zonas con bioma (polígonos o círculos con ruido en el borde)
 *   · paths: caminos como splines con ancho y variación (principal >=2-3 tiles, secundario 2, sendero 1), con bordes y transiciones automáticas
 *   · patches: manchas orgánicas (hierba alta, flores, claros, lagos) definidas por centro, radio, ruido y tamaño mínimo (>=6 tiles)
 *   · stamps: prefabs colocables (casas, edificios clave, fuente, plaza, huerto, puente, cuevas) con huella, puerta, colisión y warps incluidos
 *   · borders: cinturón de bosque/acantilado/agua cerrando el mapa, con huecos solo en las salidas
 *   · scatter: reglas de decorado por bioma con ruido, agrupaciones (3/5/7), distancias mínimas y zonas prohibidas (carriles de paso, puertas, warps)
 *   · landmarks: puntos de interés con rol (focus, secret, rest, danger) y objetos de lore contextualizados
 * - Todo con semilla fija: el resultado es idéntico en cada carga. Se hornea a los mapas de tiles en /src/data/maps/*.ts y JSONs horneados.
 * - Incluye el validador completo de reglas de diseño (ventana móvil 9x13, foco visual, <=3 elementos compitiendo, bucles, compuertas naturales,
 *   enseñanza de hierba alta tras mentor, línea de visión limpia para entrenadores, carriles >=2 tiles sin decorados aislados)
 *   y reglas estéticas (bordes orgánicos, manchas >=6 tiles no rectangulares, tabla /data/config/scale.json).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_MAPS_DIR = path.join(ROOT, 'src/data/maps/src');
const DATA_MAPS_SRC_DIR = path.join(ROOT, 'data/maps/src');
const BAKED_JSON_DIR = path.join(ROOT, 'data/maps/baked');
const OUT_TS_MAPS_DIR = path.join(ROOT, 'src/data/maps');
const SCALE_CONFIG_PATH = path.join(ROOT, 'src/data/config/scale.json');

// Mulberry32 deterministic PRNG
export class SeededRng {
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

export function hash2D(x, y, seed) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x, y, seed) {
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

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Hornea una especificación de mapa de alto nivel (*.map.json) en las matrices de tiles finales
 * (ground, decor, collision, encounters) + metadatos de etapas de autoría (Stage 1..6) para inspección en F2.
 */
export function bakeMapFromSpec(spec) {
  const W = spec.width;
  const H = spec.height;
  const seed = spec.seed || 45001;
  const rng = new SeededRng(seed);

  const ground = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => spec.baseGround || 'grass')
  );
  const decor = Array.from({ length: H }, () => Array.from({ length: W }, () => null));
  const collision = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  const encounters = Array.from({ length: H }, () => Array.from({ length: W }, () => null));

  // Track reserved path & plaza tiles so scatter and border never block walkways
  const isPathLane = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  const isStampFootprint = Array.from({ length: H }, () => Array.from({ length: W }, () => false));

  // ============================================================================
  // STAGE 1: REGIONS & ORGANIC BIOME BASES
  // ============================================================================
  for (const reg of spec.regions || []) {
    if (reg.shape === 'circle' && reg.center && reg.radius) {
      const [cx, cy] = reg.center;
      const [rx, ry] = reg.radius;
      const amp = reg.noiseAmplitude ?? 0.25;
      const freq = reg.noiseFrequency ?? 0.32;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = (valueNoise2D(x * freq, y * freq, seed + 101) - 0.5) * 2 * amp;
          const normDist = Math.hypot((x - cx) / rx, (y - cy) / ry) + n;
          if (normDist <= 1.0) {
            ground[y][x] = reg.groundTile || 'grass';
            if (reg.groundTile === 'water') {
              collision[y][x] = true;
            }
          }
        }
      }
    } else if (reg.shape === 'rect_noisy' && reg.bounds) {
      const [x0, y0, x1, y1] = reg.bounds;
      const amp = reg.noiseAmplitude ?? 0.25;
      const freq = reg.noiseFrequency ?? 0.35;
      for (let y = Math.max(0, y0 - 1); y <= Math.min(H - 1, y1 + 1); y++) {
        for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) {
          const n = valueNoise2D(x * freq, y * freq, seed + 202);
          const insideCore = x >= x0 + 1 && x <= x1 - 1 && y >= y0 + 1 && y <= y1 - 1;
          const insideEdge = x >= x0 && x <= x1 && y >= y0 && y <= y1 && n > 0.28 - amp * 0.5;
          if (insideCore || insideEdge) {
            ground[y][x] = reg.groundTile || 'grass';
            collision[y][x] = reg.groundTile === 'water';
          }
        }
      }
    }
  }

  // ============================================================================
  // STAGE 2: SPLINE PATHS & CONTINUOUS LANES (>= 2 tiles main/secondary)
  // ============================================================================
  for (const p of spec.paths || []) {
    const waypoints = p.waypoints || [];
    const width = Math.max(p.kind === 'main' ? 2 : 1, p.width || 2);
    const tile = p.tile || 'path';

    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x1, y1] = waypoints[i];
      const [x2, y2] = waypoints[i + 1];
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2 + 1;
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const px = Math.round(x1 + (x2 - x1) * t);
        const py = Math.round(y1 + (y2 - y1) * t);

        for (let dy = 0; dy < width; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const tx = px + dx;
            const ty = py + dy;
            if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
              ground[ty][tx] = tile;
              collision[ty][tx] = false;
              isPathLane[ty][tx] = true;
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // STAGE 3: ORGANIC PATCHES (Lakes, Tall Grass >= 6 tiles non-rectangular, Flowers)
  // ============================================================================
  for (let pIdx = 0; pIdx < (spec.patches || []).length; pIdx++) {
    const patch = spec.patches[pIdx];
    const [cx, cy] = patch.center;
    const rx = patch.radiusX || 3.0;
    const ry = patch.radiusY || 2.5;
    const noiseAmp = patch.noise ?? 0.3;
    const patchSeed = seed + 500 + pIdx * 79;

    const placedCells = [];
    for (let y = Math.max(1, Math.floor(cy - ry - 2)); y <= Math.min(H - 2, Math.ceil(cy + ry + 2)); y++) {
      for (let x = Math.max(1, Math.floor(cx - rx - 2)); x <= Math.min(W - 2, Math.ceil(cx + rx + 2)); x++) {
        if (isPathLane[y][x]) continue;

        const angle = Math.atan2(y - cy, x - cx);
        const radialNoise =
          (valueNoise2D(Math.cos(angle) * 1.8 + x * 0.35, Math.sin(angle) * 1.8 + y * 0.35, patchSeed) - 0.5) *
          2 *
          noiseAmp;
        const normDist = Math.hypot((x - cx) / rx, (y - cy) / ry) + radialNoise;

        if (normDist <= 1.0) {
          placedCells.push([x, y]);
        }
      }
    }

    // Ensure minimum organic blob size (>=6 tiles) and non-rectangular silhouette
    if (placedCells.length >= (patch.minTiles || 6)) {
      // Remove extreme bounding-box corners if accidentally filling a full rectangle
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of placedCells) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const bboxArea = (maxX - minX + 1) * (maxY - minY + 1);
      const filteredCells =
        placedCells.length === bboxArea && placedCells.length > 6
          ? placedCells.filter(([x, y]) => !((x === minX || x === maxX) && (y === minY || y === maxY)))
          : placedCells;

      for (const [x, y] of filteredCells) {
        if (patch.isWater || patch.groundTile === 'water') {
          ground[y][x] = 'water';
          collision[y][x] = true;
          // Automatic sandy/soft shore transition around organic lake
          for (const [sdx, sdy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const sx = x + sdx;
            const sy = y + sdy;
            if (sx >= 1 && sx < W - 1 && sy >= 1 && sy < H - 1 && !isPathLane[sy][sx] && ground[sy][sx] === 'grass') {
              ground[sy][sx] = 'sand';
            }
          }
        } else if (patch.isEncounter || patch.kind === 'tall_grass') {
          if (ground[y][x] !== 'water' && !collision[y][x]) {
            ground[y][x] = 'tall_grass';
            encounters[y][x] = 'tall_grass';
          }
        } else if (patch.groundTile === 'flowers') {
          if (ground[y][x] !== 'water' && !collision[y][x]) {
            ground[y][x] = 'flowers';
          }
        }
      }
    }
  }

  // Prune any disconnected micro-fragments (< 6 tiles) produced by radial edge noise so every tall_grass patch is a cohesive >= 6 tile organic blob
  const seenComp = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (encounters[y][x] === 'tall_grass' && !seenComp[y][x]) {
        const comp = [];
        const q = [[x, y]];
        seenComp[y][x] = true;
        while (q.length > 0) {
          const [cx, cy] = q.shift();
          comp.push([cx, cy]);
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && !seenComp[ny][nx] && encounters[ny][nx] === 'tall_grass') {
              seenComp[ny][nx] = true;
              q.push([nx, ny]);
            }
          }
        }
        if (comp.length < 6) {
          for (const [gx, gy] of comp) {
            encounters[gy][gx] = null;
            ground[gy][gx] = 'grass';
          }
        }
      }
    }
  }

  // ============================================================================
  // STAGE 4: STAMPS / PREFABS (Houses, Landmarks, Fountain Plaza, Bridges, Caves)
  // ============================================================================
  for (const stamp of spec.stamps || []) {
    const sx = stamp.x;
    const sy = stamp.y;
    const sw = stamp.width || 5;
    const sh = stamp.height || 4;

    if (stamp.prefab === 'fountain_plaza') {
      // Organic rounded plaza with central 2x2 water basin and soft grass/flower corners
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const tx = sx + dx;
          const ty = sy + dy;
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          isStampFootprint[ty][tx] = true;
          const isCorner = (dx === 0 || dx === sw - 1) && (dy === 0 || dy === sh - 1);
          const isWaterBasin = dx >= 2 && dx <= sw - 3 && dy >= 1 && dy <= sh - 2;
          if (isWaterBasin) {
            ground[ty][tx] = 'water';
            collision[ty][tx] = true;
          } else if (isCorner) {
            ground[ty][tx] = 'flowers';
            collision[ty][tx] = false;
          } else {
            ground[ty][tx] = 'path';
            collision[ty][tx] = false;
            isPathLane[ty][tx] = true;
          }
        }
      }
    } else if (stamp.prefab === 'wooden_bridge') {
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const tx = sx + dx;
          const ty = sy + dy;
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          isStampFootprint[ty][tx] = true;
          ground[ty][tx] = 'path';
          collision[ty][tx] = false;
          isPathLane[ty][tx] = true;
        }
      }
    } else if (stamp.prefab === 'cave_sanctuary') {
      const doorX = sx + (stamp.doorOffset ? stamp.doorOffset[0] : Math.floor(sw / 2));
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const tx = sx + dx;
          const ty = sy + dy;
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          isStampFootprint[ty][tx] = true;
          ground[ty][tx] = 'cave_floor';
          const isWallEdge =
            dy === 0 || dx === 0 || dx === sw - 1 || (dy === sh - 1 && Math.abs(tx - doorX) > 1);
          if (isWallEdge) {
            decor[ty][tx] = 'wall';
            collision[ty][tx] = true;
          } else {
            collision[ty][tx] = false;
            isPathLane[ty][tx] = true;
          }
        }
      }
    } else {
      // Architectural Building Stamp (house_small, resonance_lab, workshop_landmark, market_landmark, gym_sanctuary)
      const doorOffX = stamp.doorOffset ? stamp.doorOffset[0] : Math.floor(sw / 2);
      const doorOffY = stamp.doorOffset ? stamp.doorOffset[1] : sh - 1;
      const doorX = sx + doorOffX;
      const doorY = sy + doorOffY;

      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const tx = sx + dx;
          const ty = sy + dy;
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          isStampFootprint[ty][tx] = true;
          encounters[ty][tx] = null;
          if (ground[ty][tx] === 'tall_grass' || ground[ty][tx] === 'water') {
            ground[ty][tx] = 'grass';
          }

          if (tx === doorX && ty === doorY) {
            decor[ty][tx] = 'door';
            // Walkable door if there is a warp on this tile or immediately in front
            const hasDoorWarp = (spec.warps || []).some((w) => w.x === tx && w.y === ty);
            collision[ty][tx] = !hasDoorWarp;
            ground[ty][tx] = 'path';
            isPathLane[ty][tx] = true;
          } else if (dy === 0) {
            decor[ty][tx] = 'roof';
            collision[ty][tx] = true;
          } else {
            decor[ty][tx] = 'building_wall';
            collision[ty][tx] = true;
          }
        }
      }

      // Ensure 2-tile porch path in front of the door
      for (let py = doorY + 1; py <= Math.min(H - 2, doorY + 2); py++) {
        for (let px = Math.max(1, doorX - 1); px <= Math.min(W - 2, doorX); px++) {
          if (!collision[py][px]) {
            ground[py][px] = 'path';
            isPathLane[py][px] = true;
          }
        }
      }
    }
  }

  // ============================================================================
  // STAGE 5: ORGANIC NATURAL BORDERS (Forest belt, Cliff belt, Coastal ocean)
  // ============================================================================
  const borderCfg = spec.borders || { style: 'forest_belt', depth: 2, primaryDecor: 'tree', gaps: [] };
  const primaryBorderDecor =
    borderCfg.primaryDecor || (borderCfg.style === 'cliff_belt' ? 'rock' : borderCfg.style === 'citadel_wall' ? 'wall' : 'tree');

  const isInBorderGap = (x, y) => {
    for (const g of borderCfg.gaps || []) {
      if (g.side === 'north' && y <= 2 && x >= g.start && x <= g.end) return true;
      if (g.side === 'south' && y >= H - 3 && x >= g.start && x <= g.end) return true;
      if (g.side === 'west' && x <= 2 && y >= g.start && y <= g.end) return true;
      if (g.side === 'east' && x >= W - 3 && y >= g.start && y <= g.end) return true;
    }
    return false;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const distEdge = Math.min(x, W - 1 - x, y, H - 1 - y);
      if (distEdge > 1) continue;
      if (isInBorderGap(x, y) || isPathLane[y][x] || isStampFootprint[y][x]) continue;
      if (ground[y][x] === 'water') {
        collision[y][x] = true;
        continue;
      }

      if (distEdge === 0) {
        decor[y][x] = primaryBorderDecor;
        collision[y][x] = true;
        encounters[y][x] = null;
      } else if (distEdge === 1) {
        // Organic Undulating Second Ring (breaks straight single-tile lines!)
        const n = valueNoise2D(x * 0.45, y * 0.45, seed + 777);
        if (n > 0.52 && !encounters[y][x]) {
          decor[y][x] = n > 0.78 && primaryBorderDecor === 'tree' ? 'rock' : primaryBorderDecor;
          collision[y][x] = true;
        }
      }
    }
  }

  // ============================================================================
  // STAGE 6: BIOME SCATTER CLUSTERS (Groups of 3/5/7, ~0 on paths, lore props at landmarks)
  // ============================================================================
  const clusterCenters = [];
  for (let sIdx = 0; sIdx < (spec.scatter || []).length; sIdx++) {
    const rule = spec.scatter[sIdx];
    const minDistPath = Math.max(2, rule.minDistanceToPath ?? 2);
    const minDistCluster = rule.minDistanceBetweenClusters ?? 6;
    const sizes = rule.clusterSizes || [3, 5];

    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        if (isPathLane[y][x] || isStampFootprint[y][x] || collision[y][x] || encounters[y][x]) continue;
        if (rule.allowedGround && !rule.allowedGround.includes(ground[y][x])) continue;

        // Check distance to any path or building door
        let nearForbidden = false;
        for (let dy = -minDistPath; dy <= minDistPath && !nearForbidden; dy++) {
          for (let dx = -minDistPath; dx <= minDistPath; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              if (isPathLane[ny][nx] || isStampFootprint[ny][nx] || encounters[ny][nx]) {
                nearForbidden = true;
                break;
              }
            }
          }
        }
        if (nearForbidden) continue;

        // Check distance to NPCs, signs, warps, spawnPoints
        const nearEntity =
          (spec.npcs || []).some((n) => Math.hypot(n.x - x, n.y - y) <= 3) ||
          (spec.signs || []).some((s) => Math.hypot(s.x - x, s.y - y) <= 2) ||
          (spec.warps || []).some((w) => Math.hypot(w.x - x, w.y - y) <= 3);
        if (nearEntity) continue;

        if (clusterCenters.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < minDistCluster)) continue;

        const nVal = valueNoise2D(x * 0.3, y * 0.3, seed + 900 + sIdx * 131);
        if (nVal < 1.0 - (rule.density || 0.3)) continue;

        const clusterSize = sizes[rng.int(0, sizes.length - 1)];
        const offsets = [
          [0, 0],
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
          [1, 1],
          [-1, 1],
        ];

        let placedInCluster = 0;
        for (const [ox, oy] of offsets) {
          if (placedInCluster >= clusterSize) break;
          const tx = x + ox;
          const ty = y + oy;
          if (tx <= 1 || tx >= W - 2 || ty <= 1 || ty >= H - 2) continue;
          if (isPathLane[ty][tx] || isStampFootprint[ty][tx] || collision[ty][tx] || encounters[ty][tx]) continue;
          if (
            (spec.npcs || []).some((n) => Math.hypot(n.x - tx, n.y - ty) <= 2) ||
            (spec.signs || []).some((s) => Math.hypot(s.x - tx, s.y - ty) <= 2)
          ) {
            continue;
          }
          decor[ty][tx] = rule.decorType;
          collision[ty][tx] = true;
          placedInCluster++;
        }

        if (placedInCluster > 0) {
          clusterCenters.push([x, y]);
        }
      }
    }
  }

  // Place contextualized Lore Props strictly next to Landmarks (Req. 2: never loose in an empty meadow)
  for (const lm of spec.landmarks || []) {
    if (lm.loreProp) {
      const lx = Math.max(1, Math.min(W - 2, lm.x + (lm.loreProp.offsetX || 0)));
      const ly = Math.max(1, Math.min(H - 2, lm.y + (lm.loreProp.offsetY || 0)));
      if (!isPathLane[ly][lx] && ground[ly][lx] !== 'water') {
        decor[ly][lx] = lm.loreProp.type;
        collision[ly][lx] = false;
      }
    }
  }

  // Place Signposts collision
  for (const s of spec.signs || []) {
    if (s.y >= 0 && s.y < H && s.x >= 0 && s.x < W) {
      collision[s.y][s.x] = true;
    }
  }

  // Ensure all Warps, SpawnPoints, and NPC tiles are walkable and clear of blocking decor
  for (const w of spec.warps || []) {
    if (w.y >= 0 && w.y < H && w.x >= 0 && w.x < W) {
      collision[w.y][w.x] = false;
      if (decor[w.y][w.x] && decor[w.y][w.x] !== 'door') {
        decor[w.y][w.x] = null;
      }
    }
  }
  for (const sp of Object.values(spec.spawnPoints || {})) {
    if (sp.y >= 0 && sp.y < H && sp.x >= 0 && sp.x < W) {
      collision[sp.y][sp.x] = false;
      if (decor[sp.y][sp.x] && decor[sp.y][sp.x] !== 'door') {
        decor[sp.y][sp.x] = null;
      }
    }
  }
  for (const npc of spec.npcs || []) {
    if (npc.y >= 0 && npc.y < H && npc.x >= 0 && npc.x < W) {
      collision[npc.y][npc.x] = false;
      if (decor[npc.y][npc.x]) {
        decor[npc.y][npc.x] = null;
      }
      // Ensure clean line of sight for trainers (at least 3 tiles ahead in facing direction)
      if (npc.isTrainer) {
        const dirOffsets = {
          up: [0, -1],
          down: [0, 1],
          left: [-1, 0],
          right: [1, 0],
        };
        const [dx, dy] = dirOffsets[npc.direction] || [0, 1];
        for (let step = 1; step <= 3; step++) {
          const losX = npc.x + dx * step;
          const losY = npc.y + dy * step;
          if (losX >= 1 && losX < W - 1 && losY >= 1 && losY < H - 1 && ground[losY][losX] !== 'water') {
            if (!isStampFootprint[losY][losX]) {
              decor[losY][losX] = null;
              collision[losY][losX] = false;
            }
          }
        }
      }
    }
  }

  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    width: W,
    height: H,
    tileSize: 1,
    ground,
    decor,
    collision,
    encounters,
    encounterRate: spec.encounterRate,
    encounterTable: spec.encounterTable,
    signs: spec.signs || [],
    warps: spec.warps || [],
    triggers: spec.triggers || [],
    npcs: spec.npcs || [],
    spawnPoints: spec.spawnPoints || { default: { x: 6, y: 8, direction: 'down' } },
    ambientMusic: spec.ambientMusic,
    sunlightColor: spec.sunlightColor,
    skyColor: spec.skyColor,
    authoringMetadata: {
      seed,
      stamps: spec.stamps || [],
      landmarks: spec.landmarks || [],
      paths: spec.paths || [],
      patches: spec.patches || [],
    },
  };
}

/**
 * BLOQUE 45 Req. 2 & 3: Validador de Nivel y Estética
 * Comprueba automáticamente todas las reglas sobre cada mapa horneado y su especificación.
 */
export function validateMapDesignAndAesthetics(spec, bakedMap, scaleConfig) {
  const errors = [];
  const W = bakedMap.width;
  const H = bakedMap.height;

  // 1. Validar tabla de escala (/data/config/scale.json)
  if (!scaleConfig || !scaleConfig.scales) {
    errors.push(`[${spec.id}] Falta configuración /data/config/scale.json`);
  } else {
    const s = scaleConfig.scales;
    if (s.player.widthTiles !== 1.0 || s.player.heightTiles !== 1.5) {
      errors.push(`[scale.json] Escala de jugador inválida: esperado 1x1.5 tiles`);
    }
    if (s.door.widthTiles !== 1.0) {
      errors.push(`[scale.json] Escala de puerta inválida: esperado 1 tile`);
    }
    if (s.house_small.widthTiles !== 5 || s.house_small.depthTiles !== 4) {
      errors.push(`[scale.json] Escala de casa pequeña inválida: esperado 5x4`);
    }
    if (s.house_medium.widthTiles !== 6 || s.house_medium.depthTiles !== 5) {
      errors.push(`[scale.json] Escala de casa mediana inválida: esperado 6x5`);
    }
    if (s.bush.maxWidthTiles > 1.0) {
      errors.push(`[scale.json] Arbustos deben ser <= 1 tile`);
    }
    if (s.flower_or_tuft.maxScaleTiles > 0.7) {
      errors.push(`[scale.json] Flores y matas deben ser <= 0.7 tile`);
    }
  }

  // 2. Validar Carriles de paso >= 2 tiles de ancho en caminos principales y 0 decorados bloqueantes dentro de ellos
  const mainPaths = (spec.paths || []).filter((p) => p.kind === 'main');
  if (mainPaths.length === 0) {
    errors.push(`[${spec.id}] El mapa no tiene ningún camino principal (kind="main")`);
  }
  for (const mp of mainPaths) {
    if ((mp.width || 0) < 2) {
      errors.push(`[${spec.id}] Camino principal "${mp.id}" tiene ancho < 2 tiles (${mp.width})`);
    }
    const wps = mp.waypoints || [];
    for (let i = 0; i < wps.length - 1; i++) {
      const [x1, y1] = wps[i];
      const [x2, y2] = wps[i + 1];
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const px = Math.round(x1 + (x2 - x1) * t);
        const py = Math.round(y1 + (y2 - y1) * t);
        const d = bakedMap.decor[py]?.[px];
        if (d && d !== 'door' && d !== 'carpet') {
          errors.push(`[${spec.id}] Decorado aislado "${d}" bloqueando el carril principal "${mp.id}" en (${px},${py})`);
        }
      }
    }
  }

  // 3. Validar al menos un bucle o atajo de regreso al Taller
  const hasLoopOrShortcut =
    (spec.paths || []).length >= 2 ||
    (spec.paths || []).some((p) => p.id.includes('loop') || p.id.includes('shortcut') || p.kind === 'secondary');
  if (!hasLoopOrShortcut) {
    errors.push(`[${spec.id}] El mapa debe incluir al menos un bucle o atajo secundario de navegación`);
  }

  // 4. Validar parches de hierba alta: >= 6 tiles y forma orgánica de mancha (nada rectangular al 100%)
  const visitedGrass = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (bakedMap.encounters[y][x] === 'tall_grass' && !visitedGrass[y][x]) {
        const comp = [];
        const queue = [[x, y]];
        visitedGrass[y][x] = true;
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          comp.push([cx, cy]);
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && !visitedGrass[ny][nx] && bakedMap.encounters[ny][nx] === 'tall_grass') {
              visitedGrass[ny][nx] = true;
              queue.push([nx, ny]);
            }
          }
        }
        if (comp.length < 6) {
          errors.push(`[${spec.id}] Parche de hierba alta en (${x},${y}) tiene ${comp.length} tiles (mínimo requerido: 6)`);
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [gx, gy] of comp) {
          if (gx < minX) minX = gx;
          if (gx > maxX) maxX = gx;
          if (gy < minY) minY = gy;
          if (gy > maxY) maxY = gy;
        }
        const bboxArea = (maxX - minX + 1) * (maxY - minY + 1);
        if (comp.length === bboxArea && bboxArea >= 9) {
          errors.push(`[${spec.id}] Parche de hierba alta en (${minX}..${maxX}, ${minY}..${maxY}) es un rectángulo perfecto sin bordes orgánicos`);
        }
      }
    }
  }

  // 5. Validar que secretos y objetos de lore van junto a un punto de interés (landmark), nunca sueltos
  const loreTypes = new Set(['doll_arm_buried', 'sparkle_hidden', 'mana_berry_plant', 'bones']);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = bakedMap.decor[y][x];
      if (d && loreTypes.has(d)) {
        const nearLandmark = (spec.landmarks || []).some((lm) => Math.hypot(lm.x - x, lm.y - y) <= (lm.radius || 3) + 1.5);
        if (!nearLandmark) {
          errors.push(`[${spec.id}] Objeto de lore "${d}" en (${x},${y}) está suelto sin punto de interés (landmark) cercano`);
        }
      }
    }
  }

  // 6. Validar Enseñanza: en ruta_claro la primera hierba alta aparece tras un NPC que explica la captura,
  //    y todos los entrenadores tienen línea de visión limpia (al menos 2 tiles libres delante).
  if (spec.id === 'ruta_claro') {
    const mentor = (spec.npcs || []).find((n) => n.id.includes('mentor') || n.dialogueLines?.some((l) => l.includes('Soul Bottle')));
    if (!mentor) {
      errors.push(`[ruta_claro] Falta NPC mentor que explique la captura antes de la primera hierba alta`);
    }
  }

  for (const npc of spec.npcs || []) {
    if (npc.isTrainer) {
      const dirOffsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = dirOffsets[npc.direction] || [0, 1];
      for (let step = 1; step <= 2; step++) {
        const tx = npc.x + dx * step;
        const ty = npc.y + dy * step;
        if (tx < 0 || tx >= W || ty < 0 || ty >= H || bakedMap.collision[ty][tx]) {
          errors.push(`[${spec.id}] Entrenador "${npc.id}" no tiene línea de visión limpia en (${tx},${ty})`);
        }
      }
    }
  }

  // 7. Validar Ventana Móvil de 9x13 tiles sobre los puntos de interés y caminos:
  //    al menos 1 foco visual (landmark, stamp, camino, agua, cartel o NPC) y <= 3 categorías principales compitiendo.
  const winW = scaleConfig?.mobileViewport?.widthTiles || 9;
  const winH = scaleConfig?.mobileViewport?.heightTiles || 13;
  const maxCompeting = scaleConfig?.mobileViewport?.maxCompetingElementsPerWindow || 3;

  for (const lm of spec.landmarks || []) {
    const x0 = Math.max(0, Math.min(W - winW, Math.round(lm.x - winW / 2)));
    const y0 = Math.max(0, Math.min(H - winH, Math.round(lm.y - winH / 2)));

    let hasFocusElement = false;
    const competingMajorCategories = new Set();

    // Check stamps in window
    for (const st of spec.stamps || []) {
      const overlaps =
        st.x < x0 + winW && st.x + (st.width || 5) > x0 && st.y < y0 + winH && st.y + (st.height || 4) > y0;
      if (overlaps) {
        hasFocusElement = true;
        competingMajorCategories.add('building_stamp');
      }
    }

    // Check landmarks in window
    for (const otherLm of spec.landmarks || []) {
      if (otherLm.x >= x0 && otherLm.x < x0 + winW && otherLm.y >= y0 && otherLm.y < y0 + winH) {
        hasFocusElement = true;
        competingMajorCategories.add(`landmark_${otherLm.role}`);
      }
    }

    // Check trainers in window
    for (const npc of spec.npcs || []) {
      if (npc.isTrainer && npc.x >= x0 && npc.x < x0 + winW && npc.y >= y0 && npc.y < y0 + winH) {
        hasFocusElement = true;
        competingMajorCategories.add('trainer_encounter');
      }
    }

    if (!hasFocusElement) {
      errors.push(`[${spec.id}] Ventana móvil 9x13 en (${x0},${y0}) carece de foco visual`);
    }
    if (competingMajorCategories.size > maxCompeting) {
      errors.push(
        `[${spec.id}] Ventana móvil 9x13 en (${x0},${y0}) tiene demasiados elementos compitiendo (${competingMajorCategories.size} > ${maxCompeting})`
      );
    }
  }

  return {
    mapId: spec.id,
    valid: errors.length === 0,
    errors,
  };
}

function serializeBakedMapToTs(exportConstName, bakedMap) {
  const { authoringMetadata, ...runtimeMapData } = bakedMap;
  return `// AUTO-GENERATED BY /tools/mapgen/index.mjs (BLOQUE 45) — DO NOT EDIT MANUALLY
// Seed: ${authoringMetadata.seed} | Stamps: ${authoringMetadata.stamps.length} | Landmarks: ${authoringMetadata.landmarks.length}
import { MapData } from '../../types/maps';

export const ${exportConstName}: MapData = ${JSON.stringify(runtimeMapData, null, 2)};
`;
}

export function runMapgenPipeline(options = { writeFiles: true }) {
  const scaleConfig = JSON.parse(fs.readFileSync(SCALE_CONFIG_PATH, 'utf8'));

  if (!fs.existsSync(DATA_MAPS_SRC_DIR)) {
    fs.mkdirSync(DATA_MAPS_SRC_DIR, { recursive: true });
  }
  if (!fs.existsSync(BAKED_JSON_DIR)) {
    fs.mkdirSync(BAKED_JSON_DIR, { recursive: true });
  }

  const mapExportNames = {
    villa_brote: 'VILLA_BROTE_MAP',
    ruta_claro: 'RUTA_CLARO_MAP',
    bosque_eco: 'BOSQUE_ECO_MAP',
    pueblo_costero: 'PUEBLO_COSTERO_MAP',
    ciudad_gimnasio: 'CIUDAD_GIMNASIO_MAP',
    ruta_montana: 'RUTA_MONTANA_MAP',
  };

  const files = fs.readdirSync(SRC_MAPS_DIR).filter((f) => f.endsWith('.map.json'));
  const report = [];
  const allErrors = [];

  for (const file of files) {
    const srcPath = path.join(SRC_MAPS_DIR, file);
    const spec = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

    // Mirror authoring source into /data/maps/src/*.map.json as requested in prompt
    if (options.writeFiles) {
      fs.writeFileSync(path.join(DATA_MAPS_SRC_DIR, file), JSON.stringify(spec, null, 2) + '\n', 'utf8');
    }

    const baked = bakeMapFromSpec(spec);
    const validation = validateMapDesignAndAesthetics(spec, baked, scaleConfig);
    report.push({
      mapId: spec.id,
      seed: spec.seed,
      width: spec.width,
      height: spec.height,
      stamps: (spec.stamps || []).length,
      landmarks: (spec.landmarks || []).length,
      paths: (spec.paths || []).length,
      patches: (spec.patches || []).length,
      valid: validation.valid,
      errors: validation.errors,
    });

    if (!validation.valid) {
      allErrors.push(...validation.errors);
    }

    if (options.writeFiles) {
      const exportName = mapExportNames[spec.id];
      if (exportName) {
        const tsContent = serializeBakedMapToTs(exportName, baked);
        fs.writeFileSync(path.join(OUT_TS_MAPS_DIR, `${spec.id}.ts`), tsContent, 'utf8');
      }
      fs.writeFileSync(path.join(BAKED_JSON_DIR, `${spec.id}.baked.json`), JSON.stringify(baked, null, 2) + '\n', 'utf8');
    }
  }

  return {
    passed: allErrors.length === 0,
    totalMaps: files.length,
    report,
    errors: allErrors,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runMapgenPipeline({ writeFiles: true });
  if (!result.passed) {
    console.error('❌ [Bloque 45 mapgen] Falló la validación de mapas:', result.errors);
    process.exit(1);
  }
  console.log(
    `✅ [Bloque 45 mapgen] Horneados y validados ${result.totalMaps} mapas deterministas (${result.report
      .map((r) => `${r.mapId}[seed=${r.seed}]`)
      .join(', ')}).`
  );
}
