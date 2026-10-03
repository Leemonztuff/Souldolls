import * as THREE from 'three';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number]; // [pivotX, pivotY], e.g. [0.5, 1.0] for feet, [0.5, 0.0] for hanging
  tile?: boolean;
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

/**
 * Canonically matches /data/art/taller_atlas.json (Bloque 33)
 */
export const DEFAULT_TALLER_ATLAS: AtlasData = {
  image: 'taller_atlas.png',
  size: [1200, 896],
  ppu: 32,
  frames: {
    house_exterior: { x: 20, y: 0, w: 535, h: 435, pivot: [0.5, 1.0] },
    sign_hanging: { x: 20, y: 230, w: 100, h: 115, pivot: [0.5, 0.0] },
    chimney: { x: 300, y: 462, w: 55, h: 105, pivot: [0.5, 1.0] },
    roof_teal_a: { x: 0, y: 450, w: 240, h: 210, pivot: [0.5, 1.0] },
    wall_windows_lit: { x: 0, y: 660, w: 300, h: 130, pivot: [0.5, 1.0] },
    window_lit: { x: 25, y: 800, w: 65, h: 80, pivot: [0.5, 1.0] },
    window_dark: { x: 135, y: 800, w: 60, h: 80, pivot: [0.5, 1.0] },
    floor_wood_dark: { x: 310, y: 520, w: 280, h: 350, tile: true },
    oak_counter: { x: 600, y: 505, w: 240, h: 167, pivot: [0.5, 1.0] },
    resonance_machine: { x: 845, y: 500, w: 175, h: 190, pivot: [0.5, 1.0] },
    repair_bench: { x: 1025, y: 515, w: 145, h: 155, pivot: [0.5, 1.0] },
    shelves: { x: 605, y: 730, w: 140, h: 140, pivot: [0.5, 1.0] },
    hanging_mannequins: { x: 755, y: 730, w: 150, h: 135, pivot: [0.5, 0.0] },
    fireplace: { x: 915, y: 730, w: 135, h: 140, pivot: [0.5, 1.0] },
    gear_clock: { x: 1070, y: 750, w: 95, h: 120, pivot: [0.5, 1.0] },
  },
};

/**
 * Spanish aliases mapped to canonical frames for compatibility
 */
export const FRAME_ALIASES: Record<string, string> = {
  fachada: 'house_exterior',
  mostrador: 'oak_counter',
  maquina: 'resonance_machine',
  estantes: 'shelves',
  chimenea: 'fireplace',
  reloj: 'gear_clock',
  letrero: 'sign_hanging',
  maniquies: 'hanging_mannequins',
  techo: 'roof_teal_a',
  pared_ventanas: 'wall_windows_lit',
};

export class TallerAtlasManager {
  private static instance: TallerAtlasManager;
  public atlasData: AtlasData = DEFAULT_TALLER_ATLAS;

  private sharedTexture: THREE.Texture | null = null;
  private sharedMaterial: THREE.MeshBasicMaterial | null = null;
  private atlasImage: HTMLImageElement | null = null;
  private floorTextureCache = new Map<string, THREE.CanvasTexture>();

  // Registered prop meshes for live debug updates (Req. 7)
  private registeredMeshes: Set<THREE.Mesh> = new Set();
  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadJsonData();
    this.initTexture();
  }

  public static getInstance(): TallerAtlasManager {
    if (!TallerAtlasManager.instance) {
      TallerAtlasManager.instance = new TallerAtlasManager();
    }
    return TallerAtlasManager.instance;
  }

  private loadJsonData(): void {
    if (typeof window !== 'undefined') {
      fetch('/data/art/taller_atlas.json')
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
          // Keep DEFAULT_TALLER_ATLAS
        });
    }
  }

  private resolveImagePath(): string {
    const rawImg = this.atlasData.image || 'taller_atlas.png';
    if (rawImg.startsWith('/') || rawImg.startsWith('http')) {
      return rawImg;
    }
    return `/Assets/${rawImg}`;
  }

  private initTexture(): void {
    const imagePath = this.resolveImagePath();
    const loader = new THREE.TextureLoader();

    this.sharedTexture = loader.load(imagePath, (tex) => {
      // Req. 2: Ajustes de textura pixel art (obligatorio)
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.premultiplyAlpha = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    });

    // Texture settings upfront
    this.sharedTexture.colorSpace = THREE.SRGBColorSpace;
    this.sharedTexture.magFilter = THREE.NearestFilter;
    this.sharedTexture.minFilter = THREE.NearestFilter;
    this.sharedTexture.generateMipmaps = false;
    this.sharedTexture.premultiplyAlpha = false;
    this.sharedTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.sharedTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Keep HTMLImageElement for canvas crops (Req. 3)
    this.atlasImage = new Image();
    this.atlasImage.src = imagePath;

    // Req. 4: material: MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: DoubleSide })
    this.sharedMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      alphaTest: 0.5,
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

  public getAtlasImage(): HTMLImageElement | null {
    return this.atlasImage;
  }

  public resolveFrameName(frameName: string): string {
    if (this.atlasData.frames[frameName]) return frameName;
    if (FRAME_ALIASES[frameName] && this.atlasData.frames[FRAME_ALIASES[frameName]]) {
      return FRAME_ALIASES[frameName];
    }
    return frameName;
  }

  /**
   * Req. 1: AtlasRegion(frameName) que devuelve UV normalizados:
   * u0=x/W, v0=1-(y+h)/H, u1=(x+w)/W, v1=1-y/H (con inset de 0.5 px)
   */
  public AtlasRegion(frameName: string): UVRegion | null {
    const resolved = this.resolveFrameName(frameName);
    const frame = this.atlasData.frames[resolved];
    if (!frame) return null;

    const size = this.atlasData.size;
    const W = Array.isArray(size) ? size[0] : size.w;
    const H = Array.isArray(size) ? size[1] : size.h;

    // Inset de 0.5 px en los UV para evitar sangrado entre piezas (Req. 2)
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
    };
  }

  /**
   * Sets cropped UV attributes directly on a PlaneGeometry (Req. 1)
   */
  public applyUVsToGeometry(geometry: THREE.BufferGeometry, region: UVRegion): void {
    const { u0, v0, u1, v1 } = region;
    // Standard Three.js PlaneGeometry vertex order:
    // v0: top-left (-w/2, h/2),    v1: top-right (w/2, h/2)
    // v2: bottom-left (-w/2, -h/2), v3: bottom-right (w/2, -h/2)
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
   * Req. 4: SPRITES VERTICALES
   * PlaneGeometry vertical con UV recortados, pivote en los pies (geometry.translate(0, h/2, 0)),
   * tamaño en mundo = w/PPU x h/PPU (PPU configurable, por defecto 32).
   * Si el frame no existe: fallback cuadrado magenta con nombre (Req. 8).
   */
  public createPropGeometry(
    frameName: string,
    ppu?: number
  ): { geometry: THREE.PlaneGeometry; isFallback: boolean; resolvedName: string } {
    const effectivePpu = ppu || this.atlasData.ppu || 32;
    const resolved = this.resolveFrameName(frameName);
    const region = this.AtlasRegion(resolved);

    if (!region) {
      // Req. 8: Fallback magenta cuadrado
      const fallbackGeo = new THREE.PlaneGeometry(1, 1);
      fallbackGeo.translate(0, 0.5, 0);
      return { geometry: fallbackGeo, isFallback: true, resolvedName: frameName };
    }

    const worldW = region.w / effectivePpu;
    const worldH = region.h / effectivePpu;
    const geometry = new THREE.PlaneGeometry(worldW, worldH);

    // Pivote configurable:
    // Para pivote en los pies [0.5, 1.0]: geometry.translate(0, worldH / 2, 0)
    // Para pivote superior [0.5, 0.0] (letrero/maniquíes colgantes): geometry.translate(0, -worldH / 2, 0)
    const pivot = region.pivot || [0.5, 1.0];
    const dx = (0.5 - pivot[0]) * worldW;
    const dy = (pivot[1] - 0.5) * worldH;
    geometry.translate(dx, dy, 0);

    this.applyUVsToGeometry(geometry, region);
    return { geometry, isFallback: false, resolvedName: resolved };
  }

  /**
   * Creates complete vertical prop Mesh with shared texture (or magenta fallback)
   */
  public createPropMesh(
    frameName: string,
    ppu?: number,
    isBillboard = false
  ): THREE.Mesh {
    const { geometry, isFallback, resolvedName } = this.createPropGeometry(frameName, ppu);

    let mat: THREE.Material;
    if (isFallback) {
      mat = this.createFallbackMaterial(frameName);
    } else {
      // Req. 1 & 4: Un único THREE.Texture por atlas y material compartido
      mat = this.getSharedMaterial();
    }

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.frameName = resolvedName;
    mesh.userData.requestedName = frameName;
    mesh.userData.isBillboard = isBillboard;

    this.registeredMeshes.add(mesh);
    return mesh;
  }

  /**
   * Req. 8: FALLBACK: cuadrado magenta con el nombre del frame
   */
  private createFallbackMaterial(frameName: string): THREE.MeshBasicMaterial {
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(128, 128)
      : document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') as (OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D);

    // Fondo magenta brillante
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 128, 128);

    // Borde negro
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);

    // Texto
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
   * Req. 3: SUELO: pieza "floor_wood_dark" con tile:true se usa en un plano con RepeatWrapping.
   * Genera un canvas aparte con ese recorte (OffscreenCanvas) y úsalo como textura repetible
   * (repeat = tamaño del cuarto en tiles).
   */
  public createFloorMaterial(
    frameName = 'floor_wood_dark',
    repeatW = 14,
    repeatH = 12
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

    const frame = this.atlasData.frames[resolved] || { x: 310, y: 520, w: 280, h: 350 };
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
        // Fallback tono madera cálido mientras carga
        ctx.fillStyle = '#5c3317';
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

  /**
   * Actualiza el rectángulo de un frame en vivo (F2 debug) y refresca todas las geometrías registradas
   */
  public updateFrameRect(frameName: string, rect: Partial<AtlasFrame>): void {
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

    if (resolved === 'floor_wood_dark') {
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

export const GlobalTallerAtlas = TallerAtlasManager.getInstance();
