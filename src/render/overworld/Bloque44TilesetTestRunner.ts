import * as THREE from 'three';
import {
  CANONICAL_47_MASKS,
  NEIGHBOR_BIT,
  normalizeAutotileMask8,
  getAutotileShape47,
  resolveGridAutotileShape47,
  getWallAutotileShape16,
  getFloorAutotileQuarters,
} from '../../systems/maps/autotile';
import { GlobalTileRegistry } from './TileRegistry';
import { GlobalTileRenderer } from './TileRenderer';
import { GlobalAssetLoader } from './AssetLoader';
import { WorldGraph } from '../../data/maps/worldGraph';

/**
 * BLOQUE 44 Req. 9: Pruebas automatizadas en cliente y CLI para:
 * - Validador de hojas y referencias de mapas (0 tileRefs huérfanos en todos los mapas del WorldGraph).
 * - Las 47 formas de máscara de vecinos de autotile (esquinas, bordes, islas, centro) y las 16 de muros.
 * - Configuración estricta de texturas (NearestFilter, generateMipmaps === false, SRGBColorSpace).
 * - Presupuesto de draw calls de suelo fusionado en chunks de 16x16.
 */
export class Bloque44TilesetTestRunner {
  public static runAllTests(): { passed: number; failed: number; details: string[] } {
    const details: string[] = [];
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, name: string, info = '') => {
      if (condition) {
        passed++;
        details.push(`PASS: ${name}${info ? ` (${info})` : ''}`);
      } else {
        failed++;
        details.push(`FAIL: ${name}${info ? ` (${info})` : ''}`);
        console.error(`[Bloque44TilesetTestRunner] FAIL: ${name} ${info}`);
      }
    };

    // 1. Test 47 canonical autotile masks (center, island, corners, edges, inner corners)
    assert(
      CANONICAL_47_MASKS.length === 47,
      'Autotile canonical mask table has exactly 47 shapes',
      `count=${CANONICAL_47_MASKS.length}`
    );

    const centerShape = getAutotileShape47(255);
    const islandShape = getAutotileShape47(0);
    assert(centerShape === 0, 'Full 8-neighbor mask (255) maps to shape 0 (interior)', `shape=${centerShape}`);
    assert(islandShape === 46, 'Zero-neighbor mask (0) maps to shape 46 (island)', `shape=${islandShape}`);

    // Diagonal irrelevance rule: diagonal bits without both adjacent cardinals must normalize to 0
    const isolatedWithDiagonals = normalizeAutotileMask8(
      NEIGHBOR_BIT.NE | NEIGHBOR_BIT.SE | NEIGHBOR_BIT.SW | NEIGHBOR_BIT.NW
    );
    assert(
      isolatedWithDiagonals === 0 && getAutotileShape47(isolatedWithDiagonals) === 46,
      'Diagonal neighbors without orthogonal cardinals normalize to island shape 46'
    );

    // Verify all 47 shapes produce valid quarter coordinates in [0..3] x [0..5]
    let allQuartersValid = true;
    const uniqueQuarterSignatures = new Set<string>();
    for (let s = 0; s < 47; s++) {
      const q = getFloorAutotileQuarters(s);
      for (const [qx, qy] of [q.tl, q.tr, q.bl, q.br]) {
        if (qx < 0 || qx > 3 || qy < 0 || qy > 5) {
          allQuartersValid = false;
        }
      }
      uniqueQuarterSignatures.add(`${q.tl.join(',')}|${q.tr.join(',')}|${q.bl.join(',')}|${q.br.join(',')}`);
    }
    assert(
      allQuartersValid && uniqueQuarterSignatures.size === 47,
      'All 47 autotile shapes produce 47 distinct valid quarter-tile blueprints',
      `unique=${uniqueQuarterSignatures.size}`
    );

    // Grid evaluation test (3x3 island and 3x3 solid block)
    const grid3x3 = [
      ['grass', 'grass', 'grass'],
      ['grass', 'water', 'grass'],
      ['grass', 'grass', 'grass'],
    ];
    assert(
      resolveGridAutotileShape47(grid3x3, 1, 1) === 46,
      'Grid autotile resolver detects isolated center tile as shape 46'
    );

    // Wall 16 shapes test
    assert(
      getWallAutotileShape16({ n: true, e: true, s: true, w: true }) === 0 &&
        getWallAutotileShape16({ n: false, e: false, s: false, w: false }) === 15,
      'Wall A3/A4 autotile resolver maps 4-cardinal neighbors to [0..15]'
    );

    // 2. Test TileRegistry & WorldGraph maps for 0 orphan tileRefs
    const mapIds = [
      'villa_brote',
      'ruta_claro',
      'bosque_eco',
      'pueblo_costero',
      'ciudad_gimnasio',
      'ruta_montana',
      'interior_center',
      'interior_shop',
      'interior_house',
      'interior_lab',
    ];
    let orphanCount = 0;
    for (const mapId of mapIds) {
      const map = WorldGraph.getMap(mapId);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const gCell = map.ground[y]?.[x];
          if (gCell) {
            const res = GlobalTileRegistry.resolveTile(String(gCell), 'ground');
            const uv = GlobalTileRegistry.getAtlasRegion(res.canonicalRef, 0, 0);
            if (!uv) orphanCount++;
          }
          const dCell = map.decor?.[y]?.[x];
          if (dCell) {
            const res = GlobalTileRegistry.resolveTile(String(dCell), 'decor');
            const uv = GlobalTileRegistry.getAtlasRegion(res.canonicalRef, 0, 0);
            if (!uv) orphanCount++;
          }
        }
      }
    }
    assert(orphanCount === 0, 'Zero orphan tileRefs across all 10 WorldGraph maps', `orphans=${orphanCount}`);

    // 3. Test Texture Pixel-Art Settings (NearestFilter, generateMipmaps === false, SRGBColorSpace)
    const bakedTex = GlobalTileRenderer.getBakedAtlasTexture();
    const allTextures = [bakedTex, ...GlobalAssetLoader.getAllLoadedTextures()];
    const allNearestAndNoMipmaps = allTextures.every(
      (t) =>
        t.magFilter === THREE.NearestFilter &&
        t.minFilter === THREE.NearestFilter &&
        t.generateMipmaps === false &&
        t.colorSpace === THREE.SRGBColorSpace
    );
    assert(
      allNearestAndNoMipmaps,
      'All tileset textures enforce NearestFilter, generateMipmaps=false, and SRGBColorSpace',
      `checked=${allTextures.length}`
    );

    // 4. Test Baked Atlas Size <= 2048x2048 and 16x16 Chunking budget
    const bakedIdx = GlobalTileRegistry.getBakedAtlasIndex();
    assert(
      bakedIdx.atlasWidth <= 2048 && bakedIdx.atlasHeight <= 2048,
      'Baked atlas dimensions fit within 2048x2048 mobile GPU budget',
      `${bakedIdx.atlasWidth}x${bakedIdx.atlasHeight}`
    );

    const villaMap = WorldGraph.getMap('villa_brote');
    const expectedMaxChunks = Math.ceil(villaMap.width / 16) * Math.ceil(villaMap.height / 16);
    const sampleBuilt = GlobalTileRenderer.buildMapGeometry(villaMap);
    assert(
      sampleBuilt.chunkCount > 0 && sampleBuilt.chunkCount <= expectedMaxChunks,
      `Villa Brote (${villaMap.width}x${villaMap.height}) merges ${villaMap.width * villaMap.height} ground tiles into <= ${expectedMaxChunks} chunk meshes (16x16)`,
      `chunks=${sampleBuilt.chunkCount}`
    );

    console.log(`[Bloque44TilesetTestRunner] Completed: ${passed} passed, ${failed} failed.`);
    return { passed, failed, details };
  }
}
