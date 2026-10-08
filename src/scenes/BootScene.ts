import { Container, Graphics, Sprite, Text, TextStyle, Texture, Assets } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { GlobalAssetLoader } from '../render/overworld/AssetLoader';
import { GlobalTileRegistry } from '../render/overworld/TileRegistry';
import { GlobalSaveService } from '../services/SaveService';
import { DataValidator } from '../data/validation/DataValidator';
import { KitBar, KitBadge } from '../ui/kit';
import { COLOR_NUM, COLOR_HEX, FONTS, RADII } from '../ui/styles';
import esText from '../data/text/es.json';

export interface BootSceneParams {
  targetScene?: 'Overworld' | 'Title';
}

interface KiMote {
  gfx: Graphics;
  x: number;
  y: number;
  speedY: number;
  phase: number;
  baseRadius: number;
}

/**
 * BRANDED ANIMATED LOADING SCREEN (BOOT SCENE)
 * - Animated Ki motes drifting across an atmospheric dark backdrop.
 * - Branded logo and subtitle header.
 * - Smoothly interpolated progress bar with percentage readout.
 * - Real-time step descriptions during Three.js, PixiJS, and Asset Registry initialization.
 */
export class BootScene implements IScene {
  public name = 'Boot';
  private container: Container = new Container();

  private statusText!: Text;
  private detailText!: Text;
  private percentText!: Text;
  private barContainer: Container = new Container();

  private targetProgress = 0;
  private displayProgress = 0;
  private cardWidth = 420;
  private elapsed = 0;
  private timeClock = 0;
  private isReadyToTransition = false;
  private switched = false;
  private targetScene: 'Overworld' | 'Title' = 'Title';
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private kiMotes: KiMote[] = [];
  private logoSprite!: Sprite;

  public async enter(params?: BootSceneParams): Promise<void> {
    this.elapsed = 0;
    this.timeClock = 0;
    this.targetProgress = 0;
    this.displayProgress = 0;
    this.isReadyToTransition = false;
    this.switched = false;
    this.targetScene = params?.targetScene || 'Title';
    this.kiMotes = [];

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

    // 2. Build Branded Loading Screen UI immediately (frame 1)
    this.buildLoadingUI();

    // 3. Preload logo texture asynchronously in background without blocking BootScene UI
    Assets.load('/assets/SoulDollslogo.png')
      .then((tex: Texture) => {
        if (tex && this.logoSprite && !this.logoSprite.destroyed) {
          const width = GlobalPixiRenderer.width || 960;
          const targetW = Math.min(280, width - 48);
          this.logoSprite.texture = tex;
          this.logoSprite.scale.set(targetW / (tex.width || 520));
        }
      })
      .catch(() => {});

    // 4. Execute staged boot sequence & resource verification
    await this.runBootSequence();
  }

  private buildLoadingUI(): void {
    this.container = new Container();
    this.container.roundPixels = true;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    const width = GlobalPixiRenderer.width || 960;
    const height = GlobalPixiRenderer.height || 720;

    // Dark atmospheric background with subtle radial vignette
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 1.0 });
    this.container.addChild(bg);

    // Floating Ki Motes (Cyan & Soul Violet)
    const kiGroup = new Container();
    kiGroup.roundPixels = true;
    this.container.addChild(kiGroup);

    for (let i = 0; i < 28; i++) {
      const gfx = new Graphics();
      const radius = 2 + Math.random() * 4;
      const col = i % 2 === 0 ? COLOR_NUM.cyan : COLOR_NUM.soulViolet;
      gfx.circle(0, 0, radius);
      gfx.fill({ color: col, alpha: 0.5 + Math.random() * 0.4 });

      const x = Math.random() * width;
      const y = Math.random() * height;
      gfx.position.set(x, y);
      kiGroup.addChild(gfx);

      this.kiMotes.push({
        gfx,
        x,
        y,
        speedY: 20 + Math.random() * 40,
        phase: Math.random() * Math.PI * 2,
        baseRadius: radius,
      });
    }

    // Centered Content Panel
    this.cardWidth = Math.min(460, width - 36);
    const panel = new Container();
    panel.roundPixels = true;
    this.container.addChild(panel);

    // Logo / Title Graphic
    let logoTexture: Texture | null = null;
    try {
      if (Assets.cache.has('/assets/SoulDollslogo.png')) {
        logoTexture = Assets.get('/assets/SoulDollslogo.png');
      }
    } catch {
      logoTexture = null;
    }

    if (logoTexture && logoTexture.width > 10) {
      this.logoSprite = new Sprite(logoTexture);
      this.logoSprite.anchor.set(0.5);
      const targetW = Math.min(280, width - 48);
      this.logoSprite.scale.set(targetW / logoTexture.width);
    } else {
      const generatedTex = this.generateFallbackLogoTexture();
      this.logoSprite = new Sprite(generatedTex);
      this.logoSprite.anchor.set(0.5);
      const targetW = Math.min(300, width - 48);
      this.logoSprite.scale.set(targetW / 520);
    }

    const logoY = Math.max(80, Math.round(height * 0.22));
    this.logoSprite.position.set(Math.round(width / 2), logoY);
    this.container.addChild(this.logoSprite);

    // Subtitle & System Badge
    const subTitle = new Text({
      text: esText.app.subtitle,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        letterSpacing: 2,
      }),
    });
    subTitle.roundPixels = true;
    subTitle.anchor.set(0.5, 0);
    subTitle.position.set(Math.round(width / 2), logoY + Math.round(this.logoSprite.height / 2) + 12);
    this.container.addChild(subTitle);

    // Progress Card Frame
    const cardH = 144;
    const cardX = Math.round((width - this.cardWidth) / 2);
    const cardY = Math.max(subTitle.y + 32, Math.round(height * 0.58));

    const cardBg = new Graphics();
    cardBg.roundRect(cardX, cardY, this.cardWidth, cardH, RADII.md);
    cardBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    cardBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    cardBg.roundRect(cardX + 3, cardY + 3, this.cardWidth - 6, cardH - 6, RADII.sm);
    cardBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.4 });
    this.container.addChild(cardBg);

    const badge = new KitBadge('CARGANDO...', 'tier', 'tier');
    badge.position.set(cardX + this.cardWidth - (badge.badgeWidth || 110) - 12, cardY + 10);
    this.container.addChild(badge);

    // Status Message Text
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
    this.statusText.position.set(cardX + 16, cardY + 12);
    this.container.addChild(this.statusText);

    this.detailText = new Text({
      text: 'Preparando motor 2.5D...',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fill: COLOR_HEX.smoke,
      }),
    });
    this.detailText.roundPixels = true;
    this.detailText.position.set(cardX + 16, cardY + 38);
    this.container.addChild(this.detailText);

    // Progress Bar Container & Percentage Readout
    this.barContainer = new Container();
    this.barContainer.position.set(cardX + 16, cardY + 70);
    this.container.addChild(this.barContainer);

    this.percentText = new Text({
      text: '0%',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.percentText.roundPixels = true;
    this.percentText.anchor.set(1, 0);
    this.percentText.position.set(cardX + this.cardWidth - 16, cardY + 106);
    this.container.addChild(this.percentText);

    this.updateProgressBarUI(0);
  }

  private updateProgressBarUI(pct: number): void {
    const val = Math.max(0, Math.min(100, Math.round(pct)));
    this.barContainer.removeChildren();

    const barW = this.cardWidth - 32;
    const bar = new KitBar({
      width: barW,
      height: 22,
      value: val,
      max: 100,
      kind: 'ki',
      showText: true,
    });
    this.barContainer.addChild(bar);

    if (this.percentText) {
      this.percentText.text = `${val}%`;
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private async runBootSequence(): Promise<void> {
    // Yield one frame so the loading screen is painted immediately
    await this.nextFrame();

    if (!GlobalThreeRenderer.isReady() || !GlobalPixiRenderer.isReady()) {
      throw new Error('[BootScene] Three.js or PixiJS renderer failed to initialize.');
    }
    this.statusText.text = 'Validando esquemas de datos y motor de combate...';
    this.detailText.text = `WebGL2 + PixiJS v8 (${GlobalPixiRenderer.width}x${GlobalPixiRenderer.height}) OK`;
    this.targetProgress = 35;
    this.updateProgressBarUI(35);
    await this.nextFrame();

    // Step 2: Validate Data Integrity (once)
    DataValidator.validateAll();
    this.targetProgress = 65;
    this.updateProgressBarUI(65);
    this.statusText.text = 'Cargando y verificando atlas de tilesets y sprites...';
    await this.nextFrame();

    // Step 3: Initialize & Verify Assets (Creatures, Characters, Baked Tileset Atlas)
    GlobalAssetRegistry.initAll();
    const bakedIdx = GlobalTileRegistry.getBakedAtlasIndex();
    await GlobalAssetLoader.loadCrispTexture(`${bakedIdx.packId}/baked_atlas`, bakedIdx.imagePng);
    const assetStatus = GlobalAssetRegistry.verifyReady();
    if (!assetStatus.ready) {
      throw new Error('[BootScene] AssetRegistry verification failed: missing textures.');
    }
    this.detailText.text = `Almas: ${assetStatus.creaturesCount} · Personajes: ${assetStatus.charactersCount} · Tilesets: ${assetStatus.tilesCount}`;
    this.targetProgress = 92;
    this.updateProgressBarUI(92);

    // Step 4: Initialize Save State & transition immediately
    this.statusText.text = 'Cargando estado del mundo Anima...';
    GlobalSaveService.init();
    this.targetProgress = 100;
    this.displayProgress = 100;
    this.updateProgressBarUI(100);
    this.statusText.text = '¡Recursos verificados! Entrando al mundo Anima...';

    this.isReadyToTransition = true;
    this.transitionToNextScene();
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
    this.timeClock += dt;

    // 1. Animate floating Ki motes
    const height = GlobalPixiRenderer.height || 720;
    for (let i = 0; i < this.kiMotes.length; i++) {
      const pt = this.kiMotes[i];
      pt.y -= pt.speedY * dt;
      pt.x += Math.sin(this.timeClock * 1.5 + pt.phase) * 0.4;
      if (pt.y < -10) {
        pt.y = height + 10;
        pt.x = Math.random() * (GlobalPixiRenderer.width || 960);
      }
      pt.gfx.position.set(Math.round(pt.x), Math.round(pt.y));
    }

    // 2. Smoothly interpolate display progress toward target progress
    if (this.displayProgress < this.targetProgress) {
      this.displayProgress = Math.min(
        this.targetProgress,
        this.displayProgress + dt * 140
      );
      this.updateProgressBarUI(this.displayProgress);
    }

    // 3. Transition check
    if (this.isReadyToTransition && this.displayProgress >= 99.5 && !this.switched) {
      this.elapsed += dt;
      if (this.elapsed >= 0.15) {
        this.transitionToNextScene();
      }
    }
  }

  private generateFallbackLogoTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    ctx.font = `bold 48px ${FONTS.title}`;
    ctx.fillStyle = COLOR_HEX.parchment;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOULDOLLS', 260, 64);

    return Texture.from(canvas);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
