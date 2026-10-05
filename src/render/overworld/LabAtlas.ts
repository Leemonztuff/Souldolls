import * as THREE from 'three';

export interface LabAtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number];
  tile?: boolean;
  flat?: boolean;
  glow?: boolean;
  ppu?: number;
}

export interface LabAtlasData {
  image: string;
  size: [number, number] | { w: number; h: number };
  ppu?: number;
  frames: Record<string, LabAtlasFrame>;
}

export interface LabUVRegion {
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

export const DEFAULT_LAB_ATLAS: LabAtlasData = {
  image: 'lab_atlas.png',
  size: [1024, 1024],
  ppu: 32,
  frames: {
    lab_facade_left: { x: 16, y: 16, w: 192, h: 256, pivot: [0.5, 1.0], ppu: 64 },
    lab_facade_center: { x: 224, y: 16, w: 192, h: 256, pivot: [0.5, 1.0], ppu: 64 },
    lab_facade_right: { x: 432, y: 16, w: 192, h: 256, pivot: [0.5, 1.0], ppu: 64 },
    lab_roof_slate_violet: { x: 640, y: 16, w: 256, h: 112, pivot: [0.5, 1.0], ppu: 64 },
    lab_tower_observatory: { x: 16, y: 288, w: 192, h: 288, pivot: [0.5, 1.0], ppu: 64 },
    lab_chimney_ki: { x: 224, y: 288, w: 64, h: 112, pivot: [0.5, 1.0], ppu: 48, glow: true },
    lab_sign_gear_bottle: { x: 304, y: 288, w: 80, h: 64, pivot: [0.5, 0.0], ppu: 32 },
    lab_floor_wood_dark: { x: 400, y: 288, w: 128, h: 128, tile: true },
    lab_floor_stone: { x: 544, y: 288, w: 128, h: 128, tile: true },
    lab_rug_emblem: { x: 688, y: 288, w: 160, h: 96, flat: true, pivot: [0.5, 0.5], ppu: 32 },
    lab_wall_timber: { x: 864, y: 288, w: 128, h: 128, pivot: [0.5, 1.0], ppu: 32 },
    starter_pedestal_full: { x: 16, y: 592, w: 96, h: 96, pivot: [0.5, 1.0], ppu: 36 },
    starter_pedestal_empty: { x: 128, y: 592, w: 96, h: 96, pivot: [0.5, 1.0], ppu: 36 },
    starter_bottle_ember: { x: 240, y: 592, w: 32, h: 48, pivot: [0.5, 1.0], ppu: 32, glow: true },
    starter_bottle_leaf: { x: 288, y: 592, w: 32, h: 48, pivot: [0.5, 1.0], ppu: 32, glow: true },
    starter_bottle_water: { x: 336, y: 592, w: 32, h: 48, pivot: [0.5, 1.0], ppu: 32, glow: true },
    body_tube_wood_off: { x: 384, y: 592, w: 64, h: 128, pivot: [0.5, 1.0], ppu: 36 },
    body_tube_wood_lit: { x: 464, y: 592, w: 64, h: 128, pivot: [0.5, 1.0], ppu: 36, glow: true },
    body_tube_empty: { x: 544, y: 592, w: 64, h: 128, pivot: [0.5, 1.0], ppu: 36 },
    master_desk: { x: 624, y: 592, w: 128, h: 96, pivot: [0.5, 1.0], ppu: 36 },
    codex_pedestal: { x: 768, y: 592, w: 64, h: 96, pivot: [0.5, 1.0], ppu: 36 },
    anima_world_map: { x: 848, y: 592, w: 96, h: 80, pivot: [0.5, 1.0], ppu: 36 },
    rift_diagram_intact: { x: 16, y: 736, w: 96, h: 80, pivot: [0.5, 1.0], ppu: 36 },
    rift_diagram_awakened: { x: 128, y: 736, w: 96, h: 80, pivot: [0.5, 1.0], ppu: 36, glow: true },
    soul_purifier: { x: 240, y: 736, w: 96, h: 112, pivot: [0.5, 1.0], ppu: 36 },
    puppet_workbench: { x: 352, y: 736, w: 128, h: 96, pivot: [0.5, 1.0], ppu: 36 },
    bookshelf_tall_a: { x: 496, y: 736, w: 96, h: 128, pivot: [0.5, 1.0], ppu: 36 },
    bookshelf_tall_b: { x: 608, y: 736, w: 96, h: 128, pivot: [0.5, 1.0], ppu: 36 },
  },
};

export const LAB_FRAME_ALIASES: Record<string, string> = {
  fachada_izq: 'lab_facade_left',
  fachada_centro: 'lab_facade_center',
  fachada_der: 'lab_facade_right',
  techo_pizarra: 'lab_roof_slate_violet',
  torre: 'lab_tower_observatory',
  chimenea: 'lab_chimney_ki',
  letrero: 'lab_sign_gear_bottle',
  pedestal_iniciales: 'starter_pedestal_full',
  tubo_cuerpo: 'body_tube_wood_off',
  escritorio_maestro: 'master_desk',
  pedestal_codice: 'codex_pedestal',
  mapa_anima: 'anima_world_map',
  diagrama_grieta: 'rift_diagram_intact',
  purificador: 'soul_purifier',
};

/**
 * BLOQUE 35 Req. 1: Gestor de Atlas por Rectángulos del Laboratorio del Maestro Artífice.
 * Reutiliza la convención AtlasRegion del Bloque 33/34 con:
 * - SRGBColorSpace, NearestFilter, generateMipmaps = false, inset UV 0.5 px
 * - Síntesis pixel-art de alta fidelidad (paleta de marca) y fallback magenta explícito para frames inexistentes.
 */
export class LabAtlasManager {
  private static instance: LabAtlasManager;
  public atlasData: LabAtlasData = DEFAULT_LAB_ATLAS;

  private sharedTexture: THREE.Texture | null = null;
  private sharedMaterial: THREE.MeshBasicMaterial | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;
  private registeredMeshes: Set<THREE.Mesh> = new Set();

  private constructor() {
    this.initTexture();
  }

  public static getInstance(): LabAtlasManager {
    if (!LabAtlasManager.instance) {
      LabAtlasManager.instance = new LabAtlasManager();
    }
    return LabAtlasManager.instance;
  }

  private initTexture(): void {
    const size = this.atlasData.size;
    const W = Array.isArray(size) ? size[0] : size.w;
    const H = Array.isArray(size) ? size[1] : size.h;

    if (typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined') {
      const canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(W, H)
          : document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
      if (ctx) {
        this.paintLabAtlasSprites(ctx);
      }
      this.sharedTexture = new THREE.CanvasTexture(canvas as any);
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
    this.sharedTexture.needsUpdate = true;

    this.sharedMaterial = new THREE.MeshBasicMaterial({
      map: this.sharedTexture,
      transparent: true,
      alphaTest: 0.5,
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

  private paintLabAtlasSprites(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  ): void {
    ctx.clearRect(0, 0, 1024, 1024);

    const drawBox = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      border = '#14101C',
      accent?: string
    ) => {
      ctx.fillStyle = border;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      if (accent) {
        ctx.fillStyle = accent;
        ctx.fillRect(x + 6, y + 6, w - 12, 8);
      }
    };

    for (const [name, f] of Object.entries(this.atlasData.frames)) {
      if (name.startsWith('lab_facade_')) {
        // Timber frame + plaster + stone base (#4B3A5E / #2A1F2D / #A89BB0)
        drawBox(f.x, f.y, f.w, f.h, '#4B3A5E', '#14101C', '#8A6A3B');
        ctx.fillStyle = '#6F6478';
        ctx.fillRect(f.x + 4, f.y + f.h - 42, f.w - 8, 38);
        if (name === 'lab_facade_center') {
          // Double wooden door
          drawBox(f.x + 56, f.y + f.h - 110, 80, 106, '#2A1F2D', '#14101C', '#E8B84A');
        } else {
          // Warm glowing window (#E8B84A)
          drawBox(f.x + 56, f.y + 72, 80, 88, '#E8B84A', '#14101C', '#FFF6B0');
        }
      } else if (name === 'lab_roof_slate_violet') {
        drawBox(f.x, f.y, f.w, f.h, '#4B3A5E', '#14101C', '#6B3FA0');
      } else if (name === 'lab_tower_observatory') {
        // Round stone tower + copper dome (#3F8C8A) + violet ki crystal antenna (#9B6BFF)
        drawBox(f.x + 24, f.y + 84, f.w - 48, f.h - 84, '#5C5468', '#14101C', '#8A6A3B');
        drawBox(f.x + 16, f.y + 32, f.w - 32, 60, '#3F8C8A', '#14101C', '#5FE3D2');
        drawBox(f.x + 84, f.y + 2, 24, 34, '#9B6BFF', '#14101C', '#5FE3D2');
      } else if (name === 'lab_chimney_ki') {
        drawBox(f.x + 12, f.y + 36, f.w - 24, f.h - 36, '#6F6478', '#14101C');
        drawBox(f.x + 18, f.y + 4, f.w - 36, 32, '#9B6BFF', '#14101C', '#5FE3D2');
      } else if (name === 'lab_sign_gear_bottle') {
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#2A1F2D', '#14101C', '#E8B84A');
      } else if (name === 'starter_pedestal_full' || name === 'starter_pedestal_empty') {
        drawBox(f.x + 8, f.y + 28, f.w - 16, f.h - 28, '#6F6478', '#14101C', '#E8B84A');
        if (name === 'starter_pedestal_full') {
          drawBox(f.x + 14, f.y + 6, 18, 24, '#FF6B35', '#14101C');
          drawBox(f.x + 39, f.y + 6, 18, 24, '#5CBF5A', '#14101C');
          drawBox(f.x + 64, f.y + 6, 18, 24, '#3FA9F5', '#14101C');
        }
      } else if (name === 'starter_bottle_ember') {
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#FF6B35', '#14101C', '#FFC15E');
      } else if (name === 'starter_bottle_leaf') {
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#5CBF5A', '#14101C', '#C8F28A');
      } else if (name === 'starter_bottle_water') {
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#3FA9F5', '#14101C', '#A8E6FF');
      } else if (name.startsWith('body_tube_')) {
        const glassCol = name === 'body_tube_wood_lit' ? '#5FE3D2' : '#3F8C8A';
        drawBox(f.x + 6, f.y + 4, f.w - 12, f.h - 8, glassCol, '#14101C', '#8A6A3B');
        if (name !== 'body_tube_empty') {
          // Wooden puppet silhouette inside the tube
          drawBox(f.x + 20, f.y + 32, f.w - 40, f.h - 56, '#B07A45', '#14101C', '#E0C28C');
        }
      } else if (name === 'rift_diagram_intact' || name === 'rift_diagram_awakened') {
        const crackCol = name === 'rift_diagram_awakened' ? '#C2234B' : '#9B6BFF';
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#2A1F2D', '#14101C', crackCol);
      } else {
        drawBox(f.x + 4, f.y + 4, f.w - 8, f.h - 8, '#2A1F2D', '#14101C', '#8A6A3B');
      }
    }
  }

  public getSharedTexture(): THREE.Texture {
    if (!this.sharedTexture) this.initTexture();
    return this.sharedTexture!;
  }

  public getSharedMaterial(): THREE.MeshBasicMaterial {
    if (!this.sharedMaterial) this.initTexture();
    return this.sharedMaterial!;
  }

  public resolveFrameName(frameName: string): string {
    if (this.atlasData.frames[frameName]) return frameName;
    if (LAB_FRAME_ALIASES[frameName] && this.atlasData.frames[LAB_FRAME_ALIASES[frameName]]) {
      return LAB_FRAME_ALIASES[frameName];
    }
    return frameName;
  }

  public AtlasRegion(frameName: string): LabUVRegion | null {
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

  public applyUVsToGeometry(geometry: THREE.BufferGeometry, region: LabUVRegion): void {
    const { u0, v0, u1, v1 } = region;
    const uvs = new Float32Array([
      u0, v1,
      u1, v1,
      u0, v0,
      u1, v0,
    ]);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.attributes.uv.needsUpdate = true;
  }

  public createPropGeometry(
    frameName: string,
    ppuOverride?: number
  ): {
    geometry: THREE.PlaneGeometry;
    isFallback: boolean;
    resolvedName: string;
    region: LabUVRegion | null;
  } {
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
      geometry.rotateX(-Math.PI / 2);
    } else {
      const pivot = region.pivot || [0.5, 1.0];
      const dx = (0.5 - pivot[0]) * worldW;
      const dy = (pivot[1] - 0.5) * worldH;
      geometry.translate(dx, dy, 0);
    }

    this.applyUVsToGeometry(geometry, region);
    return { geometry, isFallback: false, resolvedName: resolved, region };
  }

  public createPropMesh(
    frameName: string,
    ppuOverride?: number,
    isBillboard = false
  ): THREE.Mesh {
    const { geometry, isFallback, resolvedName, region } = this.createPropGeometry(
      frameName,
      ppuOverride
    );

    let mat: THREE.Material;
    if (isFallback) {
      mat = this.createFallbackMaterial(frameName);
    } else if (region?.glow && this.glowMaterial) {
      mat = this.glowMaterial;
    } else {
      mat = this.getSharedMaterial();
    }

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = !region?.flat && !region?.glow;
    mesh.receiveShadow = true;
    mesh.userData.frameName = resolvedName;
    mesh.userData.requestedName = frameName;
    mesh.userData.isBillboard = isBillboard;
    mesh.userData.isFallback = isFallback;

    this.registeredMeshes.add(mesh);
    return mesh;
  }

  public clearRegisteredMeshes(): void {
    this.registeredMeshes.clear();
  }

  private createFallbackMaterial(frameName: string): THREE.MeshBasicMaterial {
    if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') {
      return new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
    }
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(128, 128)
        : document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D;

    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MISSING', 64, 45);
    ctx.fillText(frameName.substring(0, 15), 64, 75);

    const tex = new THREE.CanvasTexture(canvas as any);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  }
}

export const GlobalLabAtlas = LabAtlasManager.getInstance();
