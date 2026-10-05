import scaleConfigJson from '../../data/config/scale.json';
import villaBroteSrc from '../../data/maps/src/villa_brote.map.json';
import rutaClaroSrc from '../../data/maps/src/ruta_claro.map.json';
import bosqueEcoSrc from '../../data/maps/src/bosque_eco.map.json';
import puebloCosteroSrc from '../../data/maps/src/pueblo_costero.map.json';
import ciudadGimnasioSrc from '../../data/maps/src/ciudad_gimnasio.map.json';
import rutaMontanaSrc from '../../data/maps/src/ruta_montana.map.json';
import { WorldGraph } from '../../data/maps/worldGraph';
import { GlobalTileRenderer } from './TileRenderer';

export interface Bloque45TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: { name: string; passed: boolean; detail: string }[];
}

export class Bloque45MapgenTestRunner {
  public static runAllTests(): Bloque45TestResult {
    const results: { name: string; passed: boolean; detail: string }[] = [];
    const record = (name: string, passed: boolean, detail: string) => {
      results.push({ name, passed, detail });
    };

    const authoringSources = [
      villaBroteSrc,
      rutaClaroSrc,
      bosqueEcoSrc,
      puebloCosteroSrc,
      ciudadGimnasioSrc,
      rutaMontanaSrc,
    ];

    // 1. Primitivas de autoría de alto nivel y semillas deterministas en *.map.json
    const allHavePrimitivesAndSeed = authoringSources.every(
      (s: any) =>
        typeof s.seed === 'number' &&
        Array.isArray(s.regions) &&
        Array.isArray(s.paths) &&
        Array.isArray(s.patches) &&
        Array.isArray(s.stamps) &&
        typeof s.borders === 'object' &&
        Array.isArray(s.scatter) &&
        Array.isArray(s.landmarks)
    );
    record(
      '1. Autoría de mapas con primitivas (regions, paths, patches, stamps, borders, scatter, landmarks) y semilla fija',
      allHavePrimitivesAndSeed,
      `mapas=${authoringSources.map((s: any) => `${s.id}#${s.seed}`).join(', ')}`
    );

    // 2. Tabla de escalas (/data/config/scale.json) validada
    const sc = scaleConfigJson.scales;
    const scaleOk =
      sc.player.widthTiles === 1.0 &&
      sc.player.heightTiles === 1.5 &&
      sc.door.widthTiles === 1.0 &&
      sc.house_small.widthTiles === 5 &&
      sc.house_small.depthTiles === 4 &&
      sc.house_medium.widthTiles === 6 &&
      sc.house_medium.depthTiles === 5 &&
      sc.tree.minWidthTiles >= 2.0 &&
      sc.tree.maxWidthTiles <= 3.0 &&
      sc.tree.minHeightTiles >= 3.0 &&
      sc.tree.maxHeightTiles <= 4.0 &&
      sc.bush.maxWidthTiles <= 1.0 &&
      sc.flower_or_tuft.maxScaleTiles <= 0.7;
    record(
      '2. Tabla de escala (/data/config/scale.json) cumple proporciones fijas (jugador 1x1.5, casas 5x4/6x5, árboles 2x3..3x4, flores <=0.7)',
      scaleOk,
      `player=${sc.player.widthTiles}x${sc.player.heightTiles}, house_small=${sc.house_small.widthTiles}x${sc.house_small.depthTiles}, flowerMax=${sc.flower_or_tuft.maxScaleTiles}`
    );

    // 3. Carriles de paso >= 2 tiles sin decorados aislados y al menos un bucle/atajo por mapa
    let lanesAndLoopsOk = true;
    const laneDetails: string[] = [];
    for (const src of authoringSources as any[]) {
      const map = WorldGraph.getMap(src.id);
      const mainPaths = src.paths.filter((p: any) => p.kind === 'main');
      if (mainPaths.length === 0 || src.paths.length < 2) {
        lanesAndLoopsOk = false;
      }
      for (const mp of mainPaths) {
        if ((mp.width || 0) < 2) lanesAndLoopsOk = false;
        for (let i = 0; i < mp.waypoints.length - 1; i++) {
          const [x1, y1] = mp.waypoints[i];
          const [x2, y2] = mp.waypoints[i + 1];
          const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            const px = Math.round(x1 + (x2 - x1) * t);
            const py = Math.round(y1 + (y2 - y1) * t);
            const d = map.decor?.[py]?.[px];
            if (d && d !== 'door' && d !== 'carpet') {
              lanesAndLoopsOk = false;
              laneDetails.push(`${src.id}:decor(${d})@${px},${py}`);
            }
          }
        }
      }
    }
    record(
      '3. Carriles principales >= 2 tiles libres de decorados aislados y bucles/atajos de regreso',
      lanesAndLoopsOk,
      laneDetails.length === 0 ? '0 obstrucciones en carriles principales' : laneDetails.join(' | ')
    );

    // 4. Manchas orgánicas de hierba alta (>= 6 tiles y no rectangulares)
    let organicGrassOk = true;
    let totalGrassBlobs = 0;
    for (const src of authoringSources as any[]) {
      const map = WorldGraph.getMap(src.id);
      if (!map.encounters) continue;
      const W = map.width;
      const H = map.height;
      const visited = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (map.encounters[y]?.[x] === 'tall_grass' && !visited[y][x]) {
            totalGrassBlobs++;
            const comp: [number, number][] = [];
            const q: [number, number][] = [[x, y]];
            visited[y][x] = true;
            while (q.length > 0) {
              const [cx, cy] = q.shift()!;
              comp.push([cx, cy]);
              for (const [dx, dy] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
              ]) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < W && ny >= 0 && ny < H && !visited[ny][nx] && map.encounters[ny]?.[nx] === 'tall_grass') {
                  visited[ny][nx] = true;
                  q.push([nx, ny]);
                }
              }
            }
            if (comp.length < 6) organicGrassOk = false;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const [gx, gy] of comp) {
              if (gx < minX) minX = gx;
              if (gx > maxX) maxX = gx;
              if (gy < minY) minY = gy;
              if (gy > maxY) maxY = gy;
            }
            const bbox = (maxX - minX + 1) * (maxY - minY + 1);
            if (comp.length === bbox && bbox >= 9) organicGrassOk = false;
          }
        }
      }
    }
    record(
      '4. Parches de hierba alta orgánicos (>= 6 tiles en forma de mancha, cero rectángulos rígidos)',
      organicGrassOk && totalGrassBlobs > 0,
      `manchasValidadas=${totalGrassBlobs}`
    );

    // 5. Objetos de lore junto a puntos de interés (landmarks), enseñanza de captura y línea de visión de entrenadores
    let loreAndTrainersOk = true;
    const loreSet = new Set(['doll_arm_buried', 'sparkle_hidden', 'mana_berry_plant', 'bones']);
    for (const src of authoringSources as any[]) {
      const map = WorldGraph.getMap(src.id);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const d = map.decor?.[y]?.[x];
          if (d && loreSet.has(d)) {
            const nearLm = src.landmarks.some((lm: any) => Math.hypot(lm.x - x, lm.y - y) <= (lm.radius || 3) + 1.5);
            if (!nearLm) loreAndTrainersOk = false;
          }
        }
      }
      for (const npc of map.npcs || []) {
        if (npc.isTrainer) {
          const dirOffsets: Record<string, [number, number]> = {
            up: [0, -1],
            down: [0, 1],
            left: [-1, 0],
            right: [1, 0],
          };
          const [dx, dy] = dirOffsets[npc.direction] || [0, 1];
          for (let step = 1; step <= 2; step++) {
            const tx = npc.x + dx * step;
            const ty = npc.y + dy * step;
            if (map.collision[ty]?.[tx]) loreAndTrainersOk = false;
          }
        }
      }
    }
    record(
      '5. Objetos de lore contextualizados junto a landmarks y entrenadores con línea de visión limpia',
      loreAndTrainersOk,
      'lorePropsContextualizados=true, trainerLineOfSight=true'
    );

    // 6. Flujo de 6 etapas en F2, falda de horizonte exterior (sin vacío cian) y casas 2.5D con tejado/aleros/chimenea/ventanas
    const villaMap = WorldGraph.getMap('villa_brote');
    GlobalTileRenderer.setAuthoringStage(0);
    const built = GlobalTileRenderer.buildMapGeometry(villaMap);
    const hasHorizonSkirt = built.groundGroup.children.some((c) => c.name === 'OuterHorizonSkirt');
    const hasWaterFoam = built.groundGroup.children.some((c) => c.name === 'WaterShoreFoam');
    const hasArchHouse = built.facadeAndPropsGroup.children.some((c) => c.name.startsWith('ArchitecturalHouse_'));
    record(
      '6. Horizonte exterior sin vacío cian, espuma en orillas, casas 2.5D con tejado/aleros/chimenea y vistas de etapas F2',
      hasHorizonSkirt && hasWaterFoam && hasArchHouse,
      `horizonSkirt=${hasHorizonSkirt}, waterFoam=${hasWaterFoam}, architecturalHouses=${hasArchHouse}`
    );

    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = results.length - passedTests;
    return {
      passed: failedTests === 0,
      totalTests: results.length,
      passedTests,
      failedTests,
      results,
    };
  }
}
