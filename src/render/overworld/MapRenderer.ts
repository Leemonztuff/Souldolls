import * as THREE from 'three';
import { MapData } from '../../types/maps';
import { GlobalTallerAtlas } from './TallerAtlas';
import { GlobalMercadoAtlas } from './MercadoAtlas';
import { GlobalLabAtlas } from './LabAtlas';
import { GlobalVillageDecorAtlas } from './VillageDecorAtlas';
import { GlobalOverworldDecor } from './DecorRenderer';
import { GlobalTileRenderer } from './TileRenderer';
import { GlobalSaveService } from '../../services/SaveService';

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

/**
 * Snaps floating-point world coordinates to eliminate subpixel rounding jitter,
 * precision drift, and visible seams across arbitrary viewport resolutions.
 */
export function snapCoord(val: number, precision = 10000): number {
  return Math.round(val * precision) / precision;
}

export class MapRenderer {
  public mapGroup: THREE.Group;
  private currentMap: MapData | null = null;
  private lastScene: THREE.Scene | null = null;

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
    this.billboardProps.push(...tileMapResult.billboardMeshes);
    this.decorEntries.push(...tileMapResult.occludableEntries);

    // --- COEXISTENCE WITH CUSTOM ATLASES (BLOQUES 33 / 34 / 36) ---
    const stage = GlobalTileRenderer.getAuthoringStage();
    if (!GlobalTileRenderer.isClassicFlatMode()) {
      // Special custom facades in Villa Brote / Aldea Marioneta or any Schema 1 map with landmarkHints
      if (
        (map.id === 'villa_brote' || map.id === 'aldea_marioneta' || map.landmarkHints) &&
        (stage === 0 || stage >= 3)
      ) {
        this.buildMarionetteVillageReferenceLandmarks(map);
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
   * BLOQUE 45: CONSTRUCCIÓN COMPLETA DE HITOS Y ARQUITECTURA DE ALDEA MARIONETA
   * Reproduce fielmente la referencia F2:
   * 1. Arco de Piedra Norte (Stone Archway Exit) y Acantilado
   * 2. Laboratorio de ladrillo con Cúpula de Cobre y Torreta de Ki
   * 3. Taller con Tejado Verde, Chimenea con Humo y Patio de Artífices con engranajes
   * 4. Plaza Central con Estatua de Marioneta y Fuente Circular de piedra
   * 5. Mercado de Artífices con 4 Puestos de toldo rayado rojo/amarillo y cajas
   * 6. Huertos vallados, cultivos y tendederos de ropa
   */
  private buildMarionetteVillageReferenceLandmarks(map?: MapData): void {
    const hints = map?.landmarkHints;

    // 1. Arco de Piedra Norte y Muro de Acantilado
    const gateX = hints?.northGateCenter?.x ?? 18.0;
    const gateZ = hints?.northGateCenter?.y ?? 1.5;
    this.createStoneArchwayExit(gateX, gateZ);

    // 2. Laboratorio del Maestro Artífice
    if (!hints || hints.labDoor) {
      const labX = hints?.labDoor?.x ?? 29;
      const labZ = hints?.labDoor?.y ?? 7;
      this.createLabExteriorFacade(labX, labZ);
    }

    // 3. Taller de Artífices y Patio Exterior de Forja
    if (!hints || hints.workshopDoor) {
      const wsX = hints?.workshopDoor?.x ?? 9;
      const wsZ = hints?.workshopDoor?.y ?? 15;
      this.createWorkshopExteriorFacade(wsX, wsZ);
      this.createOutdoorArtisanYard(wsX - 3.0, wsZ + 1.5);
    }

    // 4. Plaza Central: Estatua de Marioneta y Fuente Circular
    if (!hints || hints.fountainCenter) {
      this.createCentralPlazaLandmarks();
    }

    // 5. Mercado de Artífices: Puestos con toldos a rayas y barriles
    if (!hints || hints.marketDoor) {
      const mkX = hints?.marketDoor?.x ?? 27;
      const mkZ = hints?.marketDoor?.y ?? 14;
      this.createMarketSquareStalls(mkX, mkZ);
    }

    // 6. Huertos, vallas de madera y tendederos
    this.createVillageFencesAndGardens();

    // 7. Embellecimiento con fachadas, faroles de ki, pozo de piedra y props del nuevo atlas
    this.buildVillageDecorAtlasProps();
  }

  /**
   * 7. PROPS Y EMBELLECIMIENTO DEL ATLAS DE ALDEA MARIONETA
   */
  private buildVillageDecorAtlasProps(): void {
    const villageAtlasGroup = new THREE.Group();
    villageAtlasGroup.name = 'VillageDecorAtlasProps';

    // A. Elementos exteriores del Refugio del Protagonista (spawn)
    // Buzón de madera en la entrada del refugio
    const mailbox = GlobalVillageDecorAtlas.createPropMesh('village_mailbox', 120, true);
    mailbox.position.set(8.5, 0, 7.8);
    villageAtlasGroup.add(mailbox);
    this.billboardProps.push(mailbox);
    this.decorEntries.push({ x: 8, z: 8, meshes: [mailbox] });

    // Jardinera con flores en la ventana
    const flowerbox1 = GlobalVillageDecorAtlas.createPropMesh('flowerbox_purple', 125, true);
    flowerbox1.position.set(5.8, 0, 7.8);
    villageAtlasGroup.add(flowerbox1);
    this.billboardProps.push(flowerbox1);

    // Maceteros junto a la entrada
    const potSpawn = GlobalVillageDecorAtlas.createPropMesh('potted_plant_small', 125, true);
    potSpawn.position.set(5.2, 0, 8.2);
    villageAtlasGroup.add(potSpawn);
    this.billboardProps.push(potSpawn);

    // B. Barrio residencial Oeste (plantas y flores)
    const potW1 = GlobalVillageDecorAtlas.createPropMesh('potted_plant_medium', 125, true);
    potW1.position.set(8.2, 0, 20.6);
    villageAtlasGroup.add(potW1);
    this.billboardProps.push(potW1);

    const fboxW = GlobalVillageDecorAtlas.createPropMesh('flowerbox_orange', 125, true);
    fboxW.position.set(5.6, 0, 20.6);
    villageAtlasGroup.add(fboxW);
    this.billboardProps.push(fboxW);

    // Tendedero de ropa en patio oeste
    const clothesline = GlobalVillageDecorAtlas.createPropMesh('clothesline_linens', 115, true);
    clothesline.position.set(9.5, 0, 24.2);
    villageAtlasGroup.add(clothesline);
    this.billboardProps.push(clothesline);

    // C. Barrio residencial Este (maceteros y cajas)
    const potE1 = GlobalVillageDecorAtlas.createPropMesh('potted_plant_tall', 125, true);
    potE1.position.set(25.5, 0, 20.6);
    villageAtlasGroup.add(potE1);
    this.billboardProps.push(potE1);

    const cratesE = GlobalVillageDecorAtlas.createPropMesh('wooden_crates_stacked', 120, true);
    cratesE.position.set(24.6, 0, 24.2);
    villageAtlasGroup.add(cratesE);
    this.billboardProps.push(cratesE);

    // D. Pozo de piedra rústico en el huerto norte
    const well = GlobalVillageDecorAtlas.createPropMesh('stone_well_village', 115, true);
    well.position.set(12.0, 0, 6.8);
    villageAtlasGroup.add(well);
    this.billboardProps.push(well);
    this.decorEntries.push({ x: 12, z: 7, meshes: [well] });

    // E. Faroles de la Aldea (sprites fijos y consistentes como el resto de decorados)
    const lanternSpots = [
      { x: 5.2, z: 8.6 },   // Frente al refugio del jugador (spawn inicial)
      { x: 9.0, z: 8.6 },   // Esquina este del refugio
      { x: 15.6, z: 11.2 }, // Plaza central esquina noroeste
      { x: 20.4, z: 11.2 }, // Plaza central esquina noreste
      { x: 15.6, z: 16.8 }, // Plaza central esquina suroeste
      { x: 20.4, z: 16.8 }, // Plaza central esquina sureste
      { x: 17.0, z: 3.5 },  // Entrada Arco norte lado izquierdo
      { x: 19.0, z: 3.5 },  // Entrada Arco norte lado derecho
      { x: 17.0, z: 22.0 }, // Avenida sur
      { x: 19.0, z: 22.0 }, // Avenida sur
    ];

    lanternSpots.forEach(({ x, z }, idx) => {
      const lampName = idx % 2 === 0 ? 'lamppost_ki_teal' : 'lamppost_ki_cyan';
      const lamp = GlobalVillageDecorAtlas.createPropMesh(lampName, 120, true);
      lamp.position.set(x, 0, z);
      villageAtlasGroup.add(lamp);
      this.billboardProps.push(lamp);

      this.decorEntries.push({ x: Math.round(x), z: Math.round(z), meshes: [lamp] });
    });

    // F. Tablón de anuncios en la plaza
    const board = GlobalVillageDecorAtlas.createPropMesh('bulletin_notice_board', 115, true);
    board.position.set(20.8, 0, 14.8);
    villageAtlasGroup.add(board);
    this.billboardProps.push(board);
    this.decorEntries.push({ x: 21, z: 15, meshes: [board] });

    // G. Bancos de madera en la plaza y junto al refugio
    const benchSpawn = GlobalVillageDecorAtlas.createPropMesh('village_wood_bench', 115, true);
    benchSpawn.position.set(5.2, 0, 9.8);
    villageAtlasGroup.add(benchSpawn);
    this.billboardProps.push(benchSpawn);
    this.decorEntries.push({ x: 5, z: 10, meshes: [benchSpawn] });

    const benchL = GlobalVillageDecorAtlas.createPropMesh('village_wood_bench', 115, true);
    benchL.position.set(15.2, 0, 14.0);
    villageAtlasGroup.add(benchL);
    this.billboardProps.push(benchL);
    this.decorEntries.push({ x: 15, z: 14, meshes: [benchL] });

    // H. Soporte de marionetas suspendidas junto al Taller
    const puppetRack = GlobalVillageDecorAtlas.createPropMesh('puppet_display_rack', 115, true);
    puppetRack.position.set(4.8, 0, 14.8);
    villageAtlasGroup.add(puppetRack);
    this.billboardProps.push(puppetRack);
    this.decorEntries.push({ x: 5, z: 15, meshes: [puppetRack] });

    // I. Setos verdes a lo largo de las vallas
    const hedge1 = GlobalVillageDecorAtlas.createPropMesh('green_hedge_bush_1', 115, true);
    hedge1.position.set(14.8, 0, 9.8);
    villageAtlasGroup.add(hedge1);
    this.billboardProps.push(hedge1);

    const hedge2 = GlobalVillageDecorAtlas.createPropMesh('green_hedge_bush_2', 115, true);
    hedge2.position.set(21.2, 0, 9.8);
    villageAtlasGroup.add(hedge2);
    this.billboardProps.push(hedge2);

    this.mapGroup.add(villageAtlasGroup);
  }

  /**
   * 1. Arco de Piedra Norte (Stone Archway Exit)
   */
  private createStoneArchwayExit(centerX: number, centerZ: number): void {
    const archGroup = new THREE.Group();
    archGroup.name = 'StoneArchwayExit';

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.88,
      metalness: 0.05,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.92,
    });

    // Pilares laterales
    const pillarGeo = new THREE.BoxGeometry(1.2, 4.2, 1.4);
    pillarGeo.translate(0, 2.1, 0);

    const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
    leftPillar.position.set(centerX - 1.8, 0, centerZ);
    leftPillar.castShadow = true;
    archGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
    rightPillar.position.set(centerX + 1.8, 0, centerZ);
    rightPillar.castShadow = true;
    archGroup.add(rightPillar);

    // Dintel / Puente del Arco Superior
    const lintelGeo = new THREE.BoxGeometry(4.8, 1.2, 1.5);
    lintelGeo.translate(0, 3.8, 0);
    const lintel = new THREE.Mesh(lintelGeo, stoneMat);
    lintel.position.set(centerX, 0, centerZ);
    lintel.castShadow = true;
    archGroup.add(lintel);

    // Almenas superiores decorativas
    for (let bx = -2.1; bx <= 2.1; bx += 1.05) {
      const battlement = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 1.55), darkStoneMat);
      battlement.position.set(centerX + bx, 4.6, centerZ);
      archGroup.add(battlement);
    }

    // Paredes de acantilado rocoso a los lados del arco norte
    const cliffGeoLeft = new THREE.BoxGeometry(15, 3.8, 1.8);
    cliffGeoLeft.translate(0, 1.9, 0);
    const cliffLeft = new THREE.Mesh(cliffGeoLeft, darkStoneMat);
    cliffLeft.position.set(8.5, 0, centerZ - 0.2);
    archGroup.add(cliffLeft);

    const cliffGeoRight = new THREE.BoxGeometry(15, 3.8, 1.8);
    cliffGeoRight.translate(0, 1.9, 0);
    const cliffRight = new THREE.Mesh(cliffGeoRight, darkStoneMat);
    cliffRight.position.set(27.5, 0, centerZ - 0.2);
    archGroup.add(cliffRight);

    this.mapGroup.add(archGroup);
  }

  /**
   * 4. Plaza Central: Fuente Circular de Marioneta de piedra y agua cristalina
   */
  private createCentralPlazaLandmarks(): void {
    const plazaGroup = new THREE.Group();
    plazaGroup.name = 'CentralPlazaLandmarks';

    // Fuente de marioneta sprite (proporcionada y centrada en la plaza)
    const fountainSprite = GlobalVillageDecorAtlas.createPropMesh('fountain_puppet_water_1', 115, true);
    fountainSprite.position.set(18.0, 0, 14.0);
    plazaGroup.add(fountainSprite);
    this.billboardProps.push(fountainSprite);

    // Sombra de contacto suave bajo la base de la fuente
    const shadowGeo = new THREE.PlaneGeometry(2.6, 1.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(18.0, 0.012, 14.0);
    shadowMesh.renderOrder = 1;
    plazaGroup.add(shadowMesh);

    // Luz acuática de ki en el centro de la fuente
    const fountainLight = new THREE.PointLight(0x38bdf8, 2.0, 7);
    fountainLight.position.set(18.0, 1.2, 14.0);
    plazaGroup.add(fountainLight);

    this.mapGroup.add(plazaGroup);
    this.decorEntries.push({ x: 18, z: 14, meshes: [fountainSprite] });
  }

  /**
   * 3. Patio Exterior de Forja y Carpintería del Taller de Artífices
   */
  private createOutdoorArtisanYard(centerX: number, centerZ: number): void {
    const yardGroup = new THREE.Group();
    yardGroup.name = 'ArtisanYard';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.35 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });

    // Banco de trabajo con planos / herramientas
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.9), woodMat);
    table.position.set(centerX - 0.6, 0.38, centerZ - 0.4);
    yardGroup.add(table);

    // Yunque sobre tocón de roble
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 10), woodMat);
    stump.position.set(centerX + 0.8, 0.3, centerZ - 0.3);
    yardGroup.add(stump);

    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.25), metalMat);
    anvil.position.set(centerX + 0.8, 0.75, centerZ - 0.3);
    yardGroup.add(anvil);

    // Engranajes de marioneta en el suelo
    const gearLarge = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), woodMat);
    gearLarge.position.set(centerX - 1.2, 0.05, centerZ + 0.5);
    gearLarge.rotation.x = 0.1;
    yardGroup.add(gearLarge);

    const gearBrass = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), brassMat);
    gearBrass.position.set(centerX - 0.6, 0.06, centerZ + 0.7);
    yardGroup.add(gearBrass);

    // Valla perimetral de madera
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    const fenceW = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 2.6), fenceMat);
    fenceW.position.set(centerX - 1.9, 0.38, centerZ);
    yardGroup.add(fenceW);

    const fenceS = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.75, 0.1), fenceMat);
    fenceS.position.set(centerX - 0.1, 0.38, centerZ + 1.3);
    yardGroup.add(fenceS);

    this.mapGroup.add(yardGroup);
  }

  /**
   * 5. Mercado de Artífices: 4 Puestos con toldo rayado rojo/amarillo y cajas
   */
  private createMarketSquareStalls(centerX: number, centerZ: number): void {
    const marketGroup = new THREE.Group();
    marketGroup.name = 'MarketStalls';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const stripedRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const stripedYellowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.9 });

    // 4 puestos de mercado (2 en fila norte, 2 en fila sur)
    const stallOffsets = [
      { x: -1.6, z: -1.4 },
      { x: 1.4, z: -1.4 },
      { x: -1.6, z: 1.2 },
      { x: 1.4, z: 1.2 },
    ];

    stallOffsets.forEach(({ x, z }, idx) => {
      const sx = centerX + x;
      const sz = centerZ + z;

      // Mostrador de madera
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.9), woodMat);
      counter.position.set(sx, 0.4, sz);
      counter.castShadow = true;
      marketGroup.add(counter);

      // Postes del toldo
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6), woodMat);
      postL.position.set(sx - 0.75, 1.05, sz - 0.35);
      marketGroup.add(postL);

      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6), woodMat);
      postR.position.set(sx + 0.75, 1.05, sz - 0.35);
      marketGroup.add(postR);

      // Toldo a rayas inclinadas
      const canopyW = 1.85;
      const canopyD = 1.2;
      const canopyY = 2.05;
      const canopyAngle = 0.22;

      for (let s = 0; s < 4; s++) {
        const stripeMat = (s + idx) % 2 === 0 ? stripedRedMat : stripedYellowMat;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(canopyW / 4, 0.06, canopyD), stripeMat);
        stripe.position.set(sx - canopyW / 2 + (canopyW / 8) * (2 * s + 1), canopyY - s * 0.01, sz);
        stripe.rotation.x = canopyAngle;
        stripe.castShadow = true;
        marketGroup.add(stripe);
      }

      // Cajas / barriles junto a cada puesto
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), crateMat);
      crate.position.set(sx + (idx % 2 === 0 ? -1.1 : 1.1), 0.25, sz + 0.2);
      marketGroup.add(crate);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 10), woodMat);
      barrel.position.set(sx + (idx % 2 === 0 ? -1.1 : 1.1), 0.33, sz - 0.4);
      marketGroup.add(barrel);
    });

    // Faroles de mercado en los postes centrales
    const marketLight = new THREE.PointLight(0xfef08a, 2.2, 10);
    marketLight.position.set(centerX, 2.4, centerZ);
    marketGroup.add(marketLight);

    this.mapGroup.add(marketGroup);
    const marketMeshes = marketGroup.children.filter((c): c is THREE.Mesh => (c as any).isMesh);
    this.decorEntries.push({ x: 27, z: 14, meshes: marketMeshes });
  }

  /**
   * 6. Huertos con cultivos, vallas y tendederos de ropa en los vecindarios
   */
  private createVillageFencesAndGardens(): void {
    const gardenGroup = new THREE.Group();
    gardenGroup.name = 'VillageGardens';

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 });
    const cropMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.65 });
    const whiteLinenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const blueLinenMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.8 });

    // Parches de huerto con cultivos
    const gardenSpots = [
      { x: 3.5, z: 6.0, w: 2.2, d: 3.2 },
      { x: 11.5, z: 24.5, w: 2.4, d: 2.2 },
      { x: 23.5, z: 24.5, w: 2.2, d: 2.0 },
      { x: 33.5, z: 17.0, w: 2.2, d: 2.2 },
    ];

    gardenSpots.forEach(({ x, z, w, d }) => {
      // Lecho de tierra cultivada
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), soilMat);
      soil.position.set(x, 0.04, z);
      gardenGroup.add(soil);

      // Surcos con brotes verdes
      for (let rx = -w / 2 + 0.35; rx <= w / 2 - 0.35; rx += 0.55) {
        for (let rz = -d / 2 + 0.35; rz <= d / 2 - 0.35; rz += 0.55) {
          const crop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), cropMat);
          crop.position.set(x + rx, 0.16, z + rz);
          crop.scale.set(1.0, 0.8, 1.0);
          gardenGroup.add(crop);
        }
      }

      // Valla de madera alrededor del huerto
      const fN = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.65, 0.08), fenceMat);
      fN.position.set(x, 0.33, z - d / 2 - 0.15);
      gardenGroup.add(fN);

      const fW = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, d + 0.4), fenceMat);
      fW.position.set(x - w / 2 - 0.15, 0.33, z);
      gardenGroup.add(fW);
    });

    // Tendederos de ropa (x: 11.5, z: 6.0 y x: 23.5, z: 21.0)
    const clotheslines = [
      { x: 11.5, z: 6.0 },
      { x: 23.5, z: 21.0 },
    ];

    clotheslines.forEach(({ x, z }) => {
      const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), fenceMat);
      poleL.position.set(x - 1.1, 0.9, z);
      gardenGroup.add(poleL);

      const poleR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), fenceMat);
      poleR.position.set(x + 1.1, 0.9, z);
      gardenGroup.add(poleR);

      const rope = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), fenceMat);
      rope.position.set(x, 1.6, z);
      gardenGroup.add(rope);

      const cloth1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.02), whiteLinenMat);
      cloth1.position.set(x - 0.4, 1.25, z);
      gardenGroup.add(cloth1);

      const cloth2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.02), blueLinenMat);
      cloth2.position.set(x + 0.4, 1.3, z);
      gardenGroup.add(cloth2);
    });

    this.mapGroup.add(gardenGroup);
  }

  /**
   * FACHADA DEL TALLER EXTERIOR (VILLA BROTE)
   * Req. 4: la fachada del edificio NO rota (queda fija mirando a la cámara base).
   * Un único sprite vertical para la fachada exterior completa.
   */
  private createWorkshopExteriorFacade(doorX: number, doorZ: number): void {
    // Single unified facade sprite from taller_atlas (house_exterior)
    const fachada = GlobalTallerAtlas.createPropMesh('house_exterior', 68, false);
    // Positioned centered at the workshop building front: x: 7.0, z: doorZ
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
    GlobalLabAtlas.clearRegisteredMeshes();
    GlobalVillageDecorAtlas.clearRegisteredMeshes();
    GlobalOverworldDecor.clear();
    GlobalTileRenderer.clearMaterials();
  }
}
