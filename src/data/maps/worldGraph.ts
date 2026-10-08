import { MapData, WorldGraphNode } from '../../types/maps';
import { VILLA_BROTE_MAP } from './villa_brote';
import { RUTA_CLARO_MAP } from './ruta_claro';
import { BOSQUE_ECO_MAP } from './bosque_eco';
import { INTERIOR_LAB_MAP } from './interior_lab';
import { INTERIOR_CENTER_MAP } from './interior_center';
import { INTERIOR_SHOP_MAP } from './interior_shop';
import { INTERIOR_HOUSE_MAP } from './interior_house';
import { PUEBLO_COSTERO_MAP } from './pueblo_costero';
import { CIUDAD_GIMNASIO_MAP } from './ciudad_gimnasio';
import { RUTA_MONTANA_MAP } from './ruta_montana';
import aldeaMarionetaSrc from './src/aldea_marioneta.map.json';
import { MapLoader } from './MapLoader';
import { MapSourceSchemaV1 } from '../../systems/mapgen';

let cachedAldeaMarionetaMap: MapData | null = null;

function getAldeaMarionetaMap(): MapData {
  if (!cachedAldeaMarionetaMap) {
    cachedAldeaMarionetaMap = MapLoader.loadMapData(
      aldeaMarionetaSrc as unknown as MapSourceSchemaV1
    ).mapData;
  }
  return cachedAldeaMarionetaMap;
}

export const MAP_REGISTRY: Record<string, MapData> = {
  villa_brote: VILLA_BROTE_MAP,
  get aldea_marioneta(): MapData {
    return getAldeaMarionetaMap();
  },
  ruta_claro: RUTA_CLARO_MAP,
  bosque_eco: BOSQUE_ECO_MAP,
  interior_lab: INTERIOR_LAB_MAP,
  interior_center: INTERIOR_CENTER_MAP,
  interior_shop: INTERIOR_SHOP_MAP,
  interior_house: INTERIOR_HOUSE_MAP,
  pueblo_costero: PUEBLO_COSTERO_MAP,
  ciudad_gimnasio: CIUDAD_GIMNASIO_MAP,
  ruta_montana: RUTA_MONTANA_MAP,
};

export class WorldGraph {
  /**
   * Registra o actualiza en caliente un mapa en el grafo del mundo (aceptando tanto MapSourceSchemaV1 como MapData).
   */
  public static registerMap(input: MapSourceSchemaV1 | MapData): MapData {
    const { mapData } = MapLoader.loadMapData(input);
    if (mapData.id === 'aldea_marioneta') {
      cachedAldeaMarionetaMap = mapData;
    } else {
      Object.defineProperty(MAP_REGISTRY, mapData.id, {
        value: mapData,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return mapData;
  }

  public static getMap(id: string): MapData {
    const map = MAP_REGISTRY[id];
    if (!map) {
      console.warn(`[WorldGraph] Map "${id}" not found. Falling back to "villa_brote".`);
      return VILLA_BROTE_MAP;
    }
    if (map.indoor) {
      return MapLoader.syncInteriorReturnWarps(map);
    }
    return map;
  }

  public static getAllMaps(): MapData[] {
    return Object.values(MAP_REGISTRY);
  }

  public static getGraphNodes(): WorldGraphNode[] {
    return Object.values(MAP_REGISTRY).map((m) => {
      const connected = new Set<string>();
      m.warps.forEach((w) => connected.add(w.targetMapId));
      return {
        id: m.id,
        name: m.name,
        connectedMapIds: Array.from(connected),
        isInterior: m.indoor,
      };
    });
  }

  public static validateConnections(): boolean {
    let isValid = true;
    Object.values(MAP_REGISTRY).forEach((map) => {
      map.warps.forEach((w) => {
        const targetMap = MAP_REGISTRY[w.targetMapId];
        if (!targetMap) {
          console.error(
            `[WorldGraph] Invalid warp in "${map.id}": targetMap "${w.targetMapId}" does not exist!`
          );
          isValid = false;
        } else {
          if (
            w.targetX < 0 ||
            w.targetX >= targetMap.width ||
            w.targetY < 0 ||
            w.targetY >= targetMap.height
          ) {
            console.error(
              `[WorldGraph] Out-of-bounds warp in "${map.id}" -> "${w.targetMapId}" at (${w.targetX}, ${w.targetY})`
            );
            isValid = false;
          }
        }
      });
    });
    return isValid;
  }
}
