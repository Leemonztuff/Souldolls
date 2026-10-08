import * as THREE from 'three';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number]; // [pivotX, pivotY], e.g. [0.5, 1.0] for feet
  tile?: boolean;
  flat?: boolean;
  glow?: boolean;
  ppu?: number;
}

export interface AtlasData {
  image: string;
  size: [number, number] | { w: number; h: number };
  ppu?: number;
  frames: Record<string, AtlasFrame>;
}

export interface UVRegion {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
  pivot: [number, number];
  tile?: boolean;
}

export const DEFAULT_VILLAGE_DECOR_ATLAS: AtlasData = {
  image: 'village_decor_atlas.png',
  size: [1200, 896],
  ppu: 48,
  frames: {
    // --- BAND 1: HOUSES / FACADES (Y: 15..300) ---
    facade_house_teal: { x: 26, y: 20, w: 345, h: 275, pivot: [0.5, 1.0], ppu: 55 },
    facade_house_brown: { x: 428, y: 20, w: 345, h: 275, pivot: [0.5, 1.0], ppu: 55 },
    facade_house_slate: { x: 832, y: 15, w: 342, h: 283, pivot: [0.5, 1.0], ppu: 55 },

    // --- BAND 2: CENTRAL PLAZA FOUNTAIN & STONE WELL (Y: 310..605) ---
    fountain_central_plaza: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
    fountain_puppet_water_1: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
    fountain_puppet_stone: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
    fountain_puppet_water_2: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
    fountain_puppet_water_3: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },

    stone_well_gazebo: { x: 727, y: 320, w: 233, h: 278, pivot: [0.5, 1.0], ppu: 65 },
    stone_well_village: { x: 727, y: 320, w: 233, h: 278, pivot: [0.5, 1.0], ppu: 65 },

    // --- BAND 3: PROPS, LIGHTS, FURNITURE & DECOR (Y: 615..885) ---
    lamppost_ki_teal: { x: 18, y: 628, w: 96, h: 252, pivot: [0.5, 1.0], ppu: 65 },
    lamppost_ki_cyan: { x: 118, y: 626, w: 100, h: 254, pivot: [0.5, 1.0], ppu: 65 },
    signpost_arrows: { x: 118, y: 626, w: 100, h: 254, pivot: [0.5, 1.0], ppu: 65 },
    lamppost_pole_slim: { x: 247, y: 631, w: 46, h: 249, pivot: [0.5, 1.0], ppu: 65 },

    village_wood_bench: { x: 351, y: 620, w: 201, h: 200, pivot: [0.5, 1.0], ppu: 65 },
    bulletin_notice_board: { x: 351, y: 620, w: 201, h: 200, pivot: [0.5, 1.0], ppu: 65 },

    village_mailbox: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
    wooden_crates_stacked: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
    wooden_crate_single: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
    wooden_barrel: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },

    puppet_statue_pedestal: { x: 768, y: 650, w: 185, h: 230, pivot: [0.5, 1.0], ppu: 65 },
    puppet_display_rack: { x: 768, y: 650, w: 185, h: 230, pivot: [0.5, 1.0], ppu: 65 },

    potted_plant_small: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
    potted_plant_medium: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
    potted_plant_tall: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
    flowerbox_purple: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
    flowerbox_orange: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
    flowerbox_white: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },

    green_hedge_bush_1: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
    green_hedge_bush_2: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
    clothesline_linens: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
  },
};

export class VillageDecorAtlasManager {
  private static instance: VillageDecorAtlasManager;
  public atlasData: AtlasData = DEFAULT_VILLAGE_DECOR_ATLAS;

  private sharedTexture: THREE.Texture | null = null;
  private sharedMaterial: THREE.MeshBasicMaterial | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;

  private registeredMeshes: Set<THREE.Mesh> = new Set();
  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadJsonData();
    this.initTexture();
  }

  public static getInstance(): VillageDecorAtlasManager {
    if (!VillageDecorAtlasManager.instance) {
      VillageDecorAtlasManager.instance = new VillageDecorAtlasManager();
    }
    return VillageDecorAtlasManager.instance;
  }

  private loadJsonData(): void {
    if (typeof window !== 'undefined') {
      fetch('/data/art/village_decor_atlas.json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: AtlasData | null) => {
          if (data && data.frames) {
            this.atlasData = {
              ...data,
              ppu: data.ppu || 32,
            };
            this.listeners.forEach((cb) => cb());
          }
        })
        .catch(() => {
          this.atlasData = DEFAULT_VILLAGE_DECOR_ATLAS;
        });
    }
  }

  private resolveImagePath(): string {
    const rawImg = this.atlasData.image || 'village_decor_atlas.png';
    if (rawImg.startsWith('/') || rawImg.startsWith('http')) {
      return rawImg;
    }
    return `/assets/atlases/${rawImg}`;
  }

  private initTexture(): void {
    const imagePath = this.resolveImagePath();
    if (typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();
      this.sharedTexture = loader.load(imagePath, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.premultiplyAlpha = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        if (this.sharedMaterial) this.sharedMaterial.needsUpdate = true;
        if (this.glowMaterial) this.glowMaterial.needsUpdate = true;
      });
    } else {
      this.sharedTexture = new THREE.Texture();
    }

    this.sharedTexture.colorSpace = THREE.SRGBColorSpace;
    this.sharedTexture.magFilter = THREE.NearestFilter;
    this.sharedTexture.minFilter = THREE.NearestFilter;
    this.sharedTexture.generateMipmaps = false;
    this.sharedTexture.premultiplyAlpha = false;
    this.sharedTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.sharedTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.sharedMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      alphaTest: 0.5,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    this.glowMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  public getUVRegion(frameName: string): UVRegion | null {
    const frame = this.atlasData.frames[frameName];
    if (!frame) return null;

    const atlasW = Array.isArray(this.atlasData.size) ? this.atlasData.size[0] : this.atlasData.size.w;
    const atlasH = Array.isArray(this.atlasData.size) ? this.atlasData.size[1] : this.atlasData.size.h;

    const u0 = (frame.x + 0.5) / atlasW;
    const u1 = (frame.x + frame.w - 0.5) / atlasW;
    const v0 = 1.0 - (frame.y + frame.h - 0.5) / atlasH;
    const v1 = 1.0 - (frame.y + 0.5) / atlasH;

    return {
      u0,
      v0,
      u1,
      v1,
      w: frame.w,
      h: frame.h,
      pivot: frame.pivot || [0.5, 1.0],
      tile: frame.tile,
    };
  }

  public createPropMesh(frameName: string, customPpu?: number, isBillboard = true): THREE.Mesh {
    const uv = this.getUVRegion(frameName);
    const frame = this.atlasData.frames[frameName];
    const ppu = customPpu || frame?.ppu || this.atlasData.ppu || 32;

    const meshW = uv ? uv.w / ppu : 1.0;
    const meshH = uv ? uv.h / ppu : 1.0;

    const geometry = new THREE.PlaneGeometry(meshW, meshH);
    const pivot = uv?.pivot || [0.5, 1.0];
    const dx = (0.5 - pivot[0]) * meshW;
    const dy = (pivot[1] - 0.5) * meshH;
    geometry.translate(dx, dy, 0);

    if (uv) {
      const uvAttr = geometry.attributes.uv;
      uvAttr.setXY(0, uv.u0, uv.v1);
      uvAttr.setXY(1, uv.u1, uv.v1);
      uvAttr.setXY(2, uv.u0, uv.v0);
      uvAttr.setXY(3, uv.u1, uv.v0);
      uvAttr.needsUpdate = true;
    }

    if (!this.sharedMaterial) {
      this.initTexture();
    }

    const mat = frame?.glow ? (this.glowMaterial || this.sharedMaterial!) : this.sharedMaterial!;
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = `VillageProp_${frameName}`;
    mesh.castShadow = !frame?.glow;
    mesh.receiveShadow = !frame?.glow;
    mesh.userData = { isBillboard, frameName };

    this.registeredMeshes.add(mesh);
    return mesh;
  }

  public clearRegisteredMeshes(): void {
    this.registeredMeshes.clear();
  }
}

export const GlobalVillageDecorAtlas = VillageDecorAtlasManager.getInstance();
