/**
 * BLOQUE 47 (Paso 2): MapLoader — Cargador e Integrador de Mapas Fuente (Schema 1) en el Juego
 * - Acepta mapas fuente (schema 1) y los hornea en tiempo de carga usando /systems/mapgen y /data/mapgen/tile_map.json.
 * - Mantiene compatibilidad total con los mapas actuales (MapData pre-horneados).
 * - Genera automáticamente:
 *   · ground[y][x], decor[y][x], collision[y][x] (= !walkable[y][x]), encounters[y][x] ('tall_grass')
 *   · warps de puertas de stamps con "service" (workshop, market, lab, house, cave) y registro de retorno a la casilla de aproximación
 *   · warps de landmarks "exit" hacia targetMap
 *   · spawnPoints desde el landmark "spawn"
 */

import tileMapJson from '../mapgen/tile_map.json';
import {
  bakeMap,
  BakedCellType,
  BakedMapGrid,
  isMapSourceSchemaV1,
  MapSourceSchemaV1,
  validateMap,
  validateMapSourceSchema,
} from '../../systems/mapgen';
import { Direction } from '../../types';
import { MapData, MapSign, MapWarp } from '../../types/maps';
import { TileType } from '../../types/tilesets';

export interface ServiceReturnPoint {
  returnMapId: string;
  returnX: number;
  returnY: number;
  returnDirection: Direction;
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const PATH_SURFACE_TO_GROUND: Record<string, TileType> = {
  cobble: 'cobble',
  path: 'path',
  dirt: 'path',
  sand: 'sand',
  wood: 'wood_floor',
};

export class MapLoader {
  private static lastReturnByInteriorMap: Map<string, ServiceReturnPoint> = new Map();

  /**
   * Registra la casilla de aproximación exterior al entrar por la puerta de un edificio con "service"
   * para que al salir del interior regrese exactamente a esa casilla de aproximación.
   */
  public static recordInteriorEntry(
    interiorMapId: string,
    returnPoint: ServiceReturnPoint
  ): void {
    this.lastReturnByInteriorMap.set(interiorMapId, returnPoint);
  }

  public static getInteriorReturnPoint(interiorMapId: string): ServiceReturnPoint | undefined {
    return this.lastReturnByInteriorMap.get(interiorMapId);
  }

  /**
   * Sincroniza los warps de salida de un mapa interior con la última casilla de aproximación registrada
   * (o con la puerta del edificio correspondiente en el mapa exterior activo).
   */
  public static syncInteriorReturnWarps(
    interiorMap: MapData,
    fallbackExteriorMap?: MapData
  ): MapData {
    const recorded = this.lastReturnByInteriorMap.get(interiorMap.id);
    if (!recorded && !fallbackExteriorMap) return interiorMap;

    const updatedWarps = interiorMap.warps.map((w) => {
      if (recorded) {
        return {
          ...w,
          targetMapId: recorded.returnMapId,
          targetX: recorded.returnX,
          targetY: recorded.returnY,
          targetDirection: recorded.returnDirection,
        };
      }
      return w;
    });

    return {
      ...interiorMap,
      warps: updatedWarps,
    };
  }

  /**
   * Carga cualquier documento de mapa:
   * - Si es `MapSourceSchemaV1` (`schema: 1`), lo valida, hornea con `bakeMap` y traduce a `MapData` mediante `tile_map.json`.
   * - Si ya es un `MapData` pre-horneado (mapas antiguos/interiores), lo devuelve intacto sin romper nada.
   */
  public static loadMapData(
    input: MapSourceSchemaV1 | MapData,
    resolveTargetSpawn?: (targetMapId: string, exitDirection: Direction) => { x: number; y: number; direction: Direction }
  ): { mapData: MapData; bakedGrid?: BakedMapGrid } {
    if (!isMapSourceSchemaV1(input)) {
      return { mapData: input as MapData };
    }

    const schemaCheck = validateMapSourceSchema(input);
    if (!schemaCheck.valid) {
      throw new Error(
        `[MapLoader] Error de schema en mapa "${input.meta?.id}": ${schemaCheck.errors.join(' | ')}`
      );
    }

    const baked = bakeMap(input);
    const W = baked.width;
    const H = baked.height;
    const cellMappings = tileMapJson.cells as Record<
      BakedCellType,
      { ground: string; decor: string | null; encounter?: string; walkable: boolean }
    >;
    const borderMatDecor = tileMapJson.borderMaterialDecor as Record<string, string | null>;
    const serviceMappings = tileMapJson.services as Record<
      string,
      {
        targetMapId: string;
        targetX: number;
        targetY: number;
        targetDirection: Direction;
      }
    >;
    const biomePalettes = tileMapJson.biomePalettes as Record<
      string,
      {
        category: MapData['category'];
        skyColor: number;
        sunlightColor: number;
        ambientMusic: string;
      }
    >;

    const ground: TileType[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => 'grass' as TileType)
    );
    const decor: (string | null)[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => null)
    );
    const collision: boolean[][] = Array.from({ length: H }, (_, y) =>
      Array.from({ length: W }, (__, x) => !baked.walkable[y][x])
    );
    const encounters: (string | null)[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => null)
    );

    const borderMat = input.border?.material || 'tree';

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cellType = baked.cells[y][x];
        const mapEntry = cellMappings[cellType] || cellMappings.ground;

        if (cellType === 'border' && borderMat === 'water') {
          ground[y][x] = 'water';
          decor[y][x] = null;
        } else if (cellType === 'border') {
          ground[y][x] = mapEntry.ground as TileType;
          decor[y][x] = borderMatDecor[borderMat] ?? mapEntry.decor;
        } else if (
          (cellType === 'path_main' || cellType === 'path_secondary' || cellType === 'path_trail') &&
          baked.pathSurfaces[y]?.[x]
        ) {
          ground[y][x] = PATH_SURFACE_TO_GROUND[baked.pathSurfaces[y][x]!] || (mapEntry.ground as TileType);
          decor[y][x] = mapEntry.decor;
        } else {
          ground[y][x] = mapEntry.ground as TileType;
          decor[y][x] = mapEntry.decor;
        }

        if (mapEntry.encounter) {
          encounters[y][x] = mapEntry.encounter;
        }
      }
    }

    // Distinguir tejados ('roof') de paredes ('building_wall') en edificios para que buildArchitecturalHouses
    // y el renderizador 2.5D construyan las casas con tejado, ventanas, chimenea y puerta:
    for (const rec of baked.stampRecords) {
      const prefabId = rec.stampId;
      const isBuilding =
        prefabId === 'house_small' ||
        prefabId === 'house_medium' ||
        prefabId === 'workshop' ||
        prefabId === 'market' ||
        prefabId === 'lab';

      if (isBuilding) {
        for (let ry = 0; ry < rec.height; ry++) {
          for (let rx = 0; rx < rec.width; rx++) {
            const gx = rec.x + rx;
            const gy = rec.y + ry;
            if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;
            if (baked.cells[gy][gx] === 'stamp_block') {
              decor[gy][gx] = ry < rec.height - 1 ? 'roof' : 'building_wall';
            }
          }
        }
      } else if (prefabId === 'fountain_plaza') {
        for (let ry = 0; ry < rec.height; ry++) {
          for (let rx = 0; rx < rec.width; rx++) {
            const gx = rec.x + rx;
            const gy = rec.y + ry;
            if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;
            if (baked.cells[gy][gx] === 'stamp_block') {
              ground[gy][gx] = 'water';
              decor[gy][gx] = 'fountain';
            } else {
              ground[gy][gx] = 'cobble';
              decor[gy][gx] = null;
            }
          }
        }
      } else if (prefabId === 'well' || prefabId === 'statue') {
        for (let ry = 0; ry < rec.height; ry++) {
          for (let rx = 0; rx < rec.width; rx++) {
            const gx = rec.x + rx;
            const gy = rec.y + ry;
            if (gx >= 0 && gx < W && gy >= 0 && gy < H && baked.cells[gy][gx] === 'stamp_block') {
              decor[gy][gx] = 'rock';
            }
          }
        }
      } else if (prefabId === 'bridge') {
        for (let ry = 0; ry < rec.height; ry++) {
          for (let rx = 0; rx < rec.width; rx++) {
            const gx = rec.x + rx;
            const gy = rec.y + ry;
            if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
              if (baked.cells[gy][gx] === 'stamp_walk') {
                ground[gy][gx] = 'wood_floor';
                decor[gy][gx] = null;
              } else if (baked.cells[gy][gx] === 'stamp_block') {
                decor[gy][gx] = 'fence';
              }
            }
          }
        }
      }
    }

    // Construir Warps, SpawnPoints y landmarkHints para renderizado 3D de fachadas
    const warps: MapWarp[] = [];
    const spawnPoints: Record<string, { x: number; y: number; direction: Direction }> = {};
    const signs: MapSign[] = [...(input.signs || [])];
    const landmarkHints: NonNullable<MapData['landmarkHints']> = {};

    for (const rec of baked.stampRecords) {
      if (rec.stampId === 'workshop' && rec.doorCell) {
        landmarkHints.workshopDoor = { x: rec.doorCell.x, y: rec.doorCell.y };
      } else if (rec.stampId === 'market' && rec.doorCell) {
        landmarkHints.marketDoor = { x: rec.doorCell.x, y: rec.doorCell.y };
      } else if (rec.stampId === 'lab' && rec.doorCell) {
        landmarkHints.labDoor = { x: rec.doorCell.x, y: rec.doorCell.y };
      } else if (rec.stampId === 'fountain_plaza') {
        landmarkHints.fountainCenter = {
          x: Math.round(rec.x + rec.width / 2 - 0.5),
          y: Math.round(rec.y + rec.height / 2 - 0.5),
        };
      } else if (rec.stampId === 'stone_gate') {
        landmarkHints.northGateCenter = {
          x: Math.round(rec.x + rec.width / 2 - 0.5),
          y: Math.round(rec.y + rec.height / 2),
        };
      }
    }

    // 1. Spawn point principal desde landmark "spawn"
    const spawnLandmark = (input.landmarks || []).find((lm) => lm.role === 'spawn');
    if (spawnLandmark) {
      spawnPoints.default = {
        x: spawnLandmark.x,
        y: spawnLandmark.y,
        direction: 'down',
      };
    } else {
      spawnPoints.default = {
        x: Math.floor(W / 2),
        y: Math.floor(H / 2),
        direction: 'down',
      };
    }

    // 2. Warps de puertas de stamps con "service" (workshop, market, lab, house, cave)
    for (const rec of baked.stampRecords) {
      const service = rec.placement.prefab.service;
      if (!service || !rec.doorCell || !rec.approachCell) continue;

      const svcTarget = serviceMappings[service];
      if (!svcTarget) continue;

      const returnDir = OPPOSITE_DIRECTION[rec.approachCell.directionToEnter] || 'down';

      warps.push({
        x: rec.doorCell.x,
        y: rec.doorCell.y,
        targetMapId: svcTarget.targetMapId,
        targetX: svcTarget.targetX,
        targetY: svcTarget.targetY,
        targetDirection: svcTarget.targetDirection,
        interactLabel: 'Entrar',
      });

      // Registrar punto de retorno desde el interior hacia la casilla de aproximación
      const spawnKey =
        service === 'workshop'
          ? 'from_center'
          : service === 'market'
          ? 'from_shop'
          : service === 'lab'
          ? 'from_lab'
          : 'from_house';

      spawnPoints[spawnKey] = {
        x: rec.approachCell.x,
        y: rec.approachCell.y,
        direction: returnDir,
      };

      // Pre-registrar retorno por defecto para este interior
      this.recordInteriorEntry(svcTarget.targetMapId, {
        returnMapId: input.meta.id,
        returnX: rec.approachCell.x,
        returnY: rec.approachCell.y,
        returnDirection: returnDir,
      });
    }

    // 3. Warps de landmarks con role === 'exit'
    for (const lm of input.landmarks || []) {
      if (lm.role !== 'exit') continue;
      const targetMapId = lm.targetMap || 'ruta_claro';

      const distNorth = lm.y;
      const distSouth = H - 1 - lm.y;
      const distWest = lm.x;
      const distEast = W - 1 - lm.x;
      const minDist = Math.min(distNorth, distSouth, distWest, distEast);

      let exitDir: Direction = 'up';
      if (minDist === distSouth) exitDir = 'down';
      else if (minDist === distWest) exitDir = 'left';
      else if (minDist === distEast) exitDir = 'right';

      const targetDest = resolveTargetSpawn
        ? resolveTargetSpawn(targetMapId, exitDir)
        : {
            x: targetMapId === 'ruta_claro' ? 20 : targetMapId === 'pueblo_costero' ? 30 : 10,
            y: targetMapId === 'ruta_claro' ? 28 : targetMapId === 'pueblo_costero' ? 11 : 10,
            direction: exitDir,
          };

      // Añadir warps en el landmark y en la franja de 3 tiles del hueco de borde hacia el exterior
      const warpCoords: [number, number][] = [[lm.x, lm.y]];
      if (exitDir === 'up') {
        for (let gx = lm.x - 1; gx <= lm.x + 1; gx++) {
          warpCoords.push([gx, 0]);
          if (lm.y > 0) warpCoords.push([gx, lm.y]);
        }
        spawnPoints.from_route = {
          x: lm.x,
          y: Math.min(H - 2, lm.y + 1),
          direction: 'down',
        };
      } else if (exitDir === 'down') {
        for (let gx = lm.x - 1; gx <= lm.x + 1; gx++) {
          warpCoords.push([gx, H - 1]);
          warpCoords.push([gx, lm.y]);
        }
      } else if (exitDir === 'left') {
        for (let gy = lm.y - 1; gy <= lm.y + 1; gy++) {
          warpCoords.push([0, gy]);
          warpCoords.push([lm.x, gy]);
        }
      } else {
        for (let gy = lm.y - 1; gy <= lm.y + 1; gy++) {
          warpCoords.push([W - 1, gy]);
          warpCoords.push([lm.x, gy]);
        }
      }

      const addedWarpKeys = new Set<string>();
      for (const [wx, wy] of warpCoords) {
        if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
        const k = `${wx},${wy}`;
        if (addedWarpKeys.has(k)) continue;
        addedWarpKeys.add(k);
        collision[wy][wx] = false;
        warps.push({
          x: wx,
          y: wy,
          targetMapId,
          targetX: targetDest.x,
          targetY: targetDest.y,
          targetDirection: targetDest.direction,
          interactLabel: 'Entrar',
        });
      }
    }

    // 4. Asegurar que todos los NPCs y carteles respeten la colisión
    for (const s of signs) {
      if (s.y >= 0 && s.y < H && s.x >= 0 && s.x < W) {
        collision[s.y][s.x] = true;
      }
    }

    const palette = biomePalettes[input.meta.defaultBiome] || biomePalettes.meadow;

    const mapData: MapData = {
      id: input.meta.id,
      name: input.meta.name,
      category: palette.category,
      width: W,
      height: H,
      tileSize: 1,
      ground,
      decor,
      collision,
      encounters,
      encounterRate: input.encounterRate ?? 0.12,
      encounterTable: input.encounterTable ?? [],
      warps,
      triggers: [],
      signs,
      npcs: (input.npcs || []).map((n) => ({ ...n })),
      spawnPoints,
      ambientMusic: palette.ambientMusic,
      sunlightColor: palette.sunlightColor,
      skyColor: palette.skyColor,
      landmarkHints,
      regionBiomes: baked.biomes,
    };

    return { mapData, bakedGrid: baked };
  }
}

export { validateMap };
