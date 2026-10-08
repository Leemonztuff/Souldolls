import * as THREE from 'three';
import { Texture } from 'pixi.js';
import { Direction } from '../../types';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { SpriteFactory, CreatureSpriteSet } from './SpriteFactory';
import { SoulDollSpriteFactory, SpriteView } from './SoulDollSpriteFactory';
import { CharacterFactory, CHARACTER_PALETTES } from './CharacterFactory';
import { TileType, ALL_TILE_TYPES } from '../../types/tilesets';
import { GlobalTileRegistry } from '../overworld/TileRegistry';

export class AssetRegistry {
  private static instance: AssetRegistry;
  private isInitialized = false;

  // Raw Canvases
  private creatureSprites: Map<string, CreatureSpriteSet> = new Map();
  private characterSheets: Map<string, Record<Direction, HTMLCanvasElement[]>> = new Map();
  private tileCanvases: Map<TileType, HTMLCanvasElement> = new Map();

  // Cached Pixi Textures
  private pixiCreatureFront34: Map<string, Texture> = new Map();
  private pixiCreatureFront: Map<string, Texture> = new Map();
  private pixiCreatureBack: Map<string, Texture> = new Map();
  private pixiCreatureBack34: Map<string, Texture> = new Map();
  private pixiCreatureSideR: Map<string, Texture> = new Map();
  private pixiCreatureSideL: Map<string, Texture> = new Map();
  private pixiCreatureIcon: Map<string, Texture> = new Map();
  private pixiCharacterFrames: Map<string, Texture> = new Map();
  private pixiTiles: Map<TileType, Texture> = new Map();

  // Cached Three.js Textures & Materials
  private threeCreatureFront: Map<string, THREE.CanvasTexture> = new Map();
  private threeCharacterFrames: Map<string, THREE.CanvasTexture> = new Map();
  private threeTiles: Map<TileType, THREE.CanvasTexture> = new Map();
  private atlasTexture: HTMLImageElement | null = null;
  private greenKeyedCache: Map<string, HTMLCanvasElement> = new Map();

  private constructor() {}

  public static getInstance(): AssetRegistry {
    if (!AssetRegistry.instance) {
      AssetRegistry.instance = new AssetRegistry();
    }
    return AssetRegistry.instance;
  }

  /**
   * Crea una textura Pixi con scaleMode 'nearest' y sin mipmaps para máxima nitidez pixel-art
   */
  public createCrispPixiTexture(canvas: HTMLCanvasElement): Texture {
    const tex = Texture.from({
      resource: canvas,
      scaleMode: 'nearest',
      autoGenerateMipmaps: false,
    });
    if (tex.source) {
      tex.source.scaleMode = 'nearest';
      tex.source.autoGenerateMipmaps = false;
    }
    return tex;
  }

  /**
   * Req 2: Procesa el fondo verde de una imagen o canvas una sola vez al cargar y cachea el resultado
   */
  public keyOutGreen(
    key: string,
    source: HTMLImageElement | HTMLCanvasElement,
    targetGreen: [number, number, number] = [26, 174, 6],
    tolerance = 58
  ): HTMLCanvasElement {
    if (this.greenKeyedCache.has(key)) {
      return this.greenKeyedCache.get(key)!;
    }
    const keyed = SoulDollSpriteFactory.keyOutGreen(source, targetGreen, tolerance);
    this.greenKeyedCache.set(key, keyed);
    return keyed;
  }

  private buildCreatureTextures(): void {
    Object.values(CREATURES_DATA).forEach((species) => {
      const spriteSet = SpriteFactory.generateSpriteSet(species);
      this.creatureSprites.set(species.id, spriteSet);

      // Pixi Textures (nearest, no mipmaps)
      const texFront34 = this.createCrispPixiTexture(spriteSet.view_front34 || spriteSet.side_r);
      const texFront = this.createCrispPixiTexture(spriteSet.view_front || spriteSet.front);
      const texBack = this.createCrispPixiTexture(spriteSet.view_back || spriteSet.back);
      const texBack34 = this.createCrispPixiTexture(spriteSet.view_back34 || spriteSet.side_l);

      this.pixiCreatureFront34.set(species.id, texFront34);
      this.pixiCreatureFront.set(species.id, texFront);
      this.pixiCreatureBack.set(species.id, texBack);
      this.pixiCreatureBack34.set(species.id, texBack34);
      this.pixiCreatureSideR.set(species.id, texFront34);
      this.pixiCreatureSideL.set(species.id, texBack34);
      this.pixiCreatureIcon.set(species.id, this.createCrispPixiTexture(spriteSet.icon));

      // Three Texture for Billboard Overworld
      const threeTex = new THREE.CanvasTexture(spriteSet.view_front34 || spriteSet.front);
      threeTex.magFilter = THREE.NearestFilter;
      threeTex.minFilter = THREE.NearestFilter;
      threeTex.generateMipmaps = false;
      threeTex.colorSpace = THREE.SRGBColorSpace;
      threeTex.needsUpdate = true;
      this.threeCreatureFront.set(species.id, threeTex);
    });
  }

  public init(): void {
    if (this.isInitialized) return;

    // Load Atlas
    this.atlasTexture = new Image();
    this.atlasTexture.src = '/assets/atlases/taller_atlas.png';
    this.atlasTexture.onload = () => {
      console.log('[AssetRegistry] Atlas loaded');
    };

    // 1. Generate all Creature Sprites
    this.buildCreatureTextures();

    // Refresh creature textures when async battle spritesheet finishes loading
    SoulDollSpriteFactory.onSpritesheetReady(() => {
      this.buildCreatureTextures();
    });

    // 2. Generate all Character Sheets
    Object.keys(CHARACTER_PALETTES).forEach((charId) => {
      const sheet = CharacterFactory.generateCharacterSheet(charId);
      this.characterSheets.set(charId, sheet);

      const directions: Direction[] = ['down', 'up', 'left', 'right'];
      directions.forEach((dir) => {
        sheet[dir].forEach((canvas, frame) => {
          const key = `${charId}_${dir}_${frame}`;
          this.pixiCharacterFrames.set(key, this.createCrispPixiTexture(canvas));

          const threeTex = new THREE.CanvasTexture(canvas);
          threeTex.magFilter = THREE.NearestFilter;
          threeTex.minFilter = THREE.NearestFilter;
          threeTex.generateMipmaps = false;
          threeTex.colorSpace = THREE.SRGBColorSpace;
          threeTex.needsUpdate = true;
          this.threeCharacterFrames.set(key, threeTex);
        });
      });
    });

    // 3. Register all Tiles via GlobalTileRegistry (Bloque 44)
    ALL_TILE_TYPES.forEach((type) => {
      const canvas = GlobalTileRegistry.getTileCanvas(type);
      this.tileCanvases.set(type, canvas);

      this.pixiTiles.set(type, this.createCrispPixiTexture(canvas));

      const threeTex = GlobalTileRegistry.getTileThree(type);
      this.threeTiles.set(type, threeTex);
    });

    this.isInitialized = true;
    console.log(
      `[AssetRegistry] Generated ${this.creatureSprites.size} creatures, ${this.characterSheets.size} characters, and ${this.tileCanvases.size} procedural tiles.`
    );
  }

  public initAll(): void {
    this.init();
  }

  public verifyReady(): {
    ready: boolean;
    creaturesCount: number;
    charactersCount: number;
    tilesCount: number;
  } {
    if (!this.isInitialized) {
      this.init();
    }
    return {
      ready:
        this.isInitialized &&
        this.creatureSprites.size > 0 &&
        this.characterSheets.size > 0 &&
        this.tileCanvases.size > 0,
      creaturesCount: this.creatureSprites.size,
      charactersCount: this.characterSheets.size,
      tilesCount: this.tileCanvases.size,
    };
  }

  // --- Creature Getters ---
  public getCreatureSpritePixi(speciesId: string, view: SpriteView = 'view_front34'): Texture {
    const spriteSet = this.creatureSprites.get(speciesId);
    if (spriteSet && (spriteSet as any)[view]) {
      return this.createCrispPixiTexture((spriteSet as any)[view]);
    }
    if (view === 'view_front34' || view === 'side_r' || view === 'idle') {
      return this.pixiCreatureFront34.get(speciesId) || this.pixiCreatureFront.get(speciesId) || Texture.EMPTY;
    }
    if (view === 'view_front' || view === 'front') {
      return this.pixiCreatureFront.get(speciesId) || this.pixiCreatureFront34.get(speciesId) || Texture.EMPTY;
    }
    if (view === 'view_side' || view === 'relaxed') {
      return (spriteSet && spriteSet.view_side ? this.createCrispPixiTexture(spriteSet.view_side) : null) || this.pixiCreatureFront34.get(speciesId) || Texture.EMPTY;
    }
    if (view === 'view_back34' || view === 'side_l') {
      return this.pixiCreatureBack34.get(speciesId) || this.pixiCreatureBack.get(speciesId) || Texture.EMPTY;
    }
    if (view === 'view_back' || view === 'back') {
      return this.pixiCreatureBack.get(speciesId) || this.pixiCreatureBack34.get(speciesId) || Texture.EMPTY;
    }
    if (view === 'icon') return this.getCreatureIconPixi(speciesId);
    return this.pixiCreatureFront34.get(speciesId) || this.pixiCreatureFront.get(speciesId) || Texture.EMPTY;
  }

  public hasRealCreatureView(speciesId: string, view: SpriteView): boolean {
    return SoulDollSpriteFactory.hasRealView(speciesId, view);
  }

  public getCreatureFrameMeta(speciesId: string, view: SpriteView) {
    return SoulDollSpriteFactory.getFrameMeta(speciesId, view);
  }

  public getCreatureSpriteSet(speciesId: string): CreatureSpriteSet | undefined {
    return this.creatureSprites.get(speciesId);
  }

  public getCreatureFrontPixi(speciesId: string): Texture {
    return this.pixiCreatureFront34.get(speciesId) || this.pixiCreatureFront.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureBackPixi(speciesId: string): Texture {
    return this.pixiCreatureBack34.get(speciesId) || this.pixiCreatureBack.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureSideRPixi(speciesId: string): Texture {
    return this.pixiCreatureFront34.get(speciesId) || this.pixiCreatureFront.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureSideLPixi(speciesId: string): Texture {
    return this.pixiCreatureBack34.get(speciesId) || this.pixiCreatureBack.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureIconPixi(speciesId: string): Texture {
    return this.pixiCreatureIcon.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureFrontThree(speciesId: string): THREE.CanvasTexture | undefined {
    return this.threeCreatureFront.get(speciesId);
  }

  // --- Character Getters ---
  public getCharacterFramePixi(charId: string, dir: Direction, frame: number): Texture {
    const key = `${charId}_${dir}_${frame}`;
    return this.pixiCharacterFrames.get(key) || Texture.EMPTY;
  }

  public getCharacterFrameThree(charId: string, dir: Direction, frame: number): THREE.CanvasTexture | undefined {
    const key = `${charId}_${dir}_${frame}`;
    return this.threeCharacterFrames.get(key);
  }

  public getCharacterCanvases(charId: string): Record<Direction, HTMLCanvasElement[]> | undefined {
    return this.characterSheets.get(charId);
  }

  // --- Tile Getters ---
  public getTilePixi(type: TileType): Texture {
    return this.pixiTiles.get(type) || Texture.EMPTY;
  }

  public getTileThree(type: TileType): THREE.CanvasTexture | undefined {
    return this.threeTiles.get(type);
  }

  public getTileCanvas(type: TileType): HTMLCanvasElement | undefined {
    return this.tileCanvases.get(type);
  }

  public getTileFromAtlas(x: number, y: number, w: number, h: number): HTMLCanvasElement {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      if (this.atlasTexture && this.atlasTexture.complete && this.atlasTexture.naturalWidth > 0) {
        try {
          ctx.drawImage(this.atlasTexture, x, y, w, h, 0, 0, w, h);
        } catch (e) {
          console.warn('[AssetRegistry] Failed to draw tile from atlas:', e);
        }
      }
      return canvas;
  }
}

export const GlobalAssetRegistry = AssetRegistry.getInstance();
