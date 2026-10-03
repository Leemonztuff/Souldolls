import * as THREE from 'three';

export interface MercadoAtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number]; // [pivotX, pivotY], e.g. [0.5, 1.0] for feet, [0.5, 0.0] for hanging
  tile?: boolean;
  flat?: boolean; // Horizontal plane on the floor (like rug_big)
  glow?: boolean; // Additive glowing light
  ppu?: number; // Custom PPU (64 for facades, 32 for props)
}

export interface MercadoAtlasData {
  image: string;
  size: [number, number] | { w: number; h: number };
  ppu?: number;
  frames: Record<string, MercadoAtlasFrame>;
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
  flat?: boolean;
  glow?: boolean;
  ppu?: number;
}

export const DEFAULT_MERCADO_ATLAS: MercadoAtlasData = {
  image: 'mercado_atlas.png',
  size: [1200, 896],
  ppu: 32,
  frames: {
    ext_facade_left: { x: 150, y: 57, w: 290, h: 353, pivot: [0.5, 1.0], ppu: 64 },
    ext_facade_center: { x: 440, y: 57, w: 280, h: 353, pivot: [0.5, 1.0], ppu: 64 },
    ext_facade_right: { x: 720, y: 57, w: 270, h: 353, pivot: [0.5, 1.0], ppu: 64 },
    ext_sign_scale: { x: 890, y: 8, w: 84, h: 38, pivot: [0.5, 0.0], ppu: 32 },
    ext_lanterns_teal: { x: 772, y: 8, w: 42, h: 38, pivot: [0.5, 0.0], glow: true, ppu: 32 },
    ext_lanterns_purple: { x: 834, y: 8, w: 42, h: 38, pivot: [0.5, 0.0], glow: true, ppu: 32 },
    floor_wood_dark: { x: 0, y: 778, w: 240, h: 118, tile: true },
    floor_wood_light: { x: 240, y: 778, w: 240, h: 118, tile: true },
    rug_big: { x: 508, y: 784, w: 184, h: 86, flat: true, pivot: [0.5, 0.5], ppu: 32 },
    int_shelf_left: { x: 0, y: 460, w: 280, h: 160, pivot: [0.5, 1.0], ppu: 40 },
    int_shelf_center: { x: 280, y: 460, w: 280, h: 160, pivot: [0.5, 1.0], ppu: 40 },
    int_shelf_right: { x: 560, y: 460, w: 278, h: 160, pivot: [0.5, 1.0], ppu: 40 },
    int_counter: { x: 479, y: 620, w: 242, h: 118, pivot: [0.5, 1.0], ppu: 38 },
    int_vitrina_left: { x: 3, y: 631, w: 176, h: 129, pivot: [0.5, 1.0], ppu: 36 },
    int_vitrina_right: { x: 242, y: 631, w: 176, h: 129, pivot: [0.5, 1.0], ppu: 36 },
    int_mannequin_1: { x: 848, y: 492, w: 52, h: 135, pivot: [0.5, 1.0], ppu: 36 },
    int_mannequin_2: { x: 904, y: 492, w: 56, h: 135, pivot: [0.5, 1.0], ppu: 36 },
    int_mannequin_3: { x: 964, y: 492, w: 60, h: 135, pivot: [0.5, 1.0], ppu: 36 },
    int_weapon_rack: { x: 1047, y: 501, w: 142, h: 129, pivot: [0.5, 1.0], ppu: 36 },
    int_notice_board: { x: 780, y: 663, w: 250, h: 107, pivot: [0.5, 1.0], ppu: 36 },
    int_safe: { x: 1080, y: 668, w: 109, h: 102, pivot: [0.5, 1.0], ppu: 36 },
    int_crystal_cluster: { x: 780, y: 777, w: 120, h: 119, pivot: [0.5, 1.0], ppu: 34 },
    int_crystal_pedestal: { x: 910, y: 777, w: 120, h: 119, pivot: [0.5, 1.0], ppu: 34 },
  },
};

export const MERCADO_FRAME_ALIASES: Record<string, string> = {
  mostrador: 'int_counter',
  estante_izq: 'int_shelf_left',
  estante_centro: 'int_shelf_center',
  estante_der: 'int_shelf_right',
  vitrina_souls: 'int_vitrina_left',
  vitrina_items: 'int_vitrina_right',
  alfombra: 'rug_big',
  caja_fuerte: 'int_safe',
  tablon: 'int_notice_board',
  armero: 'int_weapon_rack',
  cristales: 'int_crystal_cluster',
};

export class MercadoAtlasManager {
  private static instance: MercadoAtlasManager;
  public atlasData: MercadoAtlasData = DEFAULT_MERCADO_ATLAS;

  private sharedTexture: THREE.Texture | null = null;
  private sharedMaterial: THREE.MeshBasicMaterial | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;
  private circularShadowTexture: THREE.CanvasTexture | null = null;
  private atlasImage: HTMLImageElement | null = null;
  private floorTextureCache = new Map<string, THREE.CanvasTexture>();

  private registeredMeshes: Set<THREE.Mesh> = new Set();
  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadJsonData();
    this.initTexture();
  }

  public static getInstance(): MercadoAtlasManager {
    if (!MercadoAtlasManager.instance) {
      MercadoAtlasManager.instance = new MercadoAtlasManager();
    }
    return MercadoAtlasManager.instance;
  }

  private loadJsonData(): void {
    if (typeof window !== 'undefined') {
      fetch('/data/art/mercado_atlas.json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: MercadoAtlasData | null) => {
          if (data && data.frames) {
            this.atlasData = {
              ...data,
              ppu: data.ppu || 32,
            };
            this.listeners.forEach((cb) => cb());
          }
        })
        .catch(() => {});
    }
  }

  private resolveImagePath(): string {
    const rawImg = this.atlasData.image || 'mercado_atlas.png';
    if (rawImg.startsWith('/') || rawImg.startsWith('http')) {
      return rawImg;
    }
    return `/Assets/${rawImg}`;
  }

  private initTexture(): void {
    const imagePath = this.resolveImagePath();
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
    });

    this.sharedTexture.colorSpace = THREE.SRGBColorSpace;
    this.sharedTexture.magFilter = THREE.NearestFilter;
    this.sharedTexture.minFilter = THREE.NearestFilter;
    this.sharedTexture.generateMipmaps = false;
    this.sharedTexture.premultiplyAlpha = false;
    this.sharedTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.sharedTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.atlasImage = new Image();
    this.atlasImage.src = imagePath;

    this.sharedMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });

    // Additive glow material for lanterns (Req. 4)
    this.glowMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  public getSharedTexture(): THREE.Texture {
    if (!this.sharedTexture) this.initTexture();
    return this.sharedTexture!;
  }

  public getSharedMaterial(): THREE.MeshBasicMaterial {
    if (!this.sharedMaterial) this.initTexture();
    return this.sharedMaterial!;
  }

  public getGlowMaterial(): THREE.MeshBasicMaterial {
    if (!this.glowMaterial) this.initTexture();
    return this.glowMaterial!;
  }

  public getAtlasImage(): HTMLImageElement | null {
    return this.atlasImage;
  }

  public resolveFrameName(frameName: string): string {
    if (this.atlasData.frames[frameName]) return frameName;
    if (MERCADO_FRAME_ALIASES[frameName] && this.atlasData.frames[MERCADO_FRAME_ALIASES[frameName]]) {
      return MERCADO_FRAME_ALIASES[frameName];
    }
    return frameName;
  }

  /**
   * Reutiliza AtlasRegion del Bloque 33 con inset de 0.5 px (Req. 1)
   */
  public AtlasRegion(frameName: string): UVRegion | null {
    const resolved = this.resolveFrameName(frameName);
    const frame = this.atlasData.frames[resolved];
    if (!frame) return null;

    const size = this.atlasData.size;
    const W = Array.isArray(size) ? size[0] : size.w;
    const H = Array.isArray(size) ? size[1] : size.h;

    const u0 = (frame.x + 0.5) / W;
    const u1 = (frame.x + frame.w - 0.5) / W;
    const v0 = 1 - (frame.y + frame.h - 0.5) / H;
    const v1 = 1 - (frame.y + 0.5) / H;

    return {
      u0,
      v0,
      u1,
      v1,
      w: frame.w,
      h: frame.h,
      pivot: frame.pivot || [0.5, 1.0],
      tile: frame.tile,
      flat: frame.flat,
      glow: frame.glow,
      ppu: frame.ppu,
    };
  }

  public applyUVsToGeometry(geometry: THREE.BufferGeometry, region: UVRegion): void {
    const { u0, v0, u1, v1 } = region;
    const uvs = new Float32Array([
      u0, v1, // top-left
      u1, v1, // top-right
      u0, v0, // bottom-left
      u1, v0, // bottom-right
    ]);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.attributes.uv.needsUpdate = true;
  }

  /**
   * Req. 5 & 6: Geometría vertical con pivote en los pies o horizontal en el suelo (flat)
   */
  public createPropGeometry(
    frameName: string,
    ppuOverride?: number
  ): { geometry: THREE.PlaneGeometry; isFallback: boolean; resolvedName: string; region: UVRegion | null } {
    const resolved = this.resolveFrameName(frameName);
    const region = this.AtlasRegion(resolved);

    if (!region) {
      const fallbackGeo = new THREE.PlaneGeometry(1, 1);
      fallbackGeo.translate(0, 0.5, 0);
      return { geometry: fallbackGeo, isFallback: true, resolvedName: frameName, region: null };
    }

    const effectivePpu = ppuOverride || region.ppu || this.atlasData.ppu || 32;
    const worldW = region.w / effectivePpu;
    const worldH = region.h / effectivePpu;
    const geometry = new THREE.PlaneGeometry(worldW, worldH);

    if (region.flat) {
      // Horizontal flat plane lying on the floor (like rug_big)
      geometry.rotateX(-Math.PI / 2);
    } else {
      // Vertical sprite with configurable pivot
      const pivot = region.pivot || [0.5, 1.0];
      const dx = (0.5 - pivot[0]) * worldW;
      const dy = (pivot[1] - 0.5) * worldH;
      geometry.translate(dx, dy, 0);
    }

    this.applyUVsToGeometry(geometry, region);
    return { geometry, isFallback: false, resolvedName: resolved, region };
  }

  /**
   * Crea un sprite completo (vertical o flat) con material compartido o aditivo (glow)
   */
  public createPropMesh(
    frameName: string,
    ppuOverride?: number,
    isBillboard = false
  ): THREE.Mesh {
    const { geometry, isFallback, resolvedName, region } = this.createPropGeometry(frameName, ppuOverride);

    let mat: THREE.Material;
    if (isFallback) {
      mat = this.createFallbackMaterial(frameName);
    } else if (region?.glow) {
      mat = this.getGlowMaterial();
    } else {
      mat = this.getSharedMaterial();
    }

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = !region?.flat && !region?.glow;
    mesh.receiveShadow = true;
    mesh.userData.frameName = resolvedName;
    mesh.userData.atlas = 'mercado';
    mesh.userData.isBillboard = isBillboard;
    mesh.userData.glow = region?.glow || false;

    this.registeredMeshes.add(mesh);
    return mesh;
  }

  /**
   * Sombra suave circular para colocar en los pies de props verticales (Req. 5)
   */
  public createCircularShadow(radius = 0.5): THREE.Mesh {
    if (!this.circularShadowTexture) {
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(64, 64)
        : document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d') as (OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D);
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.18)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);

      this.circularShadowTexture = new THREE.CanvasTexture(canvas as any);
      this.circularShadowTexture.colorSpace = THREE.SRGBColorSpace;
    }

    const shadowGeo = new THREE.PlaneGeometry(radius * 2, radius * 1.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.circularShadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.003;
    return shadow;
  }

  /**
   * Req. 9: FALLBACK cuadrado magenta con nombre del frame
   */
  private createFallbackMaterial(frameName: string): THREE.MeshBasicMaterial {
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(128, 128)
      : document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') as (OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D);

    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MISSING', 64, 45);
    ctx.fillText(frameName.substring(0, 15), 64, 75);

    const tex = new THREE.CanvasTexture(canvas as any);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  }

  /**
   * Req. 5: SUELO con floor_wood_dark / floor_wood_light en planos con RepeatWrapping
   */
  public createFloorMaterial(
    frameName = 'floor_wood_dark',
    repeatW = 10,
    repeatH = 8
  ): THREE.MeshStandardMaterial {
    const resolved = this.resolveFrameName(frameName);
    const cacheKey = `${resolved}_${repeatW}x${repeatH}`;
    if (this.floorTextureCache.has(cacheKey)) {
      const cachedTex = this.floorTextureCache.get(cacheKey)!;
      return new THREE.MeshStandardMaterial({
        map: cachedTex,
        roughness: 0.75,
        metalness: 0.05,
      });
    }

    const frame = this.atlasData.frames[resolved] || { x: 0, y: 778, w: 240, h: 118 };
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(frame.w, frame.h)
      : document.createElement('canvas');
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext('2d') as (OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D);

    const drawCrop = () => {
      if (this.atlasImage && this.atlasImage.complete && this.atlasImage.naturalWidth > 0) {
        ctx.clearRect(0, 0, frame.w, frame.h);
        ctx.drawImage(
          this.atlasImage,
          frame.x, frame.y, frame.w, frame.h,
          0, 0, frame.w, frame.h
        );
      } else {
        ctx.fillStyle = resolved === 'floor_wood_light' ? '#78350f' : '#451a03';
        ctx.fillRect(0, 0, frame.w, frame.h);
      }
      tex.needsUpdate = true;
    };

    const tex = new THREE.CanvasTexture(canvas as any);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatW, repeatH);

    drawCrop();

    if (this.atlasImage && !this.atlasImage.complete) {
      this.atlasImage.addEventListener('load', drawCrop);
    }

    this.floorTextureCache.set(cacheKey, tex);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.75,
      metalness: 0.05,
    });
  }

  public updateFrameRect(frameName: string, rect: Partial<MercadoAtlasFrame>): void {
    const resolved = this.resolveFrameName(frameName);
    const existing = this.atlasData.frames[resolved];
    if (!existing) return;

    Object.assign(existing, rect);
    const region = this.AtlasRegion(resolved);
    if (!region) return;

    this.registeredMeshes.forEach((mesh) => {
      if (mesh.userData.frameName === resolved) {
        this.applyUVsToGeometry(mesh.geometry, region);
      }
    });

    if (resolved === 'floor_wood_dark' || resolved === 'floor_wood_light') {
      this.floorTextureCache.clear();
    }

    this.listeners.forEach((cb) => cb());
  }

  public onAtlasUpdated(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public unregisterMesh(mesh: THREE.Mesh): void {
    this.registeredMeshes.delete(mesh);
  }

  public clearRegisteredMeshes(): void {
    this.registeredMeshes.clear();
  }
}

export const GlobalMercadoAtlas = MercadoAtlasManager.getInstance();
