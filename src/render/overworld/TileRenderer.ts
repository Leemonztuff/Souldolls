import * as THREE from 'three';
import artConfigJson from '../../data/config/art.json';
import scaleConfigJson from '../../data/config/scale.json';
import { MapData } from '../../types/maps';
import { GlobalAssetLoader, AssetLoader } from './AssetLoader';
import { GlobalTileRegistry, ResolvedTileReference } from './TileRegistry';
import { resolveGridAutotileShape47, resolveGridWallShape16 } from '../../systems/maps/autotile';

export type AuthoringStageNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BuiltTileMapResult {
  groundGroup: THREE.Group;
  facadeAndPropsGroup: THREE.Group;
  starOverlayGroup: THREE.Group;
  billboardMeshes: THREE.Mesh[];
  occludableEntries: { x: number; z: number; meshes: THREE.Mesh[] }[];
  chunkCount: number;
}

/**
 * BLOQUE 44 Req. 5, 6, 8: Render de Tilesets en Three.js (/src/render/overworld/TileRenderer.ts)
 * - Reutiliza `AtlasRegion` a través de `GlobalTileRegistry`.
 * - Suelo (A1, A2, A5): geometría fusionada por chunk de 16x16 con UV al atlas horneado;
 *   `NearestFilter`, `generateMipmaps = false`, `SRGBColorSpace`.
 * - Agua A1 animada desplazando UV por un uniform de tiempo (`uWaterTime`), sin coste de CPU por frame.
 * - Fachadas y muros (A3/A4): planos verticales con pivote en la base, que giran con el yaw de la cámara
 *   y aplican una `rotation.x` pequeña para evitar cortes con el suelo al inclinar la cámara.
 * - Objetos B-E: billboards verticales con pivote en los pies. Los objetos de varios tiles (árboles, casas)
 *   se agrupan en una sola pieza; la parte marcada `"star"` usa un `renderOrder` mayor (25) para pasar por delante
 *   del jugador, y la base conserva la colisión.
 * - `alphaTest: 0.5` y `polygonOffset` para evitar z-fighting.
 * - Modo `"plano clásico"` (debug): dibuja todo plano sobre el suelo como en RPG Maker para comparar y detectar fallos.
 * - Coherencia de marca: tinte opcional por bioma (uniform `uBiomeTint` y `uBiomeTintStrength`) para acercar
 *   cualquier pack externo a la paleta de Souldolls sin editar los PNG.
 */
export class TileRenderer {
  private static instance: TileRenderer;

  private bakedAtlasTexture: THREE.Texture | null = null;
  private classicFlatMode = false;
  // Bloque 45 Req. 1: Flujo de autoría en 6 etapas (0 = vista normal completa; 1..6 = etapas de autoría en F2)
  private authoringStage: AuthoringStageNumber = 0;

  // Shared shader uniforms updated once per frame (zero CPU geometry rebuild)
  public readonly waterTimeUniform = { value: 0 };
  public readonly biomeTintColorUniform = { value: new THREE.Color('#fff8eb') };
  public readonly biomeTintStrengthUniform = { value: 0.08 };

  private activeMaterials: THREE.MeshStandardMaterial[] = [];

  // B48 P1: lotes de sombras de contacto pendientes de fusionar en 1 malla por opacidad
  private pendingContactShadows = new Map<number, THREE.BufferGeometry[]>();
  private pendingContactShadowMaterials = new Set<THREE.Material>();

  private constructor() {
    this.initBakedTexture();
  }

  public static getInstance(): TileRenderer {
    if (!TileRenderer.instance) {
      TileRenderer.instance = new TileRenderer();
    }
    return TileRenderer.instance;
  }

  public isClassicFlatMode(): boolean {
    return this.classicFlatMode;
  }

  public setClassicFlatMode(enabled: boolean): void {
    this.classicFlatMode = enabled;
  }

  public toggleClassicFlatMode(): boolean {
    this.classicFlatMode = !this.classicFlatMode;
    return this.classicFlatMode;
  }

  public getAuthoringStage(): AuthoringStageNumber {
    return this.authoringStage;
  }

  public setAuthoringStage(stage: AuthoringStageNumber): void {
    this.authoringStage = stage;
  }

  /**
   * Inicializa la textura del atlas horneado (`baked_atlas.png` / `.webp`) con configuración estricta pixel-art
   * y promueve asíncronamente a `createImageBitmap` mediante `GlobalAssetLoader`.
   * Incluye un canvas síncrono de respaldo con todos los tiles del atlas para que el primer frame nunca se vea vacío.
   */
  private initBakedTexture(): void {
    const bakedIndex = GlobalTileRegistry.getBakedAtlasIndex();
    let initialTex: THREE.Texture;

    if (typeof document !== 'undefined') {
      const fallbackCanvas = this.buildSynchronousFallbackAtlasCanvas(bakedIndex);
      initialTex = new THREE.CanvasTexture(fallbackCanvas);
      AssetLoader.applyPixelArtTextureSettings(initialTex);

      const loader = new THREE.TextureLoader();
      loader.load(bakedIndex.imagePng, (loadedTex) => {
        AssetLoader.applyPixelArtTextureSettings(loadedTex);
        this.bakedAtlasTexture = loadedTex;
        for (const mat of this.activeMaterials) {
          mat.map = loadedTex;
          mat.needsUpdate = true;
        }
      });
    } else {
      initialTex = new THREE.Texture();
      AssetLoader.applyPixelArtTextureSettings(initialTex);
    }

    this.bakedAtlasTexture = initialTex;

    // Also load via GlobalAssetLoader (WebP/PNG manifest + createImageBitmap + bitmap.close())
    if (typeof document !== 'undefined') {
      GlobalAssetLoader.loadCrispTexture(`${bakedIndex.packId}/baked_atlas`, bakedIndex.imagePng)
        .then((crispTex) => {
          AssetLoader.applyPixelArtTextureSettings(crispTex);
          this.bakedAtlasTexture = crispTex;
          for (const mat of this.activeMaterials) {
            mat.map = crispTex;
            mat.needsUpdate = true;
          }
        })
        .catch(() => {
          // Keep initialTex
        });
    }
  }

  private buildSynchronousFallbackAtlasCanvas(bakedIndex: ReturnType<typeof GlobalTileRegistry.getBakedAtlasIndex>): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = bakedIndex.atlasWidth;
    canvas.height = bakedIndex.atlasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const colorMap: Record<string, [string, string]> = {
      'Outside_A1:0': ['#1d84c9', '#38bdf8'],
      'Outside_A1:1': ['#1668a8', '#7dd3fc'],
      'Outside_A2:0': ['#5cbf5a', '#4da84b'],
      'Outside_A2:1': ['#3b8e3e', '#28662b'],
      'Outside_A2:2': ['#d4a359', '#b8863d'],
      'Outside_A2:3': ['#f2d58c', '#dec076'],
      'Outside_A2:4': ['#5cbf5a', '#f472b6'],
      'Outside_A3:0': ['#f3e5c8', '#6e4726'],
      'Outside_A3:1': ['#1e7a6d', '#135249'],
      'Dungeon_A4:0': ['#475569', '#334155'],
      'Outside_A5:0': ['#94a3b8', '#64748b'],
      'Inside_A5:0': ['#7a4c2a', '#5e381d'],
      'Inside_A5:1': ['#991b1b', '#d97706'],
      'Dungeon_A5:0': ['#3b3648', '#2a2636'],
      'Outside_B:0': ['#5c3a1e', '#1e6f40'],
      'Outside_B:1': ['#1e6f40', '#2ea85d'],
      'Outside_B:2': ['#64748b', '#475569'],
      'Outside_B:3': ['#4ade80', '#f472b6'],
      'Outside_B:4': ['#6b3e23', '#d97706'],
    };

    for (const [ref, entry] of Object.entries(bakedIndex.variants)) {
      const shortKey = ref.replace(/^pack:[^:]+:/, '');
      const [bg, detail] = colorMap[shortKey] || ['#5cbf5a', '#4da84b'];
      const frames = entry.animatedFrames || 1;
      for (const rect of Object.values(entry.shapes)) {
        for (let f = 0; f < frames; f++) {
          const rx = rect.x + f * bakedIndex.stride;
          const ry = rect.y;
          ctx.fillStyle = bg;
          ctx.fillRect(rx - 1, ry - 1, rect.w + 2, rect.h + 2);
          ctx.fillStyle = detail;
          ctx.fillRect(rx + 6, ry + 6, 8, 8);
          ctx.fillRect(rx + 28, ry + 26, 10, 10);
        }
      }
    }

    return canvas;
  }

  public getBakedAtlasTexture(): THREE.Texture {
    if (!this.bakedAtlasTexture) {
      this.initBakedTexture();
    }
    return this.bakedAtlasTexture!;
  }

  /**
   * Configura el tinte de coherencia de marca según la categoría/bioma del mapa actual (Bloque 44 Req. 5).
   */
  public applyBiomeTintForCategory(category: MapData['category']): void {
    const tints = (artConfigJson.biomeTints || {}) as Record<string, { color: string; strength: number }>;
    const entry = tints[category] || tints.town || { color: '#fff8eb', strength: 0.08 };
    this.biomeTintColorUniform.value.set(entry.color);
    this.biomeTintStrengthUniform.value = entry.strength;
  }

  /**
   * Crea un material con:
   * - `alphaTest: 0.5`
   * - `polygonOffset` para evitar z-fighting
   * - `onBeforeCompile` para desplazar UV de agua animada (A1 de 3 frames) mediante uniform de tiempo
   *   y aplicar el tinte de coherencia de marca por bioma sin tocar la CPU.
   */
  public createTileMaterial(options: {
    texture?: THREE.Texture;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
    depthWrite?: boolean;
  } = {}): THREE.MeshStandardMaterial {
    const tex = options.texture || this.getBakedAtlasTexture();
    AssetLoader.applyPixelArtTextureSettings(tex);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.88,
      metalness: 0.05,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: options.polygonOffsetFactor ?? 1,
      polygonOffsetUnits: options.polygonOffsetUnits ?? 1,
      depthWrite: options.depthWrite ?? true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = this.waterTimeUniform;
      shader.uniforms.uBiomeTint = this.biomeTintColorUniform;
      shader.uniforms.uBiomeTintStrength = this.biomeTintStrengthUniform;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        attribute float aAnimStrideU;
        uniform float uWaterTime;
        varying float vAnimOffsetU;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        float animFrame = floor(mod(uWaterTime * 2.5, 3.0));
        vAnimOffsetU = aAnimStrideU * animFrame;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uBiomeTint;
        uniform float uBiomeTintStrength;
        varying float vAnimOffsetU;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv + vec2(vAnimOffsetU, 0.0) );
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * uBiomeTint, uBiomeTintStrength);
          diffuseColor *= sampledDiffuseColor;
        #endif`
      );
    };

    this.activeMaterials.push(mat);
    return mat;
  }

  /**
   * Construye toda la geometría del mapa en chunks de 16x16 para el suelo (A1, A2, A5)
   * y planos verticales/billboards para fachadas (A3/A4) y objetos (B-E).
   */
  public buildMapGeometry(map: MapData): BuiltTileMapResult {
    this.applyBiomeTintForCategory(map.category);

    const groundGroup = new THREE.Group();
    groundGroup.name = 'TileRenderer_GroundChunks';

    const facadeAndPropsGroup = new THREE.Group();
    facadeAndPropsGroup.name = 'TileRenderer_FacadesAndProps';

    const starOverlayGroup = new THREE.Group();
    starOverlayGroup.name = 'TileRenderer_StarOverlay';

    const billboardMeshes: THREE.Mesh[] = [];
    const occludableEntries: { x: number; z: number; meshes: THREE.Mesh[] }[] = [];
    this.pendingContactShadows.clear();

    const W = map.width;
    const H = map.height;

    // 1. Pre-resolve all ground tile references
    const resolvedGround: ResolvedTileReference[][] = [];
    for (let y = 0; y < H; y++) {
      const row: ResolvedTileReference[] = [];
      for (let x = 0; x < W; x++) {
        const rawCell = map.ground[y]?.[x] || 'grass';
        const hasEncounterGrass = map.encounters?.[y]?.[x] === 'tall_grass';
        const effectiveRaw = (hasEncounterGrass || rawCell === 'tall_grass') ? 'grass' : rawCell;
        row.push(GlobalTileRegistry.resolveTile(String(effectiveRaw), 'ground', map.category));
      }
      resolvedGround.push(row);
    }

    // 2. Build merged 16x16 ground chunks (Bloque 44 Req. 5 & 8)
    const CHUNK_SIZE = 16;
    const chunkMat = this.createTileMaterial({
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    let chunkCount = 0;
    for (let cy = 0; cy < H; cy += CHUNK_SIZE) {
      for (let cx = 0; cx < W; cx += CHUNK_SIZE) {
        const maxY = Math.min(H, cy + CHUNK_SIZE);
        const maxX = Math.min(W, cx + CHUNK_SIZE);

        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const animStrides: number[] = [];
        const indices: number[] = [];
        let vertexOffset = 0;

        for (let y = cy; y < maxY; y++) {
          for (let x = cx; x < maxX; x++) {
            const resolved = resolvedGround[y][x];

            // Compute autotile shape [0..46] using pure /systems/maps/autotile.ts
            const shapeIndex = resolved.flags.autotile
              ? resolveGridAutotileShape47(
                  resolvedGround,
                  x,
                  y,
                  (a, b) => a.canonicalRef === b.canonicalRef
                )
              : 0;

            const uvRegion = GlobalTileRegistry.getAtlasRegion(resolved.canonicalRef, shapeIndex, 0);
            if (!uvRegion) continue;

            const { frameStrideU } = GlobalTileRegistry.getFrameStrideU(resolved.canonicalRef);
            const isWater = resolved.flags.category === 'water';
            const posY = isWater && !this.classicFlatMode ? -0.04 : 0;

            // Micro-overlap (0.0005) eliminates subpixel rasterizer seams between adjacent ground tiles
            const SEAM_OVERLAP = 0.0005;
            const x0 = x - 0.5 - SEAM_OVERLAP;
            const x1 = x + 0.5 + SEAM_OVERLAP;
            const z0 = y - 0.5 - SEAM_OVERLAP;
            const z1 = y + 0.5 + SEAM_OVERLAP;

            // 4 vertices for tile quad on XZ plane
            positions.push(
              x0, posY, z0,
              x1, posY, z0,
              x0, posY, z1,
              x1, posY, z1
            );

            normals.push(
              0, 1, 0,
              0, 1, 0,
              0, 1, 0,
              0, 1, 0
            );

            uvs.push(
              uvRegion.u0, uvRegion.v1,
              uvRegion.u1, uvRegion.v1,
              uvRegion.u0, uvRegion.v0,
              uvRegion.u1, uvRegion.v0
            );

            animStrides.push(frameStrideU, frameStrideU, frameStrideU, frameStrideU);

            indices.push(
              vertexOffset, vertexOffset + 2, vertexOffset + 1,
              vertexOffset + 1, vertexOffset + 2, vertexOffset + 3
            );
            vertexOffset += 4;
          }
        }

        if (vertexOffset > 0) {
          const chunkGeo = new THREE.BufferGeometry();
          chunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          chunkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          chunkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
          chunkGeo.setAttribute('aAnimStrideU', new THREE.Float32BufferAttribute(animStrides, 1));
          chunkGeo.setIndex(indices);
          chunkGeo.computeBoundingSphere();

          const chunkMesh = new THREE.Mesh(chunkGeo, chunkMat);
          chunkMesh.name = `GroundChunk_${cx}_${cy}`;
          chunkMesh.receiveShadow = true;
          chunkMesh.renderOrder = 0;
          groundGroup.add(chunkMesh);
          chunkCount++;
        }
      }
    }

    // 2b. BLOQUE 45 Diagnóstico & Req. 3: Falda de horizonte exterior (outerHorizonPaddingTiles = 16)
    //     Evita que jamás se vea vacío (cielo cian) detrás del borde del mapa al acercarse a los límites o rotar la cámara.
    if (!map.indoor) {
      this.buildOuterHorizonSkirt(map, groundGroup, facadeAndPropsGroup, billboardMeshes, chunkMat);
      this.buildWaterShoreFoam(map, groundGroup);
    }

    // 2c. BLOQUE 45 Req. 1: Si estamos en Etapa 1 (Blockout en gris) o Etapa 2 (Caminos e hitos), añadir overlay de blockout/guía
    if (this.authoringStage === 1 || this.authoringStage === 2) {
      this.buildAuthoringBlockoutOverlay(map, groundGroup, facadeAndPropsGroup);
      if (this.authoringStage === 1 || this.authoringStage === 2) {
        return {
          groundGroup,
          facadeAndPropsGroup,
          starOverlayGroup,
          billboardMeshes,
          occludableEntries,
          chunkCount,
        };
      }
    }

    // 3. Build Architectural Buildings (with pitched roof, eaves overhang, windows, chimney & contact shadow)
    //    and Facades (A3/A4) + Objects (B-E) from map.decor
    if (map.decor) {
      const propMat = this.createTileMaterial({
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });

      const starMat = this.createTileMaterial({
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        depthWrite: false,
      });

      // Detect rectangular building footprints (roof + building_wall + door) so they render as cohesive 2.5D cottages
      // with pitched roofs, eaves overhangs, warm windows, chimneys, and contact shadows (Bloque 45 Diagnóstico & Req. 3)
      const handledBuildingTiles = this.buildArchitecturalHouses(
        map,
        facadeAndPropsGroup,
        starOverlayGroup,
        occludableEntries
      );

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const rawDecor = map.decor[y]?.[x];
          if (!rawDecor) continue;
          if (handledBuildingTiles.has(`${x}_${y}`)) continue;

          // En Etapa 3 (Edificios y stamps), mostrar solo arquitectura/muros/puertas; ocultar árboles y rocas de terreno/scatter
          if (
            this.authoringStage === 3 &&
            rawDecor !== 'wall' &&
            rawDecor !== 'building_wall' &&
            rawDecor !== 'roof' &&
            rawDecor !== 'door'
          ) {
            continue;
          }

          // Skip procedural building blocks for the special Taller, Mercado and Lab custom facades in villa_brote
          if (map.id === 'villa_brote') {
            if (
              (x >= 4 && x <= 11 && y >= 11 && y <= 15) ||
              (x >= 24 && x <= 31 && y >= 11 && y <= 15) ||
              (x >= 25 && x <= 31 && y >= 3 && y <= 7)
            ) {
              continue;
            }
          }

          // Skip custom interior props in interior_center and interior_shop that are handled by TallerAtlas/MercadoAtlas
          if ((map.id === 'interior_center' || map.id === 'interior_shop') && rawDecor !== 'wall' && rawDecor !== 'carpet' && rawDecor !== 'door') {
            continue;
          }

          const resolved = GlobalTileRegistry.resolveTile(rawDecor, 'decor');
          const shapeIndex = resolved.flags.autotile
            ? resolveGridWallShape16(map.decor, x, y, (a, b) => a === b)
            : 0;

          const uvRegion = GlobalTileRegistry.getAtlasRegion(resolved.canonicalRef, shapeIndex, 0);
          if (!uvRegion) continue;

          // Modo "plano clásico" (debug): dibuja todo plano sobre el suelo como en RPG Maker
          if (this.classicFlatMode) {
            const flatGeo = this.createQuadGeometryWithUV(1, 1, uvRegion, true);
            const flatMesh = new THREE.Mesh(flatGeo, resolved.flags.star ? starMat : propMat);
            flatMesh.position.set(x, resolved.flags.star ? 0.03 : 0.015, y);
            flatMesh.renderOrder = resolved.flags.star ? 25 : 2;
            (resolved.flags.star ? starOverlayGroup : facadeAndPropsGroup).add(flatMesh);
            continue;
          }

          // Alfombras o suelos interiores superpuestos (Inside_A5:1)
          if (rawDecor === 'carpet') {
            const carpetGeo = this.createQuadGeometryWithUV(1, 1, uvRegion, true);
            const carpetMesh = new THREE.Mesh(carpetGeo, propMat);
            carpetMesh.position.set(x, 0.008, y);
            carpetMesh.renderOrder = 1;
            facadeAndPropsGroup.add(carpetMesh);
            continue;
          }

          // Fachadas y muros (A3 / A4): planos verticales con pivote en la base, giran con yaw de cámara y rotation.x pequeña
          if (resolved.flags.category === 'facades') {
            const wallH = resolved.flags.wallHeight || 1.35;
            const wallGeo = this.createQuadGeometryWithUV(1.02, wallH, uvRegion, false);
            const wallMesh = new THREE.Mesh(wallGeo, resolved.flags.star ? starMat : propMat);
            wallMesh.position.set(x, resolved.flags.star ? 1.15 : 0, y);
            wallMesh.rotation.x = -0.08;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            wallMesh.renderOrder = resolved.flags.star ? 25 : 5;

            billboardMeshes.push(wallMesh);
            occludableEntries.push({ x, z: y, meshes: [wallMesh] });
            (resolved.flags.star ? starOverlayGroup : facadeAndPropsGroup).add(wallMesh);
            continue;
          }

          // Objetos B-E (árboles, rocas, flores, mobiliario): billboards verticales con pivote en los pies
          // Bloque 45 Req. 3: Escala fija (árboles 2x3 a 3x4 con variación de copas superpuestas y sombra de contacto;
          // rocas ~1.1x1.05 con sombra de contacto; arbustos <= 1 tile).
          const propGroup = new THREE.Group();
          propGroup.position.set(x, 0, y);

          const isTree = rawDecor === 'tree' || Boolean(resolved.flags.upperStarTile);
          const isRock = rawDecor === 'rock';
          const hashVal = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          const variantIdx = hashVal % 3;
          const canopyScaleVar = (scaleConfigJson.scales.tree.canopyVariants || [0.92, 1.0, 1.12])[variantIdx] || 1.0;

          // Sombra de contacto suave bajo árboles y rocas (Bloque 45 Req. 3)
          if (isTree || isRock) {
            const shadowRadius = isTree
              ? scaleConfigJson.scales.tree.contactShadowRadius * canopyScaleVar
              : scaleConfigJson.scales.rock.contactShadowRadius;
            this.addContactShadow(shadowRadius * 2, shadowRadius * 1.65, 0.36, x, 0.012, y);
          }

          const baseW = isTree
            ? 1.55 * canopyScaleVar
            : isRock
            ? scaleConfigJson.scales.rock.widthTiles
            : resolved.flags.multiTile
            ? 1.25
            : 0.95;
          const baseH = isTree
            ? 1.65 * canopyScaleVar
            : isRock
            ? scaleConfigJson.scales.rock.heightTiles
            : resolved.flags.multiTile
            ? 1.25
            : 0.95;

          const baseGeo = this.createQuadGeometryWithUV(baseW, baseH, uvRegion, false);
          const baseMesh = new THREE.Mesh(baseGeo, resolved.flags.star ? starMat : propMat);
          baseMesh.rotation.x = -0.06;
          baseMesh.castShadow = true;
          baseMesh.receiveShadow = true;
          baseMesh.renderOrder = resolved.flags.star ? 25 : 6;
          propGroup.add(baseMesh);
          billboardMeshes.push(baseMesh);

          const groupMeshes: THREE.Mesh[] = [baseMesh];

          if (resolved.flags.upperStarTile) {
            const upperRef = `pack:${resolved.packId || 'anima_core'}:${resolved.flags.upperStarTile}`;
            const upperUV = GlobalTileRegistry.getAtlasRegion(upperRef, 0, 0);
            if (upperUV) {
              // Copa principal a escala 2x3 .. 3x4 tiles (Bloque 45 Req. 3)
              const canopyW = 2.35 * canopyScaleVar;
              const canopyH = 1.95 * canopyScaleVar;
              const starCanopyGeo = this.createQuadGeometryWithUV(canopyW, canopyH, upperUV, false);
              starCanopyGeo.translate(0, 1.25 * canopyScaleVar, 0.02);
              const starCanopyMesh = new THREE.Mesh(starCanopyGeo, starMat);
              starCanopyMesh.rotation.x = -0.06;
              starCanopyMesh.renderOrder = 25;
              propGroup.add(starCanopyMesh);
              billboardMeshes.push(starCanopyMesh);
              groupMeshes.push(starCanopyMesh);

              // Segunda capa de copa superpuesta ligeramente desplazada para dar volumen y variación orgánica
              const overlapCanopyGeo = this.createQuadGeometryWithUV(canopyW * 0.84, canopyH * 0.78, upperUV, false);
              const offsetX = ((hashVal % 5) - 2) * 0.07;
              overlapCanopyGeo.translate(offsetX, 1.55 * canopyScaleVar, 0.05);
              const overlapCanopyMesh = new THREE.Mesh(overlapCanopyGeo, starMat);
              overlapCanopyMesh.rotation.x = -0.06;
              overlapCanopyMesh.renderOrder = 26;
              propGroup.add(overlapCanopyMesh);
              billboardMeshes.push(overlapCanopyMesh);
              groupMeshes.push(overlapCanopyMesh);
            }
          }

          occludableEntries.push({ x, z: y, meshes: groupMeshes });
          facadeAndPropsGroup.add(propGroup);
        }
      }
    }

    this.flushContactShadows(facadeAndPropsGroup);

    return {
      groundGroup,
      facadeAndPropsGroup,
      starOverlayGroup,
      billboardMeshes,
      occludableEntries,
      chunkCount,
    };
  }

  /**
   * BLOQUE 45 Diagnóstico & Req. 3:
   * Construye el cinturón de horizonte exterior (outerHorizonPaddingTiles = 16) alrededor del mapa
   * continuando el terreno base (hierba, agua costera o roca alpina) y poblando siluetas de bosque/acantilado
   * para que jamás se vea el vacío (cielo cian) detrás de los bordes.
   */
  private buildOuterHorizonSkirt(
    map: MapData,
    groundGroup: THREE.Group,
    facadeAndPropsGroup: THREE.Group,
    billboardMeshes: THREE.Mesh[],
    chunkMat: THREE.MeshStandardMaterial
  ): void {
    const pad = scaleConfigJson.navigation.outerHorizonPaddingTiles || 16;
    const W = map.width;
    const H = map.height;

    const grassResolved = GlobalTileRegistry.resolveTile('grass', 'ground', map.category);
    const waterResolved = GlobalTileRegistry.resolveTile('water', 'ground', map.category);
    const grassUV = GlobalTileRegistry.getAtlasRegion(grassResolved.canonicalRef, 46, 0);
    const waterUV = GlobalTileRegistry.getAtlasRegion(waterResolved.canonicalRef, 46, 0);
    if (!grassUV) return;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const animStrides: number[] = [];
    const indices: number[] = [];
    let vOff = 0;

    const { frameStrideU: waterStrideU } = GlobalTileRegistry.getFrameStrideU(waterResolved.canonicalRef);

    for (let y = -pad; y < H + pad; y++) {
      for (let x = -pad; x < W + pad; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) continue;

        // En Puerto Marea (pueblo_costero), el borde sur continúa como océano infinito
        const isSouthOcean = map.id === 'pueblo_costero' && y >= 15;
        const uv = isSouthOcean && waterUV ? waterUV : grassUV;
        const posY = isSouthOcean ? -0.04 : -0.005;
        const stride = isSouthOcean ? waterStrideU : 0;

        const x0 = x - 0.5;
        const x1 = x + 0.5;
        const z0 = y - 0.5;
        const z1 = y + 0.5;

        positions.push(x0, posY, z0, x1, posY, z0, x0, posY, z1, x1, posY, z1);
        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uvs.push(uv.u0, uv.v1, uv.u1, uv.v1, uv.u0, uv.v0, uv.u1, uv.v0);
        animStrides.push(stride, stride, stride, stride);
        indices.push(vOff, vOff + 2, vOff + 1, vOff + 1, vOff + 2, vOff + 3);
        vOff += 4;
      }
    }

    if (vOff > 0) {
      const skirtGeo = new THREE.BufferGeometry();
      skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      skirtGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      skirtGeo.setAttribute('aAnimStrideU', new THREE.Float32BufferAttribute(animStrides, 1));
      skirtGeo.setIndex(indices);
      skirtGeo.computeBoundingSphere();

      const skirtMesh = new THREE.Mesh(skirtGeo, chunkMat);
      skirtMesh.name = 'OuterHorizonSkirt';
      skirtMesh.receiveShadow = true;
      groundGroup.add(skirtMesh);
    }

    // Poblar árboles/rocas densos escalonados en el cinturón exterior (-6..W+5, -6..H+5)
    if (this.authoringStage >= 1 && this.authoringStage <= 3) return;
    const outerDecorType = map.id === 'ruta_montana' ? 'rock' : 'tree';
    const resolvedOuter = GlobalTileRegistry.resolveTile(outerDecorType, 'decor');
    const baseUV = GlobalTileRegistry.getAtlasRegion(resolvedOuter.canonicalRef, 0, 0);
    if (!baseUV) return;

    const propMat = this.createTileMaterial({ polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const starMat = this.createTileMaterial({ polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    const upperUV = resolvedOuter.flags.upperStarTile
      ? GlobalTileRegistry.getAtlasRegion(`pack:${resolvedOuter.packId || 'anima_core'}:${resolvedOuter.flags.upperStarTile}`, 0, 0)
      : null;

    for (let y = -6; y < H + 6; y += 2) {
      for (let x = -6; x < W + 6; x += 2) {
        if (x >= 0 && x < W && y >= 0 && y < H) continue;
        if (map.id === 'pueblo_costero' && y >= 14) continue;

        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (h % 4 === 0) continue;

        const scaleV = 0.95 + (h % 3) * 0.1;
        const jx = x + ((h % 5) - 2) * 0.18;
        const jy = y + (((h >> 3) % 5) - 2) * 0.18;

        const g = new THREE.Group();
        g.position.set(jx, 0, jy);

        const bGeo = this.createQuadGeometryWithUV(1.5 * scaleV, 1.6 * scaleV, baseUV, false);
        const bMesh = new THREE.Mesh(bGeo, propMat);
        bMesh.rotation.x = -0.06;
        g.add(bMesh);
        billboardMeshes.push(bMesh);

        if (upperUV) {
          const cGeo = this.createQuadGeometryWithUV(2.3 * scaleV, 1.9 * scaleV, upperUV, false);
          cGeo.translate(0, 1.2 * scaleV, 0.02);
          const cMesh = new THREE.Mesh(cGeo, starMat);
          cMesh.rotation.x = -0.06;
          cMesh.renderOrder = 25;
          g.add(cMesh);
          billboardMeshes.push(cMesh);
        }

        facadeAndPropsGroup.add(g);
      }
    }
  }

  /**
   * BLOQUE 45 Req. 3: Espuma animada en las orillas del agua (waterShoreFoamWidthTiles = 0.26)
   */
  private buildWaterShoreFoam(map: MapData, groundGroup: THREE.Group): void {
    const W = map.width;
    const H = map.height;
    const foamW = scaleConfigJson.lighting.waterShoreFoamWidthTiles || 0.26;
    const positions: number[] = [];
    const indices: number[] = [];
    let vOff = 0;

    const pushFoamStrip = (x0: number, z0: number, x1: number, z1: number) => {
      const y = 0.006;
      positions.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      indices.push(vOff, vOff + 2, vOff + 1, vOff + 1, vOff + 2, vOff + 3);
      vOff += 4;
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (map.ground[y]?.[x] !== 'water') continue;
        // North shore
        if (y > 0 && map.ground[y - 1]?.[x] !== 'water') {
          pushFoamStrip(x - 0.5, y - 0.5, x + 0.5, y - 0.5 + foamW);
        }
        // South shore
        if (y < H - 1 && map.ground[y + 1]?.[x] !== 'water') {
          pushFoamStrip(x - 0.5, y + 0.5 - foamW, x + 0.5, y + 0.5);
        }
        // West shore
        if (x > 0 && map.ground[y]?.[x - 1] !== 'water') {
          pushFoamStrip(x - 0.5, y - 0.5, x - 0.5 + foamW, y + 0.5);
        }
        // East shore
        if (x < W - 1 && map.ground[y]?.[x + 1] !== 'water') {
          pushFoamStrip(x + 0.5 - foamW, y - 0.5, x + 0.5, y + 0.5);
        }
      }
    }

    if (vOff === 0) return;

    const foamGeo = new THREE.BufferGeometry();
    foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    foamGeo.setIndex(indices);
    foamGeo.computeBoundingSphere();

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fe,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.name = 'WaterShoreFoam';
    foamMesh.renderOrder = 2;
    groundGroup.add(foamMesh);
  }

  /**
   * BLOQUE 45 Diagnóstico & Req. 3:
   * Detecta las huellas de edificios en `map.decor` (excepto los dos edificios custom con atlas propio en villa_brote)
   * y construye edificios 2.5D completos a escala coherente (casas pequeñas 5x4, medianas 6x5, hitos 7x5) con:
   * - Sombra de contacto suave bajo toda la huella
   * - Muros con textura de entramado/piedra y vigas de esquina
   * - Tejado inclinado a dos aguas con aleros que sobresalen (overhangTiles)
   * - Ventanas con marco y luz cálida interior
   * - Chimenea en el tejado
   * - Puerta de 1 tile centrada en la entrada
   */
  private buildArchitecturalHouses(
    map: MapData,
    facadeAndPropsGroup: THREE.Group,
    starOverlayGroup: THREE.Group,
    occludableEntries: { x: number; z: number; meshes: THREE.Mesh[] }[]
  ): Set<string> {
    const handled = new Set<string>();
    if (map.indoor || !map.decor || this.classicFlatMode) return handled;

    const W = map.width;
    const H = map.height;
    const visited = Array.from({ length: H }, () => Array.from({ length: W }, () => false));

    const isBuildingTile = (x: number, y: number) => {
      const d = map.decor?.[y]?.[x];
      return d === 'roof' || d === 'building_wall' || d === 'door';
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isBuildingTile(x, y) || visited[y][x]) continue;

        // Flood-fill contiguous building footprint
        let minX = x, maxX = x, minY = y, maxY = y;
        let doorX = -1, doorY = -1;
        const cells: [number, number][] = [];
        const q: [number, number][] = [[x, y]];
        visited[y][x] = true;

        while (q.length > 0) {
          const [cx, cy] = q.shift()!;
          cells.push([cx, cy]);
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          if (map.decor?.[cy]?.[cx] === 'door') {
            doorX = cx;
            doorY = cy;
          }
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && !visited[ny][nx] && isBuildingTile(nx, ny)) {
              visited[ny][nx] = true;
              q.push([nx, ny]);
            }
          }
        }

        // Skip custom landmark buildings in villa_brote / aldea_marioneta / landmarkHints that are built by MapRenderer
        if (map.id === 'villa_brote' || map.id === 'aldea_marioneta' || map.landmarkHints) {
          const hints = map.landmarkHints;
          const matchesDoorHint = (door?: { x: number; y: number }) =>
            Boolean(door && door.x >= minX && door.x <= maxX && door.y >= minY && door.y <= maxY);

          const isWorkshop = hints
            ? matchesDoorHint(hints.workshopDoor)
            : minX <= 12 && minY >= 10 && minY <= 16;
          const isMarket = hints
            ? matchesDoorHint(hints.marketDoor)
            : minX >= 23 && minY >= 10 && minY <= 16;
          const isLab = hints
            ? matchesDoorHint(hints.labDoor)
            : minX >= 23 && minY >= 2 && minY <= 8;

          if (isWorkshop || isMarket || isLab) {
            for (const [cx, cy] of cells) handled.add(`${cx}_${cy}`);
            continue;
          }
        }

        for (const [cx, cy] of cells) {
          handled.add(`${cx}_${cy}`);
        }

        const bw = maxX - minX + 1;
        const bd = maxY - minY + 1;
        const centerX = (minX + maxX) / 2;
        const centerZ = (minY + maxY) / 2;

        // Seleccionar escala de /data/config/scale.json según dimensiones de la huella
        const scaleSpec =
          bw >= 7
            ? scaleConfigJson.scales.building_landmark
            : bw === 6
            ? scaleConfigJson.scales.house_medium
            : scaleConfigJson.scales.house_small;

        const wallH = scaleSpec.wallHeightTiles;
        const roofH = scaleSpec.roofPitchHeightTiles;
        const overhang = scaleSpec.overhangTiles;

        const houseGroup = new THREE.Group();
        houseGroup.name = `ArchitecturalHouse_${minX}_${minY}`;
        const occludableMeshes: THREE.Mesh[] = [];

        // 1. Sombra de contacto bajo el edificio (Bloque 45 Req. 3)
        const shadowPad = scaleSpec.contactShadowPadding || 0.4;
        this.addContactShadow(bw + shadowPad * 2, bd + shadowPad * 2, 0.44, centerX, 0.01, centerZ);

        // 2. Cuerpo de paredes según estilo arquitectónico de la referencia
        const isRightWoodHouse = map.id === 'villa_brote' && minX >= 16;
        const wallColor = isRightWoodHouse ? 0x854d0e : bw >= 7 ? 0xe2e8f0 : bw === 6 ? 0xfef08a : 0xfef9c3;
        const wallMat = new THREE.MeshStandardMaterial({
          color: wallColor,
          roughness: 0.85,
          metalness: 0.04,
        });
        const wallGeo = new THREE.BoxGeometry(bw, wallH, bd);
        wallGeo.translate(0, wallH / 2, 0);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(centerX, 0, centerZ);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        houseGroup.add(wallMesh);
        occludableMeshes.push(wallMesh);

        // Zócalo de piedra inferior y vigas de madera
        const plinthMat = new THREE.MeshStandardMaterial({ color: isRightWoodHouse ? 0x451a03 : 0x64748b, roughness: 0.9 });
        const plinthGeo = new THREE.BoxGeometry(bw + 0.06, 0.32, bd + 0.06);
        plinthGeo.translate(0, 0.16, 0);
        const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
        plinthMesh.position.set(centerX, 0, centerZ);
        houseGroup.add(plinthMesh);
        occludableMeshes.push(plinthMesh);

        // 3. Tejado a dos aguas (Paja dorada en casas de la izquierda, teja marrón en casas de la derecha)
        const isLeftThatchedHouse = map.id === 'villa_brote' && minX < 12;
        const roofColor = isLeftThatchedHouse
          ? 0xca8a04
          : isRightWoodHouse
          ? 0x78350f
          : bw >= 7
          ? 0x1e40af
          : bw === 6
          ? 0x1e7a6d
          : 0xb45309;
        const roofMat = new THREE.MeshStandardMaterial({
          color: roofColor,
          roughness: 0.72,
          metalness: 0.08,
        });
        const roofW = bw + overhang * 2;
        const roofD = bd + overhang * 2;
        const slopeLen = Math.hypot(roofD / 2, roofH);
        const slopeAngle = Math.atan2(roofH, roofD / 2);

        const frontSlopeGeo = new THREE.BoxGeometry(roofW, 0.14, slopeLen);
        const frontSlope = new THREE.Mesh(frontSlopeGeo, roofMat);
        frontSlope.position.set(centerX, wallH + roofH / 2, centerZ + roofD / 4);
        frontSlope.rotation.x = slopeAngle;
        frontSlope.castShadow = true;
        frontSlope.renderOrder = 25;
        starOverlayGroup.add(frontSlope);
        occludableMeshes.push(frontSlope);

        const backSlope = new THREE.Mesh(frontSlopeGeo, roofMat);
        backSlope.position.set(centerX, wallH + roofH / 2, centerZ - roofD / 4);
        backSlope.rotation.x = -slopeAngle;
        backSlope.castShadow = true;
        backSlope.renderOrder = 25;
        starOverlayGroup.add(backSlope);
        occludableMeshes.push(backSlope);

        // Cumbrera de madera/bronce en el vértice del tejado
        const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });
        const ridgeGeo = new THREE.BoxGeometry(roofW + 0.08, 0.18, 0.22);
        const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridgeMesh.position.set(centerX, wallH + roofH + 0.04, centerZ);
        ridgeMesh.renderOrder = 25;
        starOverlayGroup.add(ridgeMesh);
        occludableMeshes.push(ridgeMesh);

        // 4. Chimenea de ladrillo/piedra en el tejado (Bloque 45 Diagnóstico & Req. 3)
        if (scaleSpec.hasChimney) {
          const chimMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.88 });
          const chimGeo = new THREE.BoxGeometry(0.55, 0.95, 0.55);
          const chimMesh = new THREE.Mesh(chimGeo, chimMat);
          chimMesh.position.set(maxX - 0.7, wallH + roofH * 0.75, minY + 0.8);
          chimMesh.castShadow = true;
          chimMesh.renderOrder = 25;
          starOverlayGroup.add(chimMesh);
          occludableMeshes.push(chimMesh);
        }

        // 5. Puerta de 1 tile (1.0 x 1.35 tiles) y Ventanas iluminadas en la fachada frontal (sur)
        const frontZ = maxY + 0.51;
        const effectiveDoorX = doorX >= 0 ? doorX : Math.round(centerX);

        const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
        const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
        const doorW = scaleConfigJson.scales.door.widthTiles;
        const doorH = scaleConfigJson.scales.door.heightTiles;

        const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), doorLeafMat);
        doorMesh.position.set(effectiveDoorX, doorH / 2, frontZ);
        houseGroup.add(doorMesh);
        occludableMeshes.push(doorMesh);

        // Alero/Pórtico sobre la puerta
        const awningMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.38), doorFrameMat);
        awningMesh.position.set(effectiveDoorX, doorH + 0.08, frontZ + 0.12);
        houseGroup.add(awningMesh);
        occludableMeshes.push(awningMesh);

        // Ventanas cálidas a ambos lados de la puerta
        if (scaleSpec.hasWindows) {
          const winGlassMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.65,
            roughness: 0.2,
          });
          for (let wx = minX + 1; wx <= maxX - 1; wx++) {
            if (Math.abs(wx - effectiveDoorX) <= 1) continue;
            const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.06), doorFrameMat);
            winFrame.position.set(wx, wallH * 0.58, frontZ);
            const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.08), winGlassMat);
            winGlass.position.set(wx, wallH * 0.58, frontZ + 0.01);
            houseGroup.add(winFrame, winGlass);
            occludableMeshes.push(winFrame, winGlass);
          }
        }

        facadeAndPropsGroup.add(houseGroup);
        occludableEntries.push({ x: Math.round(centerX), z: maxY, meshes: occludableMeshes });
      }
    }

    return handled;
  }

  /**
   * B48 P1 — Sombras de contacto (Bloque 45 Req. 3) fusionadas.
   * Antes cada árbol/roca/casa creaba su propia `Mesh` + `MeshBasicMaterial`
   * (hasta 144 draw calls por mapa y un material huérfano por warp).
   * Ahora se acumulan las geometrías y se funden en UNA malla por opacidad.
   */
  private addContactShadow(
    width: number,
    depth: number,
    opacity: number,
    worldX: number,
    worldY: number,
    worldZ: number
  ): void {
    const geo = new THREE.CircleGeometry(0.5, 20);
    geo.rotateX(-Math.PI / 2);
    geo.scale(width, 1, depth);
    geo.translate(worldX, worldY, worldZ);
    const list = this.pendingContactShadows.get(opacity);
    if (list) list.push(geo);
    else this.pendingContactShadows.set(opacity, [geo]);
  }

  /** Fusiona los lotes pendientes y añade 1 malla por opacidad al grupo dado. */
  private flushContactShadows(target: THREE.Group): void {
    for (const [opacity, geos] of this.pendingContactShadows) {
      if (geos.length === 0) continue;
      const merged = this.mergeGeometries(geos);
      for (const g of geos) g.dispose();
      const mat = new THREE.MeshBasicMaterial({
        color: 0x090d16,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      this.pendingContactShadowMaterials.add(mat);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `ContactShadows_${String(opacity).replace('.', '')}`;
      mesh.renderOrder = 1;
      target.add(mesh);
    }
    this.pendingContactShadows.clear();
  }

  /** Fusión simple de geometrías con position/normal/uv + índice (todas círculos). */
  private mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let vertexCount = 0;
    let indexCount = 0;
    for (const g of geos) {
      vertexCount += g.attributes.position.count;
      indexCount += g.index ? g.index.count : g.attributes.position.count;
    }
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint32Array(indexCount);
    let vOff = 0;
    let iOff = 0;
    for (const g of geos) {
      const p = g.attributes.position.array as Float32Array;
      positions.set(p, vOff * 3);
      if (g.attributes.normal) normals.set(g.attributes.normal.array as Float32Array, vOff * 3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array as Float32Array, vOff * 2);
      const count = g.attributes.position.count;
      if (g.index) {
        const src = g.index.array;
        for (let i = 0; i < g.index.count; i++) indices[iOff + i] = src[i] + vOff;
        iOff += g.index.count;
      } else {
        for (let i = 0; i < count; i++) indices[iOff + i] = vOff + i;
        iOff += count;
      }
      vOff += count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();
    return merged;
  }

  /**
   * BLOQUE 45 Req. 1: Vista de BLOCKOUT en gris (Etapa 1) y Caminos + Hitos (Etapa 2) en F2
   */
  private buildAuthoringBlockoutOverlay(
    map: MapData,
    groundGroup: THREE.Group,
    facadeAndPropsGroup: THREE.Group
  ): void {
    const W = map.width;
    const H = map.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = map.ground[y]?.[x];
        const isEnc = map.encounters?.[y]?.[x] === 'tall_grass';
        const isBlocked = map.collision[y]?.[x];
        const d = map.decor?.[y]?.[x];

        // Color de blockout semántico (Etapa 1: tonos grises/pizarra; Etapa 2: destaca caminos e hitos)
        let color = 0x64748b; // Suelo base gris neutro
        if (g === 'path' || g === 'cobble' || g === 'plaza') {
          color = this.authoringStage === 2 ? 0xfbbf24 : 0x94a3b8;
        } else if (g === 'water') {
          color = 0x334155;
        } else if (isEnc) {
          color = this.authoringStage === 2 ? 0x4ade80 : 0x475569;
        }

        const tileGeo = new THREE.PlaneGeometry(0.96, 0.96);
        tileGeo.rotateX(-Math.PI / 2);
        const tileMat = new THREE.MeshBasicMaterial({ color });
        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(x, 0.04, y);
        groundGroup.add(tileMesh);

        // Volúmenes de colisión en gris oscuro para ver el blockout espacial
        if (isBlocked || d === 'building_wall' || d === 'roof') {
          const boxH = d === 'roof' || d === 'building_wall' ? 1.6 : 0.9;
          const boxGeo = new THREE.BoxGeometry(0.92, boxH, 0.92);
          boxGeo.translate(0, boxH / 2, 0);
          const boxMat = new THREE.MeshStandardMaterial({
            color: d === 'roof' || d === 'building_wall' ? 0xcbd5e1 : 0x475569,
            roughness: 0.9,
          });
          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.position.set(x, 0.04, y);
          facadeAndPropsGroup.add(boxMesh);
        }
      }
    }

    // En Etapa 2, añadir balizas verticales sobre puntos de interés / signos / NPCs
    if (this.authoringStage === 2) {
      for (const s of map.signs || []) {
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 2.2, 12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        beacon.position.set(s.x, 1.1, s.y);
        facadeAndPropsGroup.add(beacon);
      }
    }
  }

  private createQuadGeometryWithUV(
    width: number,
    height: number,
    uvRegion: { u0: number; v0: number; u1: number; v1: number },
    flatOnGround: boolean
  ): THREE.PlaneGeometry {
    const geo = new THREE.PlaneGeometry(width, height);
    if (flatOnGround) {
      geo.rotateX(-Math.PI / 2);
    } else {
      // Pivote en la base / los pies
      geo.translate(0, height / 2, 0);
    }

    const uvs = new Float32Array([
      uvRegion.u0, uvRegion.v1,
      uvRegion.u1, uvRegion.v1,
      uvRegion.u0, uvRegion.v0,
      uvRegion.u1, uvRegion.v0,
    ]);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.attributes.uv.needsUpdate = true;
    return geo;
  }

  public update(dt: number, cameraYaw: number): void {
    this.waterTimeUniform.value += dt;
  }

  public clearMaterials(): void {
    for (const mat of this.activeMaterials) {
      mat.dispose();
    }
    this.activeMaterials = [];
    for (const mat of this.pendingContactShadowMaterials) {
      mat.dispose();
    }
    this.pendingContactShadowMaterials.clear();
  }
}

export const GlobalTileRenderer = TileRenderer.getInstance();
