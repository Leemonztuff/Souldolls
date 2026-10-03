import * as THREE from 'three';
import { Texture } from 'pixi.js';
import { Direction } from '../../types';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { SpriteFactory, CreatureSpriteSet } from './SpriteFactory';
import { CharacterFactory, CHARACTER_PALETTES } from './CharacterFactory';
import { TileFactory, TileType, ALL_TILE_TYPES } from './TileFactory';

export class AssetRegistry {
  private static instance: AssetRegistry;
  private isInitialized = false;

  // Raw Canvases
  private creatureSprites: Map<string, CreatureSpriteSet> = new Map();
  private characterSheets: Map<string, Record<Direction, HTMLCanvasElement[]>> = new Map();
  private tileCanvases: Map<TileType, HTMLCanvasElement> = new Map();

  // Cached Pixi Textures
  private pixiCreatureFront: Map<string, Texture> = new Map();
  private pixiCreatureBack: Map<string, Texture> = new Map();
  private pixiCreatureIcon: Map<string, Texture> = new Map();
  private pixiCharacterFrames: Map<string, Texture> = new Map();
  private pixiTiles: Map<TileType, Texture> = new Map();

  // Cached Three.js Textures & Materials
  private threeCreatureFront: Map<string, THREE.CanvasTexture> = new Map();
  private threeCharacterFrames: Map<string, THREE.CanvasTexture> = new Map();
  private threeTiles: Map<TileType, THREE.CanvasTexture> = new Map();
  private atlasTexture: HTMLImageElement | null = null;

  private constructor() {}

  public static getInstance(): AssetRegistry {
    if (!AssetRegistry.instance) {
      AssetRegistry.instance = new AssetRegistry();
    }
    return AssetRegistry.instance;
  }

  public init(): void {
    if (this.isInitialized) return;

    // Load Atlas
    this.atlasTexture = new Image();
    this.atlasTexture.src = '/Assets/Build1.jpg';
    this.atlasTexture.onload = () => {
        console.log('[AssetRegistry] Atlas loaded');
    };

    // 1. Generate all 12 Creature Sprites
    Object.values(CREATURES_DATA).forEach((species) => {
      const spriteSet = SpriteFactory.generateSpriteSet(species);
      this.creatureSprites.set(species.id, spriteSet);

      // Pixi Textures
      this.pixiCreatureFront.set(species.id, Texture.from({ resource: spriteSet.front }));
      this.pixiCreatureBack.set(species.id, Texture.from({ resource: spriteSet.back }));
      this.pixiCreatureIcon.set(species.id, Texture.from({ resource: spriteSet.icon }));

      // Three Texture for Billboard Overworld
      const threeTex = new THREE.CanvasTexture(spriteSet.front);
      threeTex.magFilter = THREE.NearestFilter;
      threeTex.minFilter = THREE.NearestFilter;
      threeTex.colorSpace = THREE.SRGBColorSpace;
      threeTex.needsUpdate = true;
      this.threeCreatureFront.set(species.id, threeTex);
    });

    // 2. Generate all Character Sheets
    Object.keys(CHARACTER_PALETTES).forEach((charId) => {
      const sheet = CharacterFactory.generateCharacterSheet(charId);
      this.characterSheets.set(charId, sheet);

      const directions: Direction[] = ['down', 'up', 'left', 'right'];
      directions.forEach((dir) => {
        sheet[dir].forEach((canvas, frame) => {
          const key = `${charId}_${dir}_${frame}`;
          this.pixiCharacterFrames.set(key, Texture.from({ resource: canvas }));

          const threeTex = new THREE.CanvasTexture(canvas);
          threeTex.magFilter = THREE.NearestFilter;
          threeTex.minFilter = THREE.NearestFilter;
          threeTex.colorSpace = THREE.SRGBColorSpace;
          threeTex.needsUpdate = true;
          this.threeCharacterFrames.set(key, threeTex);
        });
      });
    });

    // 3. Generate all Tiles
    ALL_TILE_TYPES.forEach((type) => {
      const canvas = TileFactory.generateTile(type);
      this.tileCanvases.set(type, canvas);

      this.pixiTiles.set(type, Texture.from({ resource: canvas }));

      const threeTex = new THREE.CanvasTexture(canvas);
      threeTex.magFilter = THREE.NearestFilter;
      threeTex.minFilter = THREE.NearestFilter;
      threeTex.colorSpace = THREE.SRGBColorSpace;
      threeTex.wrapS = THREE.RepeatWrapping;
      threeTex.wrapT = THREE.RepeatWrapping;
      threeTex.needsUpdate = true;
      this.threeTiles.set(type, threeTex);
    });

    this.isInitialized = true;
    console.log(
      `[AssetRegistry] Generated ${this.creatureSprites.size} creatures, ${this.characterSheets.size} characters, and ${this.tileCanvases.size} procedural tiles.`
    );
  }

  // --- Creature Getters ---
  public getCreatureSpritePixi(speciesId: string, view: 'front' | 'back' | 'icon' = 'front'): Texture {
    if (view === 'back') return this.getCreatureBackPixi(speciesId);
    if (view === 'icon') return this.getCreatureIconPixi(speciesId);
    return this.getCreatureFrontPixi(speciesId);
  }

  public getCreatureSpriteSet(speciesId: string): CreatureSpriteSet | undefined {
    return this.creatureSprites.get(speciesId);
  }

  public getCreatureFrontPixi(speciesId: string): Texture {
    return this.pixiCreatureFront.get(speciesId) || Texture.EMPTY;
  }

  public getCreatureBackPixi(speciesId: string): Texture {
    return this.pixiCreatureBack.get(speciesId) || Texture.EMPTY;
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
      if (this.atlasTexture) {
          ctx.drawImage(this.atlasTexture, x, y, w, h, 0, 0, w, h);
      }
      return canvas;
  }
}

export const GlobalAssetRegistry = AssetRegistry.getInstance();
