import * as THREE from 'three';
import { MapData } from '../../types/maps';
import { GlobalAssetRegistry } from '../procedural/AssetRegistry';
import { TileType } from '../procedural/TileFactory';
import { GlobalTallerAtlas } from './TallerAtlas';
import { GlobalMercadoAtlas } from './MercadoAtlas';
import { GlobalOverworldDecor } from './DecorRenderer';
import { GlobalAtlasDebugOverlay } from './AtlasDebugOverlay';

interface DecorEntry {
  x: number;
  z: number;
  meshes: THREE.Mesh[];
}

interface AnimatedLantern {
  mesh: THREE.Mesh;
  light?: THREE.PointLight;
  baseScale: number;
  baseAlpha: number;
  speed: number;
  phase: number;
}

interface AnimatedSign {
  mesh: THREE.Mesh;
  baseRotationZ: number;
  speed: number;
}

export class MapRenderer {
  public mapGroup: THREE.Group;
  private currentMap: MapData | null = null;

  private tallGrassGroup: THREE.Group = new THREE.Group();
  private decorEntries: DecorEntry[] = [];
  private billboardProps: THREE.Mesh[] = [];
  private animatedSouls: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  private animatedLanterns: AnimatedLantern[] = [];
  private animatedSigns: AnimatedSign[] = [];
  private animTimer = 0;

  constructor() {
    this.mapGroup = new THREE.Group();
  }

  public buildMap(map: MapData, scene: THREE.Scene): void {
    this.clear();
    this.currentMap = map;

    // Reset debug tracking for the new map
    GlobalAtlasDebugOverlay.clearTrackedObjects();

    // Set atmosphere & fog
    scene.background = new THREE.Color(map.skyColor || 0x60a5fa);
    scene.fog = new THREE.FogExp2(map.skyColor || 0x60a5fa, map.indoor ? 0.035 : 0.022);

    const W = map.width;
    const H = map.height;
    const tileGeo = new THREE.PlaneGeometry(1, 1);
    tileGeo.rotateX(-Math.PI / 2);

    // Group ground tiles by TileType for InstancedMesh
    const tileInstancesByType = new Map<TileType, THREE.Matrix4[]>();

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const type = map.ground[y][x];
        if (!tileInstancesByType.has(type)) {
          tileInstancesByType.set(type, []);
        }

        const matrix = new THREE.Matrix4();
        // Water is slightly sunken (y = -0.06)
        const posY = type === 'water' ? -0.06 : 0;
        matrix.setPosition(x, posY, y);
        tileInstancesByType.get(type)!.push(matrix);
      }
    }

    // Req. 3: SUELO: pieza "floor_wood_dark" con tile:true se usa en un plano con RepeatWrapping.
    // Como comparte atlas, genera un canvas aparte con ese recorte (OffscreenCanvas) y úsalo como textura repetible
    // (repeat = tamaño del cuarto en tiles).
    if (map.indoor || tileInstancesByType.has('interior_floor')) {
      const floorMat = map.id === 'interior_shop'
        ? GlobalMercadoAtlas.createFloorMaterial('floor_wood_dark', W, H)
        : GlobalTallerAtlas.createFloorMaterial('floor_wood_dark', W, H);
      const floorGeo = new THREE.PlaneGeometry(W, H);
      floorGeo.rotateX(-Math.PI / 2);
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set((W - 1) / 2, 0, (H - 1) / 2);
      floorMesh.receiveShadow = true;
      this.mapGroup.add(floorMesh);
    }

    // 1. Create InstancedMesh for remaining ground tiles
    tileInstancesByType.forEach((matrices, type) => {
      // Skip interior_floor as it is rendered as a unified seamless plane above (Req. 3 & 5)
      if (type === 'interior_floor') {
        return;
      }

      const tex = GlobalAssetRegistry.getTileThree(type);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: type === 'water' ? 0.1 : 0.85,
        metalness: type === 'water' ? 0.3 : 0.05,
        flatShading: true,
      });

      const instancedMesh = new THREE.InstancedMesh(tileGeo, mat, matrices.length);
      instancedMesh.receiveShadow = true;

      matrices.forEach((m, idx) => {
        instancedMesh.setMatrixAt(idx, m);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;

      this.mapGroup.add(instancedMesh);
    });

    // 2. Build Decor & Vertical Sprites
    this.tallGrassGroup = new THREE.Group();
    this.mapGroup.add(this.tallGrassGroup);
    this.decorEntries = [];
    this.billboardProps = [];
    this.animatedSouls = [];

    // --- SPECIAL HANDLING FOR VILLAGE FAÇADES (EXTERIOR) ---
    if (map.id === 'villa_brote') {
      // Bloque 33: Fachada exterior del Taller de Artífices
      this.createWorkshopExteriorFacade(7, 17);
      // Bloque 34: Fachada Modular del Mercado de Artífices (exterior)
      this.createShopExteriorFacade(22, 17);
    }

    // --- SPECIAL HANDLING FOR WORKSHOP INTERIOR PROPS (INTERIOR_CENTER) ---
    if (map.id === 'interior_center') {
      this.buildWorkshopInteriorProps();
    }

    // --- SPECIAL HANDLING FOR SHOP INTERIOR PROPS (INTERIOR_SHOP) ---
    if (map.id === 'interior_shop') {
      this.buildShopInteriorProps();
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const decorType = map.decor ? map.decor[y][x] : null;
        const isTallGrass = map.encounters && map.encounters[y][x] === 'tall_grass';

        // Skip procedural building wall blocks for workshop and shop facades in villa_brote
        if (map.id === 'villa_brote') {
          if ((x >= 4 && x <= 10 && y >= 13 && y <= 17) || (x >= 19 && x <= 25 && y >= 13 && y <= 17)) {
            continue;
          }
        }

        // If interior_center or interior_shop, decor props are placed as specialized sprites
        if (map.id === 'interior_center' || map.id === 'interior_shop') {
          if (decorType === 'wall') {
            this.createInteriorWallBlock(x, y);
          } else if (decorType === 'door') {
            this.createDoorArchway(x, y);
          } else if (decorType === 'carpet') {
            this.createCarpetRunner(x, y);
          }
          continue;
        }

        if (decorType === 'tree') {
          this.createTreeObject(x, y);
        } else if (decorType === 'rock') {
          this.createRockObject(x, y);
        } else if (decorType === 'building_wall') {
          this.createBlockStructure(x, y, 'building_wall', 1.2);
        } else if (decorType === 'roof') {
          this.createRoofStructure(x, y);
        } else if (decorType === 'door') {
          this.createDoorStructure(x, y);
        } else if (decorType === 'wall') {
          this.createBlockStructure(x, y, 'wall', 1.4);
        }
      }
    }

    // Bloque 36: Build chunked InstancedMesh billboards, spritesheet grass/tall-grass, flowers, mushrooms, fireflies & interactives
    if (!map.indoor) {
      GlobalOverworldDecor.buildForMap(map, this.mapGroup);
    }

    // 3. Indoor Cozy Lighting & Ki Ambiance
    if (map.indoor) {
      const counterLight = new THREE.PointLight(0xffecd0, 2.2, 12);
      counterLight.position.set(6.5, 2.8, 5.0);
      this.mapGroup.add(counterLight);

      const manaLight = new THREE.PointLight(0x5fe3d2, 1.5, 6);
      manaLight.position.set(2.5, 1.5, 1.2);
      this.mapGroup.add(manaLight);

      const soulLight = new THREE.PointLight(0xa855f7, 1.6, 6);
      soulLight.position.set(6.5, 1.8, 1.2);
      this.mapGroup.add(soulLight);
    }

    scene.add(this.mapGroup);
  }

  // --- WORKSHOP INTERIOR PROPS (BLOQUE 33) ---

  private buildWorkshopInteriorProps(): void {
    // 1. Mostrador de Roble (oak_counter) - (x: 6.5, y: 0, z: 5.0)
    const mostrador = GlobalTallerAtlas.createPropMesh('oak_counter', 40, false);
    mostrador.position.set(6.5, 0, 5.0);
    this.mapGroup.add(mostrador);
    this.decorEntries.push({ x: 6, z: 5, meshes: [mostrador] });
    GlobalAtlasDebugOverlay.registerTrackedObject(mostrador, 'oak_counter');

    // 2. Máquina de Resonancia de Almas (resonance_machine) - (x: 2.8, y: 0, z: 1.2)
    const maquina = GlobalTallerAtlas.createPropMesh('resonance_machine', 38, false);
    maquina.position.set(2.8, 0, 1.2);
    this.mapGroup.add(maquina);
    this.decorEntries.push({ x: 3, z: 1, meshes: [maquina] });
    GlobalAtlasDebugOverlay.registerTrackedObject(maquina, 'resonance_machine');

    // Floating soul core effect near resonance machine
    const soulOrbMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    const soulOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), soulOrbMat);
    soulOrb.position.set(2.8, 1.7, 1.2);
    this.mapGroup.add(soulOrb);
    this.animatedSouls.push({ mesh: soulOrb, baseY: 1.7, phase: 0 });

    // 3. Banco de Reparación de Cuerpos (repair_bench) - (x: 10.5, y: 0, z: 1.2)
    const bench = GlobalTallerAtlas.createPropMesh('repair_bench', 38, false);
    bench.position.set(10.5, 0, 1.2);
    this.mapGroup.add(bench);
    this.decorEntries.push({ x: 10, z: 1, meshes: [bench] });
    GlobalAtlasDebugOverlay.registerTrackedObject(bench, 'repair_bench');

    // 4. Estantes de boticario y suministros (shelves) - (x: 1.1, y: 0, z: 3.5)
    const shelves = GlobalTallerAtlas.createPropMesh('shelves', 36, false);
    shelves.position.set(1.1, 0, 3.5);
    shelves.rotation.y = Math.PI / 2; // Facing room interior against west wall
    this.mapGroup.add(shelves);
    this.decorEntries.push({ x: 1, z: 3, meshes: [shelves] });
    GlobalAtlasDebugOverlay.registerTrackedObject(shelves, 'shelves');

    // 5. Chimenea / Forja de ki (fireplace) - (x: 1.1, y: 0, z: 6.8)
    const fireplace = GlobalTallerAtlas.createPropMesh('fireplace', 36, false);
    fireplace.position.set(1.1, 0, 6.8);
    fireplace.rotation.y = Math.PI / 2; // Against west wall
    this.mapGroup.add(fireplace);
    this.decorEntries.push({ x: 1, z: 7, meshes: [fireplace] });
    GlobalAtlasDebugOverlay.registerTrackedObject(fireplace, 'fireplace');

    // 6. Maniquíes de chasis de Souldolls (hanging_mannequins) - (x: 12.0, y: 2.2, z: 3.8)
    const mannequins = GlobalTallerAtlas.createPropMesh('hanging_mannequins', 36, true);
    mannequins.position.set(12.0, 2.2, 3.8);
    this.mapGroup.add(mannequins);
    this.billboardProps.push(mannequins);
    GlobalAtlasDebugOverlay.registerTrackedObject(mannequins, 'hanging_mannequins');

    // 7. Reloj de engranajes (gear_clock) - (x: 12.2, y: 0, z: 1.8)
    const clock = GlobalTallerAtlas.createPropMesh('gear_clock', 36, true);
    clock.position.set(12.2, 0, 1.8);
    this.mapGroup.add(clock);
    this.billboardProps.push(clock);
    GlobalAtlasDebugOverlay.registerTrackedObject(clock, 'gear_clock');

    // 8. Pared de ventanas iluminadas en el fondo norte (wall_windows_lit) - (x: 6.5, y: 0, z: 0.52)
    const wallWindows = GlobalTallerAtlas.createPropMesh('wall_windows_lit', 38, false);
    wallWindows.position.set(6.5, 0, 0.52);
    this.mapGroup.add(wallWindows);
    GlobalAtlasDebugOverlay.registerTrackedObject(wallWindows, 'wall_windows_lit');
  }

  /**
   * FACHADA DEL TALLER EXTERIOR (VILLA BROTE)
   * Req. 4: la fachada del edificio NO rota (queda fija mirando a la cámara base).
   * Un único sprite vertical para la fachada exterior completa.
   */
  private createWorkshopExteriorFacade(doorX: number, doorZ: number): void {
    // Single unified facade sprite from taller_atlas (house_exterior)
    const fachada = GlobalTallerAtlas.createPropMesh('house_exterior', 68, false);
    // Positioned centered at the workshop building front: x: 7.0, z: 17.48
    fachada.position.set(doorX, 0, doorZ + 0.48);
    fachada.rotation.y = 0; // Fixed facing south towards base camera (DOES NOT ROTATE)
    this.mapGroup.add(fachada);
    this.decorEntries.push({ x: doorX, z: doorZ, meshes: [fachada] });
    GlobalAtlasDebugOverlay.registerTrackedObject(fachada, 'house_exterior');

    // Signboard hanging beside the entrance (sign_hanging)
    const sign = GlobalTallerAtlas.createPropMesh('sign_hanging', 36, false);
    sign.position.set(doorX + 2.2, 2.3, doorZ + 0.50);
    this.mapGroup.add(sign);
    GlobalAtlasDebugOverlay.registerTrackedObject(sign, 'sign_hanging');

    // Chimney atop the roof (chimney)
    const chimney = GlobalTallerAtlas.createPropMesh('chimney', 50, false);
    chimney.position.set(doorX - 2.4, 4.2, doorZ - 1.2);
    this.mapGroup.add(chimney);
    GlobalAtlasDebugOverlay.registerTrackedObject(chimney, 'chimney');
  }

  /**
   * FACHADA MODULAR DEL MERCADO DE ARTÍFICES (VILLA BROTE) - BLOQUE 34
   * Req. 3: ext_facade_left + ext_facade_center + ext_facade_right colocados lado a lado.
   * La fachada del edificio NO rota (queda fija mirando a la cámara base).
   * Req. 4: LUCES ext_lanterns_* con efecto de brillo animado aditivo y letrero ext_sign_scale con balanceo.
   */
  private createShopExteriorFacade(doorX: number, doorZ: number): void {
    // 1. Módulos de Fachada (ppu: 64)
    // ext_facade_center: w=280 px / 64 = 4.375 tiles
    // ext_facade_left: w=290 px / 64 = 4.53 tiles
    // ext_facade_right: w=270 px / 64 = 4.22 tiles
    const facadeCenter = GlobalMercadoAtlas.createPropMesh('ext_facade_center', 64, false);
    facadeCenter.position.set(doorX, 0, doorZ + 0.48);
    facadeCenter.rotation.y = 0; // Fixed facing south (DOES NOT ROTATE)
    this.mapGroup.add(facadeCenter);
    this.decorEntries.push({ x: doorX, z: doorZ, meshes: [facadeCenter] });
    GlobalAtlasDebugOverlay.registerTrackedObject(facadeCenter, 'ext_facade_center', '3x1 col');

    const facadeLeft = GlobalMercadoAtlas.createPropMesh('ext_facade_left', 64, false);
    const leftOffset = (280 / 64 + 290 / 64) / 2 - 0.05;
    facadeLeft.position.set(doorX - leftOffset, 0, doorZ + 0.48);
    facadeLeft.rotation.y = 0;
    this.mapGroup.add(facadeLeft);
    this.decorEntries.push({ x: Math.round(doorX - leftOffset), z: doorZ, meshes: [facadeLeft] });
    GlobalAtlasDebugOverlay.registerTrackedObject(facadeLeft, 'ext_facade_left', '3x1 col');

    const facadeRight = GlobalMercadoAtlas.createPropMesh('ext_facade_right', 64, false);
    const rightOffset = (280 / 64 + 270 / 64) / 2 - 0.05;
    facadeRight.position.set(doorX + rightOffset, 0, doorZ + 0.48);
    facadeRight.rotation.y = 0;
    this.mapGroup.add(facadeRight);
    this.decorEntries.push({ x: Math.round(doorX + rightOffset), z: doorZ, meshes: [facadeRight] });
    GlobalAtlasDebugOverlay.registerTrackedObject(facadeRight, 'ext_facade_right', '3x1 col (portón)');

    // 2. Letrero de la Balanza (ext_sign_scale) - anclado sobre la fachada con balanceo suave (Req. 4)
    const sign = GlobalMercadoAtlas.createPropMesh('ext_sign_scale', 34, false);
    sign.position.set(doorX, 3.4, doorZ + 0.52);
    this.mapGroup.add(sign);
    this.animatedSigns.push({ mesh: sign, baseRotationZ: 0, speed: 2.2 });
    GlobalAtlasDebugOverlay.registerTrackedObject(sign, 'ext_sign_scale');

    // 3. Faroles mágicos con brillo aditivo (ext_lanterns_teal y ext_lanterns_purple) (Req. 4)
    // Farol Teal (#5FE3D2)
    const lanternTeal = GlobalMercadoAtlas.createPropMesh('ext_lanterns_teal', 32, false);
    lanternTeal.position.set(doorX - 1.8, 2.3, doorZ + 0.52);
    this.mapGroup.add(lanternTeal);
    const tealLight = new THREE.PointLight(0x5fe3d2, 1.8, 6);
    tealLight.position.set(doorX - 1.8, 2.3, doorZ + 0.7);
    this.mapGroup.add(tealLight);
    this.animatedLanterns.push({
      mesh: lanternTeal,
      light: tealLight,
      baseScale: 1.0,
      baseAlpha: 0.9,
      speed: 2.8,
      phase: 0,
    });
    GlobalAtlasDebugOverlay.registerTrackedObject(lanternTeal, 'ext_lanterns_teal');

    // Farol Púrpura (#9B6BFF)
    const lanternPurple = GlobalMercadoAtlas.createPropMesh('ext_lanterns_purple', 32, false);
    lanternPurple.position.set(doorX + 1.8, 2.3, doorZ + 0.52);
    this.mapGroup.add(lanternPurple);
    const purpleLight = new THREE.PointLight(0x9b6bff, 1.8, 6);
    purpleLight.position.set(doorX + 1.8, 2.3, doorZ + 0.7);
    this.mapGroup.add(purpleLight);
    this.animatedLanterns.push({
      mesh: lanternPurple,
      light: purpleLight,
      baseScale: 1.0,
      baseAlpha: 0.9,
      speed: 2.8,
      phase: Math.PI / 2,
    });
    GlobalAtlasDebugOverlay.registerTrackedObject(lanternPurple, 'ext_lanterns_purple');
  }

  /**
   * PROPS DEL INTERIOR DEL MERCADO (INTERIOR_SHOP) - BLOQUE 34
   * Req. 5: estantes alineados, mostrador, vitrinas, maniquíes, armero, cristales, caja fuerte y tablón
   * con pivote en los pies, sombra circular suave y huella de colisión en tiles.
   * Req. 7: Interactuables con ShopScene (Cuerpos, Armas, Cristales, Souls, Encargos).
   */
  private buildShopInteriorProps(): void {
    // 1. Alfombra Central Ornamental (rug_big) - horizontal flat en el suelo (y = 0.006)
    const rug = GlobalMercadoAtlas.createPropMesh('rug_big', 32, false);
    rug.position.set(5.5, 0.006, 6.5);
    this.mapGroup.add(rug);
    GlobalAtlasDebugOverlay.registerTrackedObject(rug, 'rug_big');

    // 2. Estantes Modulares de la pared de fondo (int_shelf_left, int_shelf_center, int_shelf_right)
    const shelfLeft = GlobalMercadoAtlas.createPropMesh('int_shelf_left', 38, false);
    shelfLeft.position.set(2.8, 0, 1.05);
    this.mapGroup.add(shelfLeft);
    this.decorEntries.push({ x: 3, z: 1, meshes: [shelfLeft] });
    GlobalAtlasDebugOverlay.registerTrackedObject(shelfLeft, 'int_shelf_left', '3x1 col');

    const shelfCenter = GlobalMercadoAtlas.createPropMesh('int_shelf_center', 38, false);
    shelfCenter.position.set(5.8, 0, 1.05);
    this.mapGroup.add(shelfCenter);
    this.decorEntries.push({ x: 6, z: 1, meshes: [shelfCenter] });
    GlobalAtlasDebugOverlay.registerTrackedObject(shelfCenter, 'int_shelf_center', '3x1 col');

    const shelfRight = GlobalMercadoAtlas.createPropMesh('int_shelf_right', 38, false);
    shelfRight.position.set(8.8, 0, 1.05);
    this.mapGroup.add(shelfRight);
    this.decorEntries.push({ x: 9, z: 1, meshes: [shelfRight] });
    GlobalAtlasDebugOverlay.registerTrackedObject(shelfRight, 'int_shelf_right', '3x1 col');

    // 3. Mostrador Central (int_counter) - (x: 5.5, z: 4.0)
    const counter = GlobalMercadoAtlas.createPropMesh('int_counter', 38, false);
    counter.position.set(5.5, 0, 4.0);
    const counterShadow = GlobalMercadoAtlas.createCircularShadow(1.8);
    counterShadow.position.set(5.5, 0.003, 4.0);
    this.mapGroup.add(counterShadow);
    this.mapGroup.add(counter);
    this.decorEntries.push({ x: 5, z: 4, meshes: [counter, counterShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(counter, 'int_counter', '4x1 col');

    // 4. Vitrinas de exposición
    // Vitrina Izquierda - Souls selladas (int_vitrina_left) - (x: 3.0, z: 6.0)
    const vitrinaLeft = GlobalMercadoAtlas.createPropMesh('int_vitrina_left', 36, false);
    vitrinaLeft.position.set(3.0, 0, 6.0);
    const vitLeftShadow = GlobalMercadoAtlas.createCircularShadow(1.0);
    vitLeftShadow.position.set(3.0, 0.003, 6.0);
    this.mapGroup.add(vitLeftShadow);
    this.mapGroup.add(vitrinaLeft);
    this.decorEntries.push({ x: 3, z: 6, meshes: [vitrinaLeft, vitLeftShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(vitrinaLeft, 'int_vitrina_left', '1x1 col');

    // Vitrina Derecha - Elixires y suministros (int_vitrina_right) - (x: 8.0, z: 6.0)
    const vitrinaRight = GlobalMercadoAtlas.createPropMesh('int_vitrina_right', 36, false);
    vitrinaRight.position.set(8.0, 0, 6.0);
    const vitRightShadow = GlobalMercadoAtlas.createCircularShadow(1.0);
    vitRightShadow.position.set(8.0, 0.003, 6.0);
    this.mapGroup.add(vitRightShadow);
    this.mapGroup.add(vitrinaRight);
    this.decorEntries.push({ x: 8, z: 6, meshes: [vitrinaRight, vitRightShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(vitrinaRight, 'int_vitrina_right', '1x1 col');

    // 5. Maniquíes de Cuerpos (int_mannequin_1, int_mannequin_2, int_mannequin_3) - pared oeste
    const mq1 = GlobalMercadoAtlas.createPropMesh('int_mannequin_1', 34, true);
    mq1.position.set(1.2, 0, 3.0);
    const mq1Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq1Shadow.position.set(1.2, 0.003, 3.0);
    this.mapGroup.add(mq1Shadow);
    this.mapGroup.add(mq1);
    this.billboardProps.push(mq1);
    this.decorEntries.push({ x: 1, z: 3, meshes: [mq1, mq1Shadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(mq1, 'int_mannequin_1', '1x1 col');

    const mq2 = GlobalMercadoAtlas.createPropMesh('int_mannequin_2', 34, true);
    mq2.position.set(1.2, 0, 4.0);
    const mq2Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq2Shadow.position.set(1.2, 0.003, 4.0);
    this.mapGroup.add(mq2Shadow);
    this.mapGroup.add(mq2);
    this.billboardProps.push(mq2);
    this.decorEntries.push({ x: 1, z: 4, meshes: [mq2, mq2Shadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(mq2, 'int_mannequin_2', '1x1 col');

    const mq3 = GlobalMercadoAtlas.createPropMesh('int_mannequin_3', 34, true);
    mq3.position.set(1.2, 0, 5.0);
    const mq3Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq3Shadow.position.set(1.2, 0.003, 5.0);
    this.mapGroup.add(mq3Shadow);
    this.mapGroup.add(mq3);
    this.billboardProps.push(mq3);
    this.decorEntries.push({ x: 1, z: 5, meshes: [mq3, mq3Shadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(mq3, 'int_mannequin_3', '1x1 col');

    // 6. Caja Fuerte del gremio (int_safe) - (x: 1.2, z: 6.0)
    const safe = GlobalMercadoAtlas.createPropMesh('int_safe', 36, true);
    safe.position.set(1.2, 0, 6.0);
    const safeShadow = GlobalMercadoAtlas.createCircularShadow(0.6);
    safeShadow.position.set(1.2, 0.003, 6.0);
    this.mapGroup.add(safeShadow);
    this.mapGroup.add(safe);
    this.billboardProps.push(safe);
    this.decorEntries.push({ x: 1, z: 6, meshes: [safe, safeShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(safe, 'int_safe', '1x1 col');

    // 7. Armero de Reliquias y Armas (int_weapon_rack) - (x: 10.5, z: 3.0)
    const armero = GlobalMercadoAtlas.createPropMesh('int_weapon_rack', 36, false);
    armero.position.set(10.5, 0, 3.0);
    armero.rotation.y = -Math.PI / 2; // Facing room interior against east wall
    const armeroShadow = GlobalMercadoAtlas.createCircularShadow(0.9);
    armeroShadow.position.set(10.5, 0.003, 3.0);
    this.mapGroup.add(armeroShadow);
    this.mapGroup.add(armero);
    this.decorEntries.push({ x: 10, z: 3, meshes: [armero, armeroShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(armero, 'int_weapon_rack', '1x1 col');

    // 8. Cristales de Ki (int_crystal_cluster y int_crystal_pedestal) - (x: 10.5, z: 4.0 y 5.0)
    const crystal = GlobalMercadoAtlas.createPropMesh('int_crystal_cluster', 34, true);
    crystal.position.set(10.5, 0, 4.0);
    const crystalShadow = GlobalMercadoAtlas.createCircularShadow(0.7);
    crystalShadow.position.set(10.5, 0.003, 4.0);
    this.mapGroup.add(crystalShadow);
    this.mapGroup.add(crystal);
    this.billboardProps.push(crystal);
    this.decorEntries.push({ x: 10, z: 4, meshes: [crystal, crystalShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(crystal, 'int_crystal_cluster', '1x1 col');

    const crystalPedestal = GlobalMercadoAtlas.createPropMesh('int_crystal_pedestal', 34, true);
    crystalPedestal.position.set(10.5, 0, 5.0);
    const pedShadow = GlobalMercadoAtlas.createCircularShadow(0.7);
    pedShadow.position.set(10.5, 0.003, 5.0);
    this.mapGroup.add(pedShadow);
    this.mapGroup.add(crystalPedestal);
    this.billboardProps.push(crystalPedestal);
    this.decorEntries.push({ x: 10, z: 5, meshes: [crystalPedestal, pedShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(crystalPedestal, 'int_crystal_pedestal', '1x1 col');

    // Crystal ambient glow
    const crystalLight = new THREE.PointLight(0x5fe3d2, 1.4, 5);
    crystalLight.position.set(10.2, 1.2, 4.5);
    this.mapGroup.add(crystalLight);

    // 9. Tablón de Encargos (int_notice_board) - (x: 10.5, z: 6.0)
    const noticeBoard = GlobalMercadoAtlas.createPropMesh('int_notice_board', 36, false);
    noticeBoard.position.set(10.5, 0, 6.0);
    noticeBoard.rotation.y = -Math.PI / 2;
    const boardShadow = GlobalMercadoAtlas.createCircularShadow(0.9);
    boardShadow.position.set(10.5, 0.003, 6.0);
    this.mapGroup.add(boardShadow);
    this.mapGroup.add(noticeBoard);
    this.decorEntries.push({ x: 10, z: 6, meshes: [noticeBoard, boardShadow] });
    GlobalAtlasDebugOverlay.registerTrackedObject(noticeBoard, 'int_notice_board', '1x1 col');

    // 10. Faroles de pared interior y luz cálida
    const warmLight = new THREE.PointLight(0xffecd0, 2.0, 10);
    warmLight.position.set(5.5, 2.6, 4.2);
    this.mapGroup.add(warmLight);
  }

  // --- INTERIOR ROOM ARCHITECTURE ---

  private createInteriorWallBlock(x: number, z: number): void {
    const height = 2.4;
    const geo = new THREE.BoxGeometry(1, height, 1);
    geo.translate(0, height / 2, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a1f2d,
      roughness: 0.85,
      metalness: 0.1,
    });
    const wallMesh = new THREE.Mesh(geo, mat);
    wallMesh.position.set(x, 0, z);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    // Wood baseboard & crown molding
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.16, 1.02), trimMat);
    baseboard.position.set(x, 0.08, z);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.16, 1.04), trimMat);
    cornice.position.set(x, height - 0.08, z);

    this.mapGroup.add(wallMesh);
    this.mapGroup.add(baseboard);
    this.mapGroup.add(cornice);
    this.decorEntries.push({ x, z, meshes: [wallMesh, baseboard, cornice] });
  }

  private createCarpetRunner(x: number, z: number): void {
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), carpetMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.008, z);
    rug.receiveShadow = true;
    this.mapGroup.add(rug);

    // Golden border
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(x, 0.009, z);
    this.mapGroup.add(border);
  }

  private createDoorArchway(x: number, z: number): void {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.28), frameMat);
    leftPost.position.set(-0.44, 0.95, -0.35);
    doorGroup.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.28), frameMat);
    rightPost.position.set(0.44, 0.95, -0.35);
    doorGroup.add(rightPost);

    const header = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.32), frameMat);
    header.position.set(0, 1.85, -0.35);
    doorGroup.add(header);

    const doormat = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.02, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    doormat.position.set(0, 0.01, 0.05);
    doorGroup.add(doormat);

    this.mapGroup.add(doorGroup);
    this.decorEntries.push({ x, z, meshes: [leftPost, rightPost, header, doormat] });
  }

  // --- OUTDOOR PROCEDURAL DECOR (TREES, ROCKS, BUILDINGS) ---

  private createTreeObject(x: number, z: number): void {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.2, 6);
    trunkGeo.translate(0, 0.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      flatShading: true,
      roughness: 0.9,
      transparent: true,
      opacity: 1.0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      flatShading: true,
      roughness: 0.8,
      transparent: true,
      opacity: 1.0,
    });

    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.1, 6), foliageMat);
    f1.position.y = 1.35;
    f1.castShadow = true;
    f1.receiveShadow = true;
    tree.add(f1);

    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.95, 6), foliageMat);
    f2.position.y = 1.95;
    f2.castShadow = true;
    f2.receiveShadow = true;
    tree.add(f2);

    this.mapGroup.add(tree);
    this.decorEntries.push({ x, z, meshes: [trunk, f1, f2] });
  }

  private createRockObject(x: number, z: number): void {
    const rockGeo = new THREE.DodecahedronGeometry(0.42, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      flatShading: true,
      roughness: 0.8,
      transparent: true,
      opacity: 1.0,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, 0.35, z);
    rock.scale.set(1.2, 0.8, 1.1);
    rock.rotation.y = Math.sin(x * 12 + z) * Math.PI;
    rock.castShadow = true;
    rock.receiveShadow = true;

    this.mapGroup.add(rock);
    this.decorEntries.push({ x, z, meshes: [rock] });
  }

  private createBlockStructure(x: number, z: number, tileType: TileType, height = 1.2): void {
    const geo = new THREE.BoxGeometry(1, height, 1);
    geo.translate(0, height / 2, 0);
    const tex = GlobalAssetRegistry.getTileThree(tileType);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
    this.decorEntries.push({ x, z, meshes: [mesh] });
  }

  private createRoofStructure(x: number, z: number): void {
    const geo = new THREE.ConeGeometry(0.85, 1.0, 4);
    geo.rotateY(Math.PI / 4);
    geo.translate(0, 1.7, 0);
    const tex = GlobalAssetRegistry.getTileThree('roof');
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    this.mapGroup.add(mesh);
    this.decorEntries.push({ x, z, meshes: [mesh] });
  }

  private createDoorStructure(x: number, z: number): void {
    const geo = new THREE.BoxGeometry(1, 1.2, 0.3);
    geo.translate(0, 0.6, -0.35);
    const tex = GlobalAssetRegistry.getTileThree('door');
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
    this.decorEntries.push({ x, z, meshes: [mesh] });
  }

  private createTallGrassObject(x: number, z: number): void {
    const grassGroup = new THREE.Group();
    grassGroup.position.set(x, 0, z);

    const bladeGeo = new THREE.PlaneGeometry(0.9, 0.6);
    bladeGeo.translate(0, 0.3, 0);

    const tex = GlobalAssetRegistry.getTileThree('tall_grass');
    const bladeMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });

    const b1 = new THREE.Mesh(bladeGeo, bladeMat);
    b1.rotation.y = 0.3;
    grassGroup.add(b1);

    const b2 = new THREE.Mesh(bladeGeo, bladeMat);
    b2.rotation.y = Math.PI / 3 + 0.3;
    grassGroup.add(b2);

    const b3 = new THREE.Mesh(bladeGeo, bladeMat);
    b3.rotation.y = (2 * Math.PI) / 3 + 0.3;
    grassGroup.add(b3);

    this.tallGrassGroup.add(grassGroup);
  }

  public update(dt: number, cameraYaw = 0, cameraPitch = 0.55, playerX = 0, playerZ = 0): void {
    this.animTimer += dt;

    // Bloque 36: Update chunked billboard uniforms, tall-grass squash, leaf particles, fireflies & foot occluders
    GlobalOverworldDecor.update(dt, cameraYaw, cameraPitch, playerX, playerZ);

    // Req. 4: Billboard only on Y axis for small props
    this.billboardProps.forEach((prop) => {
      prop.rotation.y = cameraYaw;
    });

    // Floating Souls animation
    this.animatedSouls.forEach((soul) => {
      soul.mesh.position.y = soul.baseY + Math.sin(this.animTimer * 2.8 + soul.phase) * 0.05;
      soul.mesh.rotation.y += dt * 1.2;
    });

    // Req. 4: Letrero ext_sign_scale se ancla sobre la fachada y se balancea ligeramente
    this.animatedSigns.forEach((sign) => {
      sign.mesh.rotation.z = sign.baseRotationZ + Math.sin(this.animTimer * sign.speed) * 0.055;
    });

    // Req. 4: LUCES ext_lanterns_* con efecto de brillo animado (pulso de alpha/escala en un sprite aditivo)
    // Las ventanas y faroles se intensifican de noche (ciclo día/noche)
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    let nightFactor = 0.2;
    if (currentHour >= 20 || currentHour < 6) {
      nightFactor = 1.0;
    } else if (currentHour >= 18 && currentHour < 20) {
      nightFactor = 0.2 + 0.8 * ((currentHour - 18) / 2);
    } else if (currentHour >= 6 && currentHour < 8) {
      nightFactor = 1.0 - 0.8 * ((currentHour - 6) / 2);
    }
    const nightMultiplier = 1.0 + nightFactor * 0.9;

    this.animatedLanterns.forEach((lantern) => {
      const pulse = Math.sin(this.animTimer * lantern.speed + lantern.phase);
      const scaleVal = lantern.baseScale * (1.0 + pulse * 0.12 * nightMultiplier);
      lantern.mesh.scale.set(scaleVal, scaleVal, 1.0);

      const mat = lantern.mesh.material as THREE.MeshBasicMaterial;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = Math.min(1.0, lantern.baseAlpha * (0.8 + pulse * 0.2) * nightMultiplier);
      }

      if (lantern.light) {
        lantern.light.intensity = 1.8 * (0.9 + pulse * 0.25) * nightMultiplier;
      }
    });

    // Req. 7: Update 3D world labels when debug overlay is active
    GlobalAtlasDebugOverlay.updateWorldLabels();
  }

  /**
   * Dynamically fades structures (buildings, roofs, trees, indoor front walls) standing between camera and player
   */
  public updateOcclusion(playerX: number, playerZ: number, cameraPos: THREE.Vector3): void {
    this.decorEntries.forEach((entry) => {
      const dx = entry.x - cameraPos.x;
      const dz = entry.z - cameraPos.z;
      const entryDistToCam = Math.sqrt(dx * dx + dz * dz);

      const pdx = playerX - cameraPos.x;
      const pdz = playerZ - cameraPos.z;
      const playerDistToCam = Math.sqrt(pdx * pdx + pdz * pdz);

      const isBetween = entryDistToCam < playerDistToCam - 0.5;
      const distToPlayerX = Math.abs(entry.x - playerX);
      const distToPlayerZ = entry.z - playerZ;

      const isBlocking = isBetween && distToPlayerX < 1.5 && distToPlayerZ > -0.5 && distToPlayerZ < 6.0;
      const targetOpacity = isBlocking ? 0.25 : 1.0;

      entry.meshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && mat.transparent !== undefined) {
          mat.transparent = true;
          mat.opacity += (targetOpacity - mat.opacity) * 0.25;
        }
      });
    });
  }

  /**
   * Deep memory cleanup (prevents WebGL memory leaks during warps)
   */
  public clear(): void {
    const disposeHierarchy = (obj: THREE.Object3D) => {
      obj.children.slice().forEach(disposeHierarchy);

      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (obj.geometry) obj.geometry.dispose();
      }
    };

    disposeHierarchy(this.mapGroup);
    this.mapGroup.clear();
    this.decorEntries = [];
    this.billboardProps = [];
    this.animatedSouls = [];
    this.animatedLanterns = [];
    this.animatedSigns = [];
    GlobalTallerAtlas.clearRegisteredMeshes();
    GlobalMercadoAtlas.clearRegisteredMeshes();
    GlobalOverworldDecor.clear();
  }
}
