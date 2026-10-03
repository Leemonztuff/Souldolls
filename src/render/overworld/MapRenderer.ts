import * as THREE from 'three';
import { MapData } from '../../types/maps';
import { GlobalAssetRegistry } from '../procedural/AssetRegistry';
import { TileType } from '../procedural/TileFactory';

interface DecorEntry {
  x: number;
  z: number;
  meshes: THREE.Mesh[];
}

export class MapRenderer {
  public mapGroup: THREE.Group;
  private currentMap: MapData | null = null;

  private tallGrassGroup: THREE.Group = new THREE.Group();
  private decorEntries: DecorEntry[] = [];
  private animTimer = 0;

  constructor() {
    this.mapGroup = new THREE.Group();
  }

  public buildMap(map: MapData, scene: THREE.Scene): void {
    this.clear();
    this.currentMap = map;

    // Set atmosphere & fog
    scene.background = new THREE.Color(map.skyColor || 0x60a5fa);
    scene.fog = new THREE.FogExp2(map.skyColor || 0x60a5fa, map.indoor ? 0.04 : 0.022);

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

    // 1. Create InstancedMesh for each ground tile type
    tileInstancesByType.forEach((matrices, type) => {
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

    // 2. Build Decor & Structures (Trees, Rocks, Buildings, Walls, Tall Grass)
    this.tallGrassGroup = new THREE.Group();
    this.mapGroup.add(this.tallGrassGroup);
    this.decorEntries = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const decorType = map.decor ? map.decor[y][x] : null;
        const isTallGrass = map.encounters && map.encounters[y][x] === 'tall_grass';

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

        if (isTallGrass) {
          this.createTallGrassObject(x, y);
        }
      }
    }

    scene.add(this.mapGroup);
  }

  private createTreeObject(x: number, z: number): void {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    // Trunk
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

    // Foliage (stacked low-poly cones)
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

  public update(dt: number): void {
    this.animTimer += dt;

    // Gentle wind sway for tall grass
    if (this.tallGrassGroup) {
      this.tallGrassGroup.children.forEach((grass, idx) => {
        grass.rotation.z = Math.sin(this.animTimer * 2.5 + idx * 0.7) * 0.08;
      });
    }
  }

  /**
   * Dynamically fades structures (buildings, roofs, trees) standing between camera and player
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
        if (mat) {
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
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    };

    disposeHierarchy(this.mapGroup);
    this.mapGroup.clear();
    this.decorEntries = [];
  }
}
