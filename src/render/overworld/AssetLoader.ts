import * as THREE from 'three';
import artConfigJson from '../../data/config/art.json';
import assetsManifestJson from '../../data/tilesets/assets_manifest.json';

export interface AssetFormatEntry {
  type: 'webp' | 'png';
  file: string;
  bytes?: number;
}

export interface ManifestAssetRecord {
  id: string;
  width: number;
  height: number;
  pixelEqualVerified?: boolean;
  formats: AssetFormatEntry[];
}

/**
 * BLOQUE 44 Req. 7: AssetLoader con soporte WebP lossless y createImageBitmap
 * - Lee el manifest con formatos [{type:"webp", file}, {type:"png", file}].
 * - Detecta soporte de WebP en navegador y usa WebP si existe y el flag `assets.preferWebp` está activo;
 *   si no, usa PNG (en desarrollo, PNG por defecto).
 * - Carga a textura de Three.js vía `createImageBitmap`, liberando `bitmap.close()` tras subir a GPU
 *   para minimizar el consumo de RAM.
 * - Garantiza `NearestFilter`, `generateMipmaps = false` y `SRGBColorSpace` en todas las texturas cargadas.
 */
export class AssetLoader {
  private static instance: AssetLoader;
  private webpSupported: boolean | null = null;
  private preferWebp: boolean = Boolean(artConfigJson.assets?.preferWebp);
  private textureCache: Map<string, THREE.Texture> = new Map();
  private canvasCache: Map<string, HTMLCanvasElement> = new Map();

  private constructor() {}

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  public setPreferWebp(prefer: boolean): void {
    this.preferWebp = prefer;
  }

  public getPreferWebp(): boolean {
    return this.preferWebp;
  }

  /**
   * Detecta soporte de decodificación WebP sin pérdida en el navegador actual.
   */
  public async detectWebpSupport(): Promise<boolean> {
    if (this.webpSupported !== null) return this.webpSupported;
    if (typeof document === 'undefined') {
      this.webpSupported = false;
      return false;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const dataUrl = canvas.toDataURL('image/webp');
      this.webpSupported = dataUrl.startsWith('data:image/webp');
    } catch (_) {
      this.webpSupported = false;
    }
    return this.webpSupported;
  }

  /**
   * Resuelve la URL óptima (WebP o PNG) según el manifest y el flag `assets.preferWebp`.
   */
  public resolveAssetUrl(assetId: string, fallbackPngUrl: string): string {
    const manifest = (assetsManifestJson as any)?.assets?.[assetId] as ManifestAssetRecord | undefined;
    if (!manifest || !Array.isArray(manifest.formats)) {
      return fallbackPngUrl;
    }

    // En desarrollo PNG por defecto salvo que preferWebp esté activo y soportado
    if (this.preferWebp && this.webpSupported) {
      const webpEntry = manifest.formats.find((f) => f.type === 'webp');
      if (webpEntry) return webpEntry.file;
    }

    const pngEntry = manifest.formats.find((f) => f.type === 'png');
    return pngEntry ? pngEntry.file : fallbackPngUrl;
  }

  /**
   * Configura una textura Three.js cumpliendo las reglas estrictas del Bloque 44:
   * NearestFilter, generateMipmaps = false, SRGBColorSpace.
   */
  public static applyPixelArtTextureSettings(tex: THREE.Texture): THREE.Texture {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.premultiplyAlpha = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Carga un recurso del manifest como THREE.Texture usando createImageBitmap
   * y libera el ImageBitmap tras subirlo o copiarlo a canvas.
   */
  public async loadCrispTexture(assetId: string, fallbackPngUrl: string): Promise<THREE.Texture> {
    if (this.textureCache.has(assetId)) {
      return this.textureCache.get(assetId)!;
    }

    await this.detectWebpSupport();
    const url = this.resolveAssetUrl(assetId, fallbackPngUrl);

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob, {
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'none',
            });

            // Copy to offscreen/HTML canvas so Three.js uploads immediately and we can release the ImageBitmap handle
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bitmap, 0, 0);

            if (artConfigJson.assets?.releaseBitmapAfterUpload !== false && typeof bitmap.close === 'function') {
              bitmap.close();
            }

            this.canvasCache.set(assetId, canvas);
            const tex = new THREE.CanvasTexture(canvas);
            AssetLoader.applyPixelArtTextureSettings(tex);
            this.textureCache.set(assetId, tex);
            return tex;
          }
        }
      } catch (_) {
        // Fallback to standard TextureLoader below
      }
    }

    const loader = new THREE.TextureLoader();
    const tex = loader.load(fallbackPngUrl, (loaded) => {
      AssetLoader.applyPixelArtTextureSettings(loaded);
    });
    AssetLoader.applyPixelArtTextureSettings(tex);
    this.textureCache.set(assetId, tex);
    return tex;
  }

  public getCachedCanvas(assetId: string): HTMLCanvasElement | undefined {
    return this.canvasCache.get(assetId);
  }

  public getAllLoadedTextures(): THREE.Texture[] {
    return Array.from(this.textureCache.values());
  }
}

export const GlobalAssetLoader = AssetLoader.getInstance();
