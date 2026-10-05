import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { GlobalAssetLoader } from '../render/overworld/AssetLoader';
import { GlobalTileRegistry } from '../render/overworld/TileRegistry';
import { GlobalSaveService } from '../services/SaveService';
import { DataValidator } from '../data/validation/DataValidator';
import { KitCard, KitBar, KitBadge } from '../ui/kit';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

export interface BootSceneParams {
  targetScene?: 'Overworld' | 'Title';
}

export class BootScene implements IScene {
  public name = 'Boot';
  private container: Container = new Container();
  private statusText!: Text;
  private detailText!: Text;
  private barContainer: Container = new Container();
  private cardWidth = 420;
  private progress = 0;
  private elapsed = 0;
  private isReadyToTransition = false;
  private switched = false;
  private targetScene: 'Overworld' | 'Title' = 'Title';
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  public async enter(params?: BootSceneParams): Promise<void> {
    this.elapsed = 0;
    this.progress = 0;
    this.isReadyToTransition = false;
    this.switched = false;
    this.targetScene = params?.targetScene || 'Title';

    // 1. Ensure Three.js and PixiJS canvas renderers are initialized
    const threeContainer = document.getElementById('three-container');
    const pixiContainer = document.getElementById('pixi-container');
    const gameContainer = document.getElementById('game-container');

    if (!GlobalThreeRenderer.isReady() && threeContainer) {
      GlobalThreeRenderer.init(threeContainer);
    }

    if (!GlobalPixiRenderer.isReady() && pixiContainer) {
      const w = Math.max(320, Math.round(gameContainer?.clientWidth || window.innerWidth || 960));
      const h = Math.max(240, Math.round(gameContainer?.clientHeight || window.innerHeight || 720));
      await GlobalPixiRenderer.init(pixiContainer, w, h);
    }

    // 2. Build Boot Progress UI
    this.container = new Container();
    this.container.roundPixels = true;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    this.cardWidth = Math.min(440, width - 32);
    const cardH = 176;

    const card = new KitCard({
      width: this.cardWidth,
      height: cardH,
      variant: 'smokedWood',
      title: esText.app.title,
    });
    card.position.set(Math.round((width - this.cardWidth) / 2), Math.round((height - cardH) / 2));
    this.container.addChild(card);

    const badge = new KitBadge('BOOT SYSTEM', 'tier', 'tier');
    badge.position.set(this.cardWidth - 118, 10);
    card.addChild(badge);

    this.statusText = new Text({
      text: 'Verificando renderizadores Three.js y PixiJS...',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.statusText.roundPixels = true;
    this.statusText.position.set(20, 52);
    card.addChild(this.statusText);

    this.detailText = new Text({
      text: 'Preparando motor 2.5D...',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.detailText.roundPixels = true;
    this.detailText.position.set(20, 78);
    card.addChild(this.detailText);

    this.barContainer = new Container();
    this.barContainer.position.set(20, 112);
    card.addChild(this.barContainer);
    this.updateProgressBar(15);

    // 3. Execute staged boot sequence & resource verification
    await this.runBootSequence();
  }

  private updateProgressBar(pct: number): void {
    this.progress = Math.max(0, Math.min(100, Math.round(pct)));
    this.barContainer.removeChildren();
    const bar = new KitBar({
      width: this.cardWidth - 40,
      height: 20,
      value: this.progress,
      max: 100,
      kind: 'ki',
      showText: true,
    });
    this.barContainer.addChild(bar);
  }

  private async runBootSequence(): Promise<void> {
    // Step 1: Verify Three.js & PixiJS Renderers
    if (!GlobalThreeRenderer.isReady() || !GlobalPixiRenderer.isReady()) {
      throw new Error('[BootScene] Three.js or PixiJS renderer failed to initialize.');
    }
    this.statusText.text = 'Validando esquemas de datos y recursos...';
    this.detailText.text = `WebGL2 + PixiJS v8 (${GlobalPixiRenderer.width}x${GlobalPixiRenderer.height}) OK`;
    this.updateProgressBar(40);

    // Step 2: Validate Data Integrity
    DataValidator.validateAll();
    this.updateProgressBar(65);

    // Step 3: Initialize & Verify Assets (Creatures, Characters, Baked Tileset Atlas)
    this.statusText.text = 'Cargando y verificando atlas de tilesets y sprites...';
    GlobalAssetRegistry.initAll();
    const bakedIdx = GlobalTileRegistry.getBakedAtlasIndex();
    await GlobalAssetLoader.loadCrispTexture(`${bakedIdx.packId}/baked_atlas`, bakedIdx.imagePng);
    const assetStatus = GlobalAssetRegistry.verifyReady();
    if (!assetStatus.ready) {
      throw new Error('[BootScene] AssetRegistry verification failed: missing textures.');
    }
    this.detailText.text = `Almas: ${assetStatus.creaturesCount} · Personajes: ${assetStatus.charactersCount} · Tiles: ${assetStatus.tilesCount}`;
    this.updateProgressBar(85);

    // Step 4: Initialize Save State (loads existing slot or creates initial state with starter Souldoll)
    this.statusText.text = 'Cargando estado del mundo Anima...';
    GlobalSaveService.init();
    this.updateProgressBar(100);
    this.statusText.text = '¡Recursos verificados! Entrando al mundo...';

    this.isReadyToTransition = true;

    // Fallback transition timer so background tabs / throttled rAF still transition reliably
    this.fallbackTimer = setTimeout(() => {
      this.transitionToNextScene();
    }, 150);
  }

  private transitionToNextScene(): void {
    if (this.switched) return;
    this.switched = true;
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    GlobalSceneManager.changeScene(this.targetScene);
  }

  public update(dt: number): void {
    if (!this.isReadyToTransition || this.switched) return;
    this.elapsed += dt;
    if (this.elapsed >= 0.12) {
      this.transitionToNextScene();
    }
  }

  public onResize(_width: number, _height: number): void {}

  public render(): void {}

  public async exit(): Promise<void> {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.container.destroy({ children: true });
  }
}
