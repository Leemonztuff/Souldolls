/**
 * BLOQUE 47 (Paso 1.5 & Paso 2): Suite de Tests Unitarios para /systems/mapgen y MapLoader
 * Prueba:
 * 1. Determinismo por seed (mismo seed -> mismo hash; distinto seed -> distinto hash).
 * 2. Cada regla del validador con un defecto inyectado:
 *    - open-edge (borde abierto)
 *    - no-spawn (sin spawn)
 *    - unreachable (landmark sellado por estatuas)
 *    - stamp-overlap (stamps solapados)
 *    - stamp-door (puerta bloqueada)
 *    - patch-small (parche de hierba alta diminuto < 6 tiles)
 *    - empty-zone (zona vacía >= 10x10)
 * 3. Rotación de stamps (0° -> sur, 90° -> oeste, 180° -> norte, 270° -> este).
 * 4. Lago sin puente bloquea el paso y con puente permite pasar (BFS).
 * 5. Integración con MapLoader y validación de /data/maps/src/aldea_marioneta.map.json sin errores.
 * 6. Compatibilidad intacta con los mapas antiguos en WorldGraph.
 */

import aldeaMarionetaSrc from '../data/maps/src/aldea_marioneta.map.json';
import {
  bakeMap,
  MapSourceSchemaV1,
  resolveRotatedStamp,
  validateMap,
  validateMapSourceSchema,
} from '../systems/mapgen';
import { MapLoader } from '../data/maps/MapLoader';
import { WorldGraph } from '../data/maps/worldGraph';

export interface MapGenCoreTestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: { name: string; passed: boolean; detail: string }[];
}

function makeBaseValidMap(seed = 12345): MapSourceSchemaV1 {
  return {
    schema: 1,
    meta: {
      id: 'test_map',
      name: 'Mapa de Prueba',
      width: 24,
      height: 20,
      seed,
      defaultBiome: 'meadow',
    },
    border: {
      thickness: 2,
      material: 'tree',
    },
    regions: [
      {
        id: 'reg_1',
        biome: 'meadow',
        points: [
          [1, 1],
          [23, 1],
          [23, 19],
          [1, 19],
        ],
        edgeNoise: 0.4,
        noiseScale: 0.25,
      },
    ],
    paths: [
      {
        id: 'path_main_1',
        rank: 'main',
        surface: 'cobble',
        points: [
          [12, 1],
          [12, 16],
        ],
        widthJitter: 0,
      },
      {
        id: 'path_sec_1',
        rank: 'secondary',
        surface: 'path',
        points: [
          [5, 10],
          [19, 10],
        ],
        widthJitter: 0,
      },
    ],
    patches: [
      {
        id: 'patch_grass_1',
        type: 'tall_grass',
        center: [6, 14],
        radius: 2.6,
        aspect: 1.2,
        rotation: 15,
        noise: 0.28,
      },
      {
        id: 'patch_flowers_1',
        type: 'flowers',
        center: [17, 14],
        radius: 2.5,
        aspect: 1.1,
        rotation: -10,
        noise: 0.25,
      },
    ],
    stamps: [
      {
        id: 'st_workshop_1',
        stampId: 'workshop',
        x: 4,
        y: 4,
        rot: 0,
      },
      {
        id: 'st_house_1',
        stampId: 'house_small',
        x: 15,
        y: 4,
        rot: 0,
      },
    ],
    landmarks: [
      {
        id: 'lm_spawn',
        role: 'spawn',
        x: 12,
        y: 10,
        label: 'Spawn Central',
      },
      {
        id: 'lm_exit_north',
        role: 'exit',
        x: 12,
        y: 1,
        label: 'Salida Norte',
        targetMap: 'ruta_claro',
      },
      {
        id: 'lm_south_rest',
        role: 'rest',
        x: 12,
        y: 16,
        label: 'Descanso Sur',
      },
    ],
  };
}

export class Bloque47MapgenCoreTestRunner {
  public static runAllTests(): MapGenCoreTestResult {
    const results: { name: string; passed: boolean; detail: string }[] = [];
    const record = (name: string, passed: boolean, detail: string) => {
      results.push({ name, passed, detail });
    };

    // 1. Determinismo por seed
    const m1 = bakeMap(makeBaseValidMap(77777));
    const m2 = bakeMap(makeBaseValidMap(77777));
    const m3 = bakeMap(makeBaseValidMap(88888));
    const determinismOk = m1.hash === m2.hash && m1.hash !== m3.hash;
    record(
      '1. Determinismo por seed (mismo seed -> mismo hash; distinto seed -> distinto hash)',
      determinismOk,
      `hash(77777)=${m1.hash}, hash2(77777)=${m2.hash}, hash(88888)=${m3.hash}`
    );

    // 2. Defecto inyectado: Borde abierto (open-edge)
    const mapOpenEdge = makeBaseValidMap();
    mapOpenEdge.border.thickness = 0;
    const repOpenEdge = validateMap(mapOpenEdge);
    const hasOpenEdge = repOpenEdge.issues.some((i) => i.ruleId === 'open-edge');
    record(
      '2. Regla open-edge detecta celda transitable tocando el borde exterior sin hueco de salida',
      hasOpenEdge,
      `issues=${repOpenEdge.issues.filter((i) => i.ruleId === 'open-edge').map((i) => i.message).join('; ')}`
    );

    // 3. Defecto inyectado: Sin spawn (no-spawn)
    const mapNoSpawn = makeBaseValidMap();
    mapNoSpawn.landmarks = mapNoSpawn.landmarks.filter((l) => l.role !== 'spawn');
    const repNoSpawn = validateMap(mapNoSpawn);
    const hasNoSpawn = repNoSpawn.issues.some((i) => i.ruleId === 'no-spawn');
    record(
      '3. Regla no-spawn detecta ausencia de landmark con rol spawn',
      hasNoSpawn,
      `issues=${repNoSpawn.issues.filter((i) => i.ruleId === 'no-spawn').length}`
    );

    // 4. Defecto inyectado: Landmark sellado por estatuas (unreachable)
    const mapSealed = makeBaseValidMap();
    mapSealed.landmarks.push({
      id: 'lm_secret_sealed',
      role: 'secret',
      x: 18,
      y: 16,
      label: 'Cofre Sellado',
    });
    // Rodear (18, 16) en las 4 direcciones con estatuas 1x1
    mapSealed.stamps.push(
      { id: 'seal_n', stampId: 'statue', x: 18, y: 15, rot: 0 },
      { id: 'seal_s', stampId: 'statue', x: 18, y: 17, rot: 0 },
      { id: 'seal_w', stampId: 'statue', x: 17, y: 16, rot: 0 },
      { id: 'seal_e', stampId: 'statue', x: 19, y: 16, rot: 0 }
    );
    const repSealed = validateMap(mapSealed);
    const hasUnreachable = repSealed.issues.some(
      (i) => i.ruleId === 'unreachable' && i.targetId === 'lm_secret_sealed'
    );
    record(
      '4. Regla unreachable detecta landmark sellado por 4 estatuas (BFS desde spawn)',
      hasUnreachable,
      `unreachableTarget=${repSealed.issues.find((i) => i.ruleId === 'unreachable')?.targetId}`
    );

    // 5. Defecto inyectado: Stamps solapados (stamp-overlap)
    const mapOverlap = makeBaseValidMap();
    mapOverlap.stamps.push({
      id: 'st_overlapping_house',
      stampId: 'house_small',
      x: 6,
      y: 5,
      rot: 0,
    });
    const repOverlap = validateMap(mapOverlap);
    const hasOverlap = repOverlap.issues.some((i) => i.ruleId === 'stamp-overlap');
    record(
      '5. Regla stamp-overlap detecta dos edificios solapados',
      hasOverlap,
      `issues=${repOverlap.issues.filter((i) => i.ruleId === 'stamp-overlap').map((i) => i.message).join('; ')}`
    );

    // 6. Defecto inyectado: Puerta bloqueada (stamp-door)
    const mapBlockedDoor = makeBaseValidMap();
    // La puerta de st_workshop_1 (x:4, y:4, 7x5) está en (7, 8) y su casilla de aproximación en (7, 9).
    // Colocar una estatua 1x1 en (7, 9) bloquea la aproximación de la puerta.
    mapBlockedDoor.stamps.push({
      id: 'st_door_blocker',
      stampId: 'statue',
      x: 7,
      y: 9,
      rot: 0,
    });
    const repBlockedDoor = validateMap(mapBlockedDoor);
    const hasBlockedDoor = repBlockedDoor.issues.some((i) => i.ruleId === 'stamp-door');
    record(
      '6. Regla stamp-door detecta casilla de aproximación de puerta bloqueada',
      hasBlockedDoor,
      `issues=${repBlockedDoor.issues.filter((i) => i.ruleId === 'stamp-door').map((i) => i.message).join('; ')}`
    );

    // 7. Defecto inyectado: Parche de hierba alta diminuto < 6 tiles (patch-small)
    const mapTinyPatch = makeBaseValidMap();
    mapTinyPatch.patches.push({
      id: 'patch_tiny_grass',
      type: 'tall_grass',
      center: [4, 15],
      radius: 0.8,
      aspect: 1.0,
      rotation: 0,
      noise: 0,
    });
    const repTinyPatch = validateMap(mapTinyPatch);
    const hasPatchSmall = repTinyPatch.issues.some(
      (i) => i.ruleId === 'patch-small' && i.targetId === 'patch_tiny_grass'
    );
    record(
      '7. Regla patch-small detecta parche de tall_grass con menos de 6 celdas',
      hasPatchSmall,
      `issues=${repTinyPatch.issues.filter((i) => i.ruleId === 'patch-small').map((i) => i.message).join('; ')}`
    );

    // 8. Defecto inyectado: Zona vacía >= 10x10 (empty-zone)
    const mapEmptyZone = makeBaseValidMap();
    mapEmptyZone.meta.width = 34;
    mapEmptyZone.meta.height = 24;
    mapEmptyZone.regions[0].points = [
      [1, 1],
      [33, 1],
      [33, 23],
      [1, 23],
    ];
    const repEmptyZone = validateMap(mapEmptyZone);
    const hasEmptyZone = repEmptyZone.issues.some((i) => i.ruleId === 'empty-zone');
    record(
      '8. Regla empty-zone detecta explanada vacía >= 10×10 de suelo liso',
      hasEmptyZone,
      `issues=${repEmptyZone.issues.filter((i) => i.ruleId === 'empty-zone').map((i) => i.message).join('; ')}`
    );

    // 9. Rotación de stamps: la casilla de aproximación gira de sur (0°) a oeste (90°) a norte (180°) a este (270°)
    const r0 = resolveRotatedStamp('house_small', 10, 10, 0)!;
    const r90 = resolveRotatedStamp('house_small', 10, 10, 90)!;
    const r180 = resolveRotatedStamp('house_small', 10, 10, 180)!;
    const r270 = resolveRotatedStamp('house_small', 10, 10, 270)!;

    const rotSouthOk =
      r0.doorCell!.x === 12 &&
      r0.doorCell!.y === 13 &&
      r0.approachCell!.x === 12 &&
      r0.approachCell!.y === 14;
    const rotWestOk =
      r90.doorCell!.x === 10 &&
      r90.doorCell!.y === 12 &&
      r90.approachCell!.x === 9 &&
      r90.approachCell!.y === 12;
    const rotNorthOk =
      r180.doorCell!.x === 12 &&
      r180.doorCell!.y === 10 &&
      r180.approachCell!.x === 12 &&
      r180.approachCell!.y === 9;
    const rotEastOk =
      r270.doorCell!.x === 13 &&
      r270.doorCell!.y === 12 &&
      r270.approachCell!.x === 14 &&
      r270.approachCell!.y === 12;

    record(
      '9. Rotación de stamps (0° sur, 90° oeste, 180° norte, 270° este) gira máscara, puerta y casilla de aproximación',
      rotSouthOk && rotWestOk && rotNorthOk && rotEastOk,
      `0°=(${r0.approachCell?.x},${r0.approachCell?.y}), 90°=(${r90.approachCell?.x},${r90.approachCell?.y}), 180°=(${r180.approachCell?.x},${r180.approachCell?.y}), 270°=(${r270.approachCell?.x},${r270.approachCell?.y})`
    );

    // 10. Un lago sin puente bloquea el paso y con puente permite cruzar (BFS)
    const mapLakeBlocked = makeBaseValidMap();
    mapLakeBlocked.paths = []; // sin caminos que rodeen
    mapLakeBlocked.patches = [
      {
        id: 'patch_river_barrier',
        type: 'lake',
        center: [12, 13],
        radius: 2.2,
        aspect: 6.0,
        rotation: 0,
        noise: 0,
      },
    ];
    const repLakeNoBridge = validateMap(mapLakeBlocked);
    const blockedWithoutBridge = repLakeNoBridge.issues.some(
      (i) => i.ruleId === 'unreachable' && i.targetId === 'lm_south_rest'
    );

    const mapLakeWithBridge = JSON.parse(JSON.stringify(mapLakeBlocked)) as MapSourceSchemaV1;
    // Añadir puente rotado 90° (3x5 con carril central transitable norte-sur) sobre x=11..13, y=11..15
    mapLakeWithBridge.stamps.push({
      id: 'st_crossing_bridge',
      stampId: 'bridge',
      x: 11,
      y: 11,
      rot: 90,
    });
    const repLakeWithBridge = validateMap(mapLakeWithBridge);
    const reachableWithBridge = !repLakeWithBridge.issues.some(
      (i) => i.ruleId === 'unreachable' && i.targetId === 'lm_south_rest'
    );

    record(
      '10. Lago sin puente bloquea el paso hacia el sur y con puente permite cruzar',
      blockedWithoutBridge && reachableWithBridge,
      `sinPuenteBloquea=${blockedWithoutBridge}, conPuentePasa=${reachableWithBridge}`
    );

    // 11. Cobertura completa de las 8 reglas restantes de B45:
    //     degenerate, exit-edge, landmark-blocked, path-width, stamp-outside, window-no-focus, window-crowded, patch-rect
    const mapDegenerate = makeBaseValidMap();
    mapDegenerate.regions = [];
    const hasDegenerate = validateMap(mapDegenerate).issues.some((i) => i.ruleId === 'degenerate');

    const mapExitEdge = makeBaseValidMap();
    mapExitEdge.landmarks.push({
      id: 'lm_bad_exit',
      role: 'exit',
      x: 12,
      y: 10,
      label: 'Salida Central Inválida',
      targetMap: 'ruta_claro',
    });
    const hasExitEdge = validateMap(mapExitEdge).issues.some((i) => i.ruleId === 'exit-edge');

    const mapLandmarkBlocked = makeBaseValidMap();
    mapLandmarkBlocked.landmarks.push({
      id: 'lm_blocked_rest',
      role: 'rest',
      x: 5,
      y: 5, // Dentro de la huella bloqueada de st_workshop_1 (x:4..10, y:4..8)
      label: 'Banco en Tejado',
    });
    const hasLandmarkBlocked = validateMap(mapLandmarkBlocked).issues.some(
      (i) => i.ruleId === 'landmark-blocked' && i.targetId === 'lm_blocked_rest'
    );

    const mapPathWidth = makeBaseValidMap();
    mapPathWidth.paths[0].widthJitter = 1.9;
    const hasPathWidth = validateMap(mapPathWidth).issues.some((i) => i.ruleId === 'path-width');

    const mapStampOutside = makeBaseValidMap();
    mapStampOutside.stamps.push({
      id: 'st_border_invader',
      stampId: 'house_small',
      x: 0,
      y: 0,
      rot: 0,
    });
    const hasStampOutside = validateMap(mapStampOutside).issues.some(
      (i) => i.ruleId === 'stamp-outside' && i.targetId === 'st_border_invader'
    );

    const mapWindowNoFocus = makeBaseValidMap();
    mapWindowNoFocus.stamps = [];
    mapWindowNoFocus.landmarks = [
      { id: 'lm_spawn_only', role: 'spawn', x: 12, y: 10, label: 'Spawn' },
    ];
    const hasWindowNoFocus = validateMap(mapWindowNoFocus).issues.some(
      (i) => i.ruleId === 'window-no-focus'
    );

    const mapWindowCrowded = makeBaseValidMap();
    mapWindowCrowded.landmarks.push(
      { id: 'f1', role: 'focus', x: 10, y: 10, label: 'F1' },
      { id: 'f2', role: 'focus', x: 11, y: 10, label: 'F2' },
      { id: 'f3', role: 'focus', x: 12, y: 10, label: 'F3' },
      { id: 'f4', role: 'focus', x: 13, y: 10, label: 'F4' }
    );
    const hasWindowCrowded = validateMap(mapWindowCrowded).issues.some(
      (i) => i.ruleId === 'window-crowded'
    );

    const mapPatchRect = makeBaseValidMap();
    mapPatchRect.patches.push({
      id: 'patch_boxy',
      type: 'flowers',
      center: [6.5, 15.5],
      radius: 1.5,
      aspect: 1.0,
      rotation: 0,
      noise: 0,
    });
    const hasPatchRect = validateMap(mapPatchRect).issues.some(
      (i) => i.ruleId === 'patch-rect' && i.targetId === 'patch_boxy'
    );

    record(
      '11. Cobertura de las 8 reglas restantes (degenerate, exit-edge, landmark-blocked, path-width, stamp-outside, window-no-focus, window-crowded, patch-rect)',
      hasDegenerate &&
        hasExitEdge &&
        hasLandmarkBlocked &&
        hasPathWidth &&
        hasStampOutside &&
        hasWindowNoFocus &&
        hasWindowCrowded &&
        hasPatchRect,
      `degenerate=${hasDegenerate}, exitEdge=${hasExitEdge}, lmBlocked=${hasLandmarkBlocked}, pathWidth=${hasPathWidth}, stampOutside=${hasStampOutside}, winNoFocus=${hasWindowNoFocus}, winCrowded=${hasWindowCrowded}, patchRect=${hasPatchRect}`
    );

    // 12. Validación de /data/maps/src/aldea_marioneta.map.json (40x32) y carga en MapLoader + WorldGraph
    const aldeaSchemaOk = validateMapSourceSchema(aldeaMarionetaSrc).valid;
    const aldeaVal = validateMap(aldeaMarionetaSrc as unknown as MapSourceSchemaV1);
    const loadedAldea = MapLoader.loadMapData(aldeaMarionetaSrc as unknown as MapSourceSchemaV1).mapData;
    const hasWorkshopWarp = loadedAldea.warps.some((w) => w.targetMapId === 'interior_center');
    const hasMarketWarp = loadedAldea.warps.some((w) => w.targetMapId === 'interior_shop');
    const hasLabWarp = loadedAldea.warps.some((w) => w.targetMapId === 'interior_lab');
    const hasNorthExitWarp = loadedAldea.warps.some((w) => w.targetMapId === 'ruta_claro');
    const hasRegionBiomes =
      Array.isArray(loadedAldea.regionBiomes) &&
      loadedAldea.regionBiomes.length === 32 &&
      loadedAldea.regionBiomes[16][20] === 'town';
    const oldMapsIntact =
      WorldGraph.getMap('villa_brote').width === 36 &&
      WorldGraph.getMap('ruta_claro').id === 'ruta_claro' &&
      WorldGraph.validateConnections();

    record(
      '12. Mapa de ejemplo aldea_marioneta.map.json (40×32) pasa sin errores, propaga biomas por región y enlaza Taller, Mercado, Laboratorio y Ruta Claro sin romper mapas antiguos',
      aldeaSchemaOk &&
        aldeaVal.valid &&
        aldeaVal.errorCount === 0 &&
        hasWorkshopWarp &&
        hasMarketWarp &&
        hasLabWarp &&
        hasNorthExitWarp &&
        hasRegionBiomes &&
        oldMapsIntact,
      `errors=${aldeaVal.errorCount}, warnings=${aldeaVal.warningCount}, score=${aldeaVal.score}, warps=${loadedAldea.warps.length}, regionBiomesOk=${hasRegionBiomes}, oldMapsIntact=${oldMapsIntact}`
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

const proc = (globalThis as any).process;
if (proc && proc.argv?.[1]?.includes('mapgen.test')) {
  const res = Bloque47MapgenCoreTestRunner.runAllTests();
  if (!res.passed) {
    console.error('❌ [Bloque 47 Mapgen Tests] Fallaron tests:', res.results.filter((r) => !r.passed));
    proc.exit?.(1);
  }
  console.log(`✅ [Bloque 47 Mapgen Tests] ${res.passedTests}/${res.totalTests} tests en verde.`);
}

