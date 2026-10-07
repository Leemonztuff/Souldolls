import * as THREE from 'three';
import { MapData } from '../../types/maps';
import { GlobalTallerAtlas } from './TallerAtlas';
import { GlobalMercadoAtlas } from './MercadoAtlas';
import { GlobalLabAtlas } from './LabAtlas';
import { GlobalOverworldDecor } from './DecorRenderer';
import { GlobalTileRenderer, OccludableEntry } from './TileRenderer';
import { GlobalSaveService } from '../../services/SaveService';

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
  private lastScene: THREE.Scene | null = null;

  private tallGrassGroup: THREE.Group = new THREE.Group();
  private decorEntries: OccludableEntry[] = [];
  private billboardProps: THREE.Mesh[] = [];
  private animatedSouls: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  private animatedLanterns: AnimatedLantern[] = [];
  private animatedSigns: AnimatedSign[] = [];
  private animTimer = 0;
  private readonly ownedMaterials = new Set<THREE.Material>();

  constructor() {
    this.mapGroup = new THREE.Group();
  }

  public rebuildCurrentMap(): void {
    if (this.currentMap && this.lastScene) {
      this.buildMap(this.currentMap, this.lastScene);
    }
  }

  public buildMap(map: MapData, scene: THREE.Scene): void {
    this.clear();
    this.currentMap = map;
    this.lastScene = scene;

    // Set atmosphere & fog
    scene.background = new THREE.Color(map.skyColor || 0x60a5fa);
    scene.fog = new THREE.FogExp2(map.skyColor || 0x60a5fa, map.indoor ? 0.035 : 0.022);

    this.tallGrassGroup = new THREE.Group();
    this.mapGroup.add(this.tallGrassGroup);
    this.decorEntries = [];
    this.billboardProps = [];
    this.animatedSouls = [];

    // 1. BLOQUE 44 Req. 5 & 6: Build 16x16 merged ground chunks (A1/A2/A5), autotiled walls/facades (A3/A4)
    // and multi-tile B-E objects with "star" renderOrder support via GlobalTileRenderer
    const tileMapResult = GlobalTileRenderer.buildMapGeometry(map);
    this.mapGroup.add(tileMapResult.groundGroup);
    this.mapGroup.add(tileMapResult.facadeAndPropsGroup);
    this.mapGroup.add(tileMapResult.starOverlayGroup);
    this.decorEntries.push(...tileMapResult.occludableEntries);

    // --- COEXISTENCE WITH CUSTOM ATLASES (BLOQUES 33 / 34 / 36) ---
    const stage = GlobalTileRenderer.getAuthoringStage();
    if (!GlobalTileRenderer.isClassicFlatMode()) {
      // Special custom facades in Villa Brote (shown in Normal mode or Authoring Stage >= 3)
      if (map.id === 'villa_brote' && (stage === 0 || stage >= 3)) {
        this.createWorkshopExteriorFacade(7, 17);
        this.createShopExteriorFacade(22, 17);
        this.createLabExteriorFacade(22, 7);
      }

      // Special Workshop Interior Props (Bloque 33)
      if (map.id === 'interior_center') {
        this.buildWorkshopInteriorProps();
      }

      // Special Shop Interior Props (Bloque 34)
      if (map.id === 'interior_shop') {
        this.buildShopInteriorProps();
      }

      // Special Lab Interior Props (Bloque 35)
      if (map.id === 'interior_lab') {
        this.buildLabInteriorProps();
      }

      // Bloque 36: Chunked InstancedMesh billboards, flowers, mushrooms, fireflies & interactives
      // En el flujo de autoría F2 (Bloque 45 Req. 1), el decorado de bioma aparece en las etapas 5 y 6 (o vista normal 0)
      if (!map.indoor && (stage === 0 || stage >= 5)) {
        GlobalOverworldDecor.buildForMap(map, this.mapGroup);
      }
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

    // 2. Máquina de Resonancia de Almas (resonance_machine) - (x: 2.8, y: 0, z: 1.2)
    const maquina = GlobalTallerAtlas.createPropMesh('resonance_machine', 38, false);
    maquina.position.set(2.8, 0, 1.2);
    this.mapGroup.add(maquina);
    this.decorEntries.push({ x: 3, z: 1, meshes: [maquina] });

    // Floating soul core effect near resonance machine
    const soulOrbMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    this.ownedMaterials.add(soulOrbMat);
    const soulOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), soulOrbMat);
    soulOrb.position.set(2.8, 1.7, 1.2);
    this.mapGroup.add(soulOrb);
    this.animatedSouls.push({ mesh: soulOrb, baseY: 1.7, phase: 0 });

    // 3. Banco de Reparación de Cuerpos (repair_bench) - (x: 10.5, y: 0, z: 1.2)
    const bench = GlobalTallerAtlas.createPropMesh('repair_bench', 38, false);
    bench.position.set(10.5, 0, 1.2);
    this.mapGroup.add(bench);
    this.decorEntries.push({ x: 10, z: 1, meshes: [bench] });

    // 4. Estantes de boticario y suministros (shelves) - (x: 1.1, y: 0, z: 3.5)
    const shelves = GlobalTallerAtlas.createPropMesh('shelves', 36, false);
    shelves.position.set(1.1, 0, 3.5);
    shelves.rotation.y = Math.PI / 2; // Facing room interior against west wall
    this.mapGroup.add(shelves);
    this.decorEntries.push({ x: 1, z: 3, meshes: [shelves] });

    // 5. Chimenea / Forja de ki (fireplace) - (x: 1.1, y: 0, z: 6.8)
    const fireplace = GlobalTallerAtlas.createPropMesh('fireplace', 36, false);
    fireplace.position.set(1.1, 0, 6.8);
    fireplace.rotation.y = Math.PI / 2; // Against west wall
    this.mapGroup.add(fireplace);
    this.decorEntries.push({ x: 1, z: 7, meshes: [fireplace] });

    // 6. Maniquíes de chasis de Souldolls (hanging_mannequins) - (x: 12.0, y: 2.2, z: 3.8)
    const mannequins = GlobalTallerAtlas.createPropMesh('hanging_mannequins', 36, true);
    mannequins.position.set(12.0, 2.2, 3.8);
    this.mapGroup.add(mannequins);
    this.billboardProps.push(mannequins);

    // 7. Reloj de engranajes (gear_clock) - (x: 12.2, y: 0, z: 1.8)
    const clock = GlobalTallerAtlas.createPropMesh('gear_clock', 36, true);
    clock.position.set(12.2, 0, 1.8);
    this.mapGroup.add(clock);
    this.billboardProps.push(clock);

    // 8. Pared de ventanas iluminadas en el fondo norte (wall_windows_lit) - (x: 6.5, y: 0, z: 0.52)
    const wallWindows = GlobalTallerAtlas.createPropMesh('wall_windows_lit', 38, false);
    wallWindows.position.set(6.5, 0, 0.52);
    this.mapGroup.add(wallWindows);
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

    // Signboard hanging beside the entrance (sign_hanging)
    const sign = GlobalTallerAtlas.createPropMesh('sign_hanging', 36, false);
    sign.position.set(doorX + 2.2, 2.3, doorZ + 0.50);
    this.mapGroup.add(sign);

    // Chimney atop the roof (chimney)
    const chimney = GlobalTallerAtlas.createPropMesh('chimney', 50, false);
    chimney.position.set(doorX - 2.4, 4.2, doorZ - 1.2);
    this.mapGroup.add(chimney);
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

    const facadeLeft = GlobalMercadoAtlas.createPropMesh('ext_facade_left', 64, false);
    const leftOffset = (280 / 64 + 290 / 64) / 2 - 0.05;
    facadeLeft.position.set(doorX - leftOffset, 0, doorZ + 0.48);
    facadeLeft.rotation.y = 0;
    this.mapGroup.add(facadeLeft);
    this.decorEntries.push({ x: Math.round(doorX - leftOffset), z: doorZ, meshes: [facadeLeft] });

    const facadeRight = GlobalMercadoAtlas.createPropMesh('ext_facade_right', 64, false);
    const rightOffset = (280 / 64 + 270 / 64) / 2 - 0.05;
    facadeRight.position.set(doorX + rightOffset, 0, doorZ + 0.48);
    facadeRight.rotation.y = 0;
    this.mapGroup.add(facadeRight);
    this.decorEntries.push({ x: Math.round(doorX + rightOffset), z: doorZ, meshes: [facadeRight] });

    // 2. Letrero de la Balanza (ext_sign_scale) - anclado sobre la fachada con balanceo suave (Req. 4)
    const sign = GlobalMercadoAtlas.createPropMesh('ext_sign_scale', 34, false);
    sign.position.set(doorX, 3.4, doorZ + 0.52);
    this.mapGroup.add(sign);
    this.animatedSigns.push({ mesh: sign, baseRotationZ: 0, speed: 2.2 });

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

    // 2. Estantes Modulares de la pared de fondo (int_shelf_left, int_shelf_center, int_shelf_right)
    const shelfLeft = GlobalMercadoAtlas.createPropMesh('int_shelf_left', 38, false);
    shelfLeft.position.set(2.8, 0, 1.05);
    this.mapGroup.add(shelfLeft);
    this.decorEntries.push({ x: 3, z: 1, meshes: [shelfLeft] });

    const shelfCenter = GlobalMercadoAtlas.createPropMesh('int_shelf_center', 38, false);
    shelfCenter.position.set(5.8, 0, 1.05);
    this.mapGroup.add(shelfCenter);
    this.decorEntries.push({ x: 6, z: 1, meshes: [shelfCenter] });

    const shelfRight = GlobalMercadoAtlas.createPropMesh('int_shelf_right', 38, false);
    shelfRight.position.set(8.8, 0, 1.05);
    this.mapGroup.add(shelfRight);
    this.decorEntries.push({ x: 9, z: 1, meshes: [shelfRight] });

    // 3. Mostrador Central (int_counter) - (x: 5.5, z: 4.0)
    const counter = GlobalMercadoAtlas.createPropMesh('int_counter', 38, false);
    counter.position.set(5.5, 0, 4.0);
    const counterShadow = GlobalMercadoAtlas.createCircularShadow(1.8);
    counterShadow.position.set(5.5, 0.003, 4.0);
    this.mapGroup.add(counterShadow);
    this.mapGroup.add(counter);
    this.decorEntries.push({ x: 5, z: 4, meshes: [counter, counterShadow] });

    // 4. Vitrinas de exposición
    // Vitrina Izquierda - Souls selladas (int_vitrina_left) - (x: 3.0, z: 6.0)
    const vitrinaLeft = GlobalMercadoAtlas.createPropMesh('int_vitrina_left', 36, false);
    vitrinaLeft.position.set(3.0, 0, 6.0);
    const vitLeftShadow = GlobalMercadoAtlas.createCircularShadow(1.0);
    vitLeftShadow.position.set(3.0, 0.003, 6.0);
    this.mapGroup.add(vitLeftShadow);
    this.mapGroup.add(vitrinaLeft);
    this.decorEntries.push({ x: 3, z: 6, meshes: [vitrinaLeft, vitLeftShadow] });

    // Vitrina Derecha - Elixires y suministros (int_vitrina_right) - (x: 8.0, z: 6.0)
    const vitrinaRight = GlobalMercadoAtlas.createPropMesh('int_vitrina_right', 36, false);
    vitrinaRight.position.set(8.0, 0, 6.0);
    const vitRightShadow = GlobalMercadoAtlas.createCircularShadow(1.0);
    vitRightShadow.position.set(8.0, 0.003, 6.0);
    this.mapGroup.add(vitRightShadow);
    this.mapGroup.add(vitrinaRight);
    this.decorEntries.push({ x: 8, z: 6, meshes: [vitrinaRight, vitRightShadow] });

    // 5. Maniquíes de Cuerpos (int_mannequin_1, int_mannequin_2, int_mannequin_3) - pared oeste
    const mq1 = GlobalMercadoAtlas.createPropMesh('int_mannequin_1', 34, true);
    mq1.position.set(1.2, 0, 3.0);
    const mq1Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq1Shadow.position.set(1.2, 0.003, 3.0);
    this.mapGroup.add(mq1Shadow);
    this.mapGroup.add(mq1);
    this.billboardProps.push(mq1);
    this.decorEntries.push({ x: 1, z: 3, meshes: [mq1, mq1Shadow] });

    const mq2 = GlobalMercadoAtlas.createPropMesh('int_mannequin_2', 34, true);
    mq2.position.set(1.2, 0, 4.0);
    const mq2Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq2Shadow.position.set(1.2, 0.003, 4.0);
    this.mapGroup.add(mq2Shadow);
    this.mapGroup.add(mq2);
    this.billboardProps.push(mq2);
    this.decorEntries.push({ x: 1, z: 4, meshes: [mq2, mq2Shadow] });

    const mq3 = GlobalMercadoAtlas.createPropMesh('int_mannequin_3', 34, true);
    mq3.position.set(1.2, 0, 5.0);
    const mq3Shadow = GlobalMercadoAtlas.createCircularShadow(0.5);
    mq3Shadow.position.set(1.2, 0.003, 5.0);
    this.mapGroup.add(mq3Shadow);
    this.mapGroup.add(mq3);
    this.billboardProps.push(mq3);
    this.decorEntries.push({ x: 1, z: 5, meshes: [mq3, mq3Shadow] });

    // 6. Caja Fuerte del gremio (int_safe) - (x: 1.2, z: 6.0)
    const safe = GlobalMercadoAtlas.createPropMesh('int_safe', 36, true);
    safe.position.set(1.2, 0, 6.0);
    const safeShadow = GlobalMercadoAtlas.createCircularShadow(0.6);
    safeShadow.position.set(1.2, 0.003, 6.0);
    this.mapGroup.add(safeShadow);
    this.mapGroup.add(safe);
    this.billboardProps.push(safe);
    this.decorEntries.push({ x: 1, z: 6, meshes: [safe, safeShadow] });

    // 7. Armero de Reliquias y Armas (int_weapon_rack) - (x: 10.5, z: 3.0)
    const armero = GlobalMercadoAtlas.createPropMesh('int_weapon_rack', 36, false);
    armero.position.set(10.5, 0, 3.0);
    armero.rotation.y = -Math.PI / 2; // Facing room interior against east wall
    const armeroShadow = GlobalMercadoAtlas.createCircularShadow(0.9);
    armeroShadow.position.set(10.5, 0.003, 3.0);
    this.mapGroup.add(armeroShadow);
    this.mapGroup.add(armero);
    this.decorEntries.push({ x: 10, z: 3, meshes: [armero, armeroShadow] });

    // 8. Cristales de Ki (int_crystal_cluster y int_crystal_pedestal) - (x: 10.5, z: 4.0 y 5.0)
    const crystal = GlobalMercadoAtlas.createPropMesh('int_crystal_cluster', 34, true);
    crystal.position.set(10.5, 0, 4.0);
    const crystalShadow = GlobalMercadoAtlas.createCircularShadow(0.7);
    crystalShadow.position.set(10.5, 0.003, 4.0);
    this.mapGroup.add(crystalShadow);
    this.mapGroup.add(crystal);
    this.billboardProps.push(crystal);
    this.decorEntries.push({ x: 10, z: 4, meshes: [crystal, crystalShadow] });

    const crystalPedestal = GlobalMercadoAtlas.createPropMesh('int_crystal_pedestal', 34, true);
    crystalPedestal.position.set(10.5, 0, 5.0);
    const pedShadow = GlobalMercadoAtlas.createCircularShadow(0.7);
    pedShadow.position.set(10.5, 0.003, 5.0);
    this.mapGroup.add(pedShadow);
    this.mapGroup.add(crystalPedestal);
    this.billboardProps.push(crystalPedestal);
    this.decorEntries.push({ x: 10, z: 5, meshes: [crystalPedestal, pedShadow] });

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

    // 10. Faroles de pared interior y luz cálida
    const warmLight = new THREE.PointLight(0xffecd0, 2.0, 10);
    warmLight.position.set(5.5, 2.6, 4.2);
    this.mapGroup.add(warmLight);
  }

  /**
   * FACHADA EXTERIOR DEL LABORATORIO DEL MAESTRO ARTÍFICE (ALDEA MARIONETA) - BLOQUE 35 R1 & R2
   * Casa de piedra y madera con tejado de pizarra violeta (#4B3A5E), torre de observatorio
   * con cúpula semicircular de cobre (#3F8C8A), antena de cristal de ki violeta (#9B6BFF)
   * y chimenea con humo de ki.
   */
  private createLabExteriorFacade(doorX: number, doorZ: number): void {
    const facadeCenter = GlobalLabAtlas.createPropMesh('lab_facade_center', 64, false);
    facadeCenter.position.set(doorX, 0, doorZ + 0.48);
    this.mapGroup.add(facadeCenter);
    this.decorEntries.push({ x: doorX, z: doorZ, meshes: [facadeCenter] });

    const facadeLeft = GlobalLabAtlas.createPropMesh('lab_facade_left', 64, false);
    facadeLeft.position.set(doorX - 2.9, 0, doorZ + 0.48);
    this.mapGroup.add(facadeLeft);
    this.decorEntries.push({ x: doorX - 3, z: doorZ, meshes: [facadeLeft] });

    const facadeRight = GlobalLabAtlas.createPropMesh('lab_facade_right', 64, false);
    facadeRight.position.set(doorX + 2.9, 0, doorZ + 0.48);
    this.mapGroup.add(facadeRight);
    this.decorEntries.push({ x: doorX + 3, z: doorZ, meshes: [facadeRight] });

    const slateRoof = GlobalLabAtlas.createPropMesh('lab_roof_slate_violet', 64, false);
    slateRoof.position.set(doorX, 3.8, doorZ + 0.42);
    this.mapGroup.add(slateRoof);

    const tower = GlobalLabAtlas.createPropMesh('lab_tower_observatory', 64, false);
    tower.position.set(doorX - 2.2, 2.6, doorZ - 0.8);
    this.mapGroup.add(tower);

    const chimney = GlobalLabAtlas.createPropMesh('lab_chimney_ki', 48, false);
    chimney.position.set(doorX + 2.2, 3.9, doorZ - 0.6);
    this.mapGroup.add(chimney);

    const sign = GlobalLabAtlas.createPropMesh('lab_sign_gear_bottle', 32, false);
    sign.position.set(doorX + 1.5, 2.2, doorZ + 0.52);
    this.mapGroup.add(sign);
    this.animatedSigns.push({ mesh: sign, baseRotationZ: 0, speed: 2.0 });
  }

  /**
   * PROPS DEL INTERIOR DEL LABORATORIO (INTERIOR_LAB 14x12) - BLOQUE 35 R1, R2, R3, R4
   * Renderiza la alfombra con emblema y los 7 objetos interactivos reflejando el estado vivo
   * de la partida (frasco elegido, tubo iluminado/vacío, diagrama de la Grieta).
   */
  private buildLabInteriorProps(): void {
    const state = GlobalSaveService.hasActiveState() ? GlobalSaveService.getCurrentState() : null;
    const flags = state?.flags || {};
    const starterChosen = Boolean(flags.starter_chosen);
    const bodyLinked = Boolean(flags.body_linked);
    const chosenSpecies = (state?.vars?.starter_species_id as string) || '';
    const bossDefeated = Boolean(flags.defeated_forest_boss || flags.bosque_eco_boss);

    // 0. Alfombra cenital con emblema de engranaje y llama (lab_rug_emblem)
    const rug = GlobalLabAtlas.createPropMesh('lab_rug_emblem', 32, false);
    rug.position.set(7.0, 0.006, 7.5);
    this.mapGroup.add(rug);

    // 1. Escritorio del Maestro Artífice (master_desk, tiles 6..8, 2)
    const desk = GlobalLabAtlas.createPropMesh('master_desk', 36, false);
    desk.position.set(7.0, 0, 2.2);
    this.mapGroup.add(desk);
    this.decorEntries.push({ x: 7, z: 2, meshes: [desk] });

    // 2. Pedestal de Iniciales + 3 Soul Bottles (starter_pedestal, tiles 4..5, 5)
    const pedestalFrame = starterChosen ? 'starter_pedestal_empty' : 'starter_pedestal_full';
    const pedestal = GlobalLabAtlas.createPropMesh(pedestalFrame, 36, false);
    pedestal.position.set(4.5, 0, 5.2);
    this.mapGroup.add(pedestal);
    this.decorEntries.push({ x: 4, z: 5, meshes: [pedestal] });

    if (!starterChosen) {
      const bEmber = GlobalLabAtlas.createPropMesh('starter_bottle_ember', 36, false);
      bEmber.position.set(4.0, 1.35, 5.25);
      this.mapGroup.add(bEmber);

      const bLeaf = GlobalLabAtlas.createPropMesh('starter_bottle_leaf', 36, false);
      bLeaf.position.set(4.5, 1.35, 5.25);
      this.mapGroup.add(bLeaf);

      const bWater = GlobalLabAtlas.createPropMesh('starter_bottle_water', 36, false);
      bWater.position.set(5.0, 1.35, 5.25);
      this.mapGroup.add(bWater);
    } else if (!bodyLinked) {
      // Si eligió un frasco pero aún no vinculó el cuerpo, muestra solo los otros 2 frascos antes de escapar
      if (chosenSpecies !== 'maga') {
        const bEmber = GlobalLabAtlas.createPropMesh('starter_bottle_ember', 36, false);
        bEmber.position.set(4.0, 1.35, 5.25);
        this.mapGroup.add(bEmber);
      }
      if (chosenSpecies !== 'sacerdotisa') {
        const bLeaf = GlobalLabAtlas.createPropMesh('starter_bottle_leaf', 36, false);
        bLeaf.position.set(4.5, 1.35, 5.25);
        this.mapGroup.add(bLeaf);
      }
      if (chosenSpecies !== 'hidromante') {
        const bWater = GlobalLabAtlas.createPropMesh('starter_bottle_water', 36, false);
        bWater.position.set(5.0, 1.35, 5.25);
        this.mapGroup.add(bWater);
      }
    }

    // 3. Tubo de Cristal con Cuerpo de Madera (body_tube, tiles 9..10, 4)
    const tubeFrame = bodyLinked
      ? 'body_tube_empty'
      : starterChosen
      ? 'body_tube_wood_lit'
      : 'body_tube_wood_off';
    const tube = GlobalLabAtlas.createPropMesh(tubeFrame, 36, false);
    tube.position.set(9.5, 0, 4.2);
    this.mapGroup.add(tube);
    this.decorEntries.push({ x: 9, z: 4, meshes: [tube] });

    const tubeLight = new THREE.PointLight(0x5fe3d2, starterChosen && !bodyLinked ? 2.6 : 1.4, 6);
    tubeLight.position.set(9.5, 1.8, 4.6);
    this.mapGroup.add(tubeLight);

    // 4. Pedestal del Códice de Almas (codex_pedestal, tile 3, 3)
    const codexPed = GlobalLabAtlas.createPropMesh('codex_pedestal', 36, false);
    codexPed.position.set(3.0, 0, 3.2);
    this.mapGroup.add(codexPed);
    this.decorEntries.push({ x: 3, z: 3, meshes: [codexPed] });

    // 5. Mapa mural de Anima (anima_world_map, tile 2, 1) y Estanterías (3..4, 1 y 9..10, 1)
    const worldMap = GlobalLabAtlas.createPropMesh('anima_world_map', 36, false);
    worldMap.position.set(2.0, 0.8, 1.05);
    this.mapGroup.add(worldMap);

    const shelfA = GlobalLabAtlas.createPropMesh('bookshelf_tall_a', 36, false);
    shelfA.position.set(3.5, 0, 1.08);
    this.mapGroup.add(shelfA);

    const shelfB = GlobalLabAtlas.createPropMesh('bookshelf_tall_b', 36, false);
    shelfB.position.set(9.5, 0, 1.08);
    this.mapGroup.add(shelfB);

    // 6. Diagrama de la Grieta (rift_diagram, tile 11, 1) - cambia tras derrotar al Guardián
    const riftFrame = bossDefeated ? 'rift_diagram_awakened' : 'rift_diagram_intact';
    const riftDiagram = GlobalLabAtlas.createPropMesh(riftFrame, 36, false);
    riftDiagram.position.set(11.0, 0.8, 1.05);
    this.mapGroup.add(riftDiagram);

    // 7. Purificador de Almas (soul_purifier, tiles 11..12, 8) y Banco de Marionetas (1..2, 8)
    const purifier = GlobalLabAtlas.createPropMesh('soul_purifier', 36, false);
    purifier.position.set(11.5, 0, 8.2);
    this.mapGroup.add(purifier);
    this.decorEntries.push({ x: 11, z: 8, meshes: [purifier] });

    const workbench = GlobalLabAtlas.createPropMesh('puppet_workbench', 36, false);
    workbench.position.set(1.8, 0, 8.2);
    this.mapGroup.add(workbench);
    this.decorEntries.push({ x: 2, z: 8, meshes: [workbench] });
  }

  public update(dt: number, cameraYaw = 0, cameraPitch = 0.55, playerX = 0, playerZ = 0): void {
    this.animTimer += dt;

    // Bloque 44: Update animated water uniform (uWaterTime) without CPU geometry cost
    GlobalTileRenderer.update(dt, cameraYaw);

    // Bloque 36: Update chunked billboard uniforms, tall-grass squash, leaf particles, fireflies & foot occluders
    GlobalOverworldDecor.update(dt, cameraYaw, cameraPitch, playerX, playerZ);

    // Req. 4 & Bloque 44 Req. 5: Billboard on Y axis for vertical props & facades
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

      entry.fadeRanges?.forEach((range) => {
        const opacity = range.opacity + (targetOpacity - range.opacity) * 0.25;
        if (Math.abs(opacity - range.opacity) < 0.001) return;
        range.opacity = opacity;
        const fade = range.mesh.geometry.getAttribute('aFade');
        if (!fade) return;
        for (let i = range.start; i < range.start + range.count; i++) {
          fade.setX(i, opacity);
        }
        fade.needsUpdate = true;
      });

      entry.meshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && mat.transparent !== undefined) {
          const currentOpacity = typeof m.userData.occlusionOpacity === 'number' ? m.userData.occlusionOpacity : 1;
          const opacity = currentOpacity + (targetOpacity - currentOpacity) * 0.25;
          m.userData.occlusionOpacity = opacity;
          mat.transparent = true;
          if (!m.userData.sharedOcclusionMaterial) mat.opacity = opacity;
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
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.clear();
    this.decorEntries = [];
    this.billboardProps = [];
    this.animatedSouls = [];
    this.animatedLanterns = [];
    this.animatedSigns = [];
    GlobalTallerAtlas.clearRegisteredMeshes();
    GlobalMercadoAtlas.clearRegisteredMeshes();
    GlobalLabAtlas.clearRegisteredMeshes();
    GlobalOverworldDecor.clear();
    GlobalTileRenderer.clearMaterials();
  }
}
