import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalVFXSystem } from '../render/vfx/VFXSystem';
import { BattleEngine, BattleEngineConfig } from '../systems/battle/BattleEngine';
import { BattlePlayer } from '../systems/battle/BattlePlayer';
import { BattleAction, BattleSide } from '../systems/battle/BattleTypes';
import { DamageCalculator } from '../systems/battle/DamageCalculator';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { MOVES_DATA } from '../data/moves/moves';
import { ITEMS_DATA } from '../data/items/items';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { SoulDollSpriteFactory, SpriteView, IdleBandMeta } from '../render/procedural/SoulDollSpriteFactory';
import { BattleIdleMesh } from '../render/battle/BattleIdleMesh';
import { GlobalEvolutionSystem } from '../systems/evolution/EvolutionSystem';
import { CreatureInstance, BustAnimationMode } from '../types';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { BodyPart } from '../types/bodies';
import { GlobalTheme } from '../data/theme/ThemeManager';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';
import { KitCard, KitButton, UIKitLinter } from '../ui/kit';
import battleConfigRaw from '../data/config/battle.json';

export type BiomeType = 'pasto' | 'bosque' | 'cueva' | 'interior';

export interface BattleSceneParams extends BattleEngineConfig {
  biome?: BiomeType;
  onBattleEnd?: (victory: boolean, capturedCreature?: CreatureInstance) => void;
}

interface BattleLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BattlePlatformMetrics {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface ComputedBattleLayout {
  width: number;
  height: number;
  isPortrait: boolean;
  enemyPlatform: BattlePlatformMetrics;
  allyPlatform: BattlePlatformMetrics;
  enemyHud: BattleLayoutRect;
  allyHud: BattleLayoutRect;
  narratorBox: BattleLayoutRect;
  menuBox: BattleLayoutRect;
  allyTargetHeight: number;
  enemyTargetHeight: number;
}

export class BattleScene implements IScene {
  public name = 'Battle';

  private container: Container = new Container();
  private bgContainer: Container = new Container();
  private fieldContainer: Container = new Container();
  private hudContainer: Container = new Container();
  private uiMenuContainer: Container = new Container();
  private debugOverlayContainer: Container = new Container();
  private debugPanelContainer: Container = new Container();

  private engine!: BattleEngine;
  private player!: BattlePlayer;
  private biome: BiomeType = 'pasto';
  private layout!: ComputedBattleLayout;

  // Sprites (MeshPlane Idle Deformation), Platforms & Elliptical Shadows
  private playerPlatform!: Graphics;
  private opponentPlatform!: Graphics;
  private playerShadow!: Graphics;
  private opponentShadow!: Graphics;
  private playerSprite!: BattleIdleMesh;
  private opponentSprite!: BattleIdleMesh;

  // Base scales, views & coordinates for integer pixel placement
  private playerBaseScale = 2;
  private opponentBaseScale = 2;
  private playerSignX = -1;
  private opponentSignX = -1;
  private playerFlipX = true;
  private opponentFlipX = true;
  private playerView: SpriteView = 'view_back34';
  private opponentView: SpriteView = 'view_front34';
  private playerBaseX = 260;
  private playerBaseY = 420;
  private opponentBaseX = 680;
  private opponentBaseY = 240;

  // Idle Animation & FPS Timers
  private animTimer = 0;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private currentFps = 60;
  private fpsText?: Text;
  private bufUpdatesText?: Text;
  private isActionAnimating = false;

  // HUD Elements
  private playerHpBarFill!: Graphics;
  private playerHpText!: Text;
  private playerExpBarFill!: Graphics;
  private playerLevelText!: Text;
  private playerStatusBadge!: Container;
  private playerSilhouette!: HumanoidPartSilhouette;
  private playerBarWidth = 220;

  private opponentHpBarFill!: Graphics;
  private opponentHpText!: Text;
  private opponentLevelText!: Text;
  private opponentStatusBadge!: Container;
  private opponentSilhouette!: HumanoidPartSilhouette;
  private opponentBarWidth = 220;

  // Narrator Box
  private narratorBox!: Container;
  private narratorText!: Text;

  // State
  private currentMenuState: 'main' | 'fight' | 'bag' | 'party' | 'busy' = 'main';
  private selectedIndex = 0;
  private menuItemsContainers: Container[] = [];
  private onBattleEndCallback?: (victory: boolean, capturedCreature?: CreatureInstance) => void;

  // Debug State (Bloque 37, 38 & 39)
  private debugVisible = false;
  private debugAllyViewOverride: SpriteView | null = null;
  private debugEnemyViewOverride: SpriteView | null = null;
  private debugAllyFlipOverride: boolean | null = null;
  private debugEnemyFlipOverride: boolean | null = null;
  private debugIntegerScale = true;
  private debugShowBoundingBoxes = true;
  private debugShowAnchorsAndGrid = true;
  private debugShowHotspots = true;
  private debugShowIdleBands = true;
  private debugSlowMotion = false;
  private debugEditSide: BattleSide = 'opponent';
  private debugCustomIdleMeta: Partial<Record<SpriteView, IdleBandMeta>> = {};
  private debugNativeSize = false;

  public async enter(params?: BattleSceneParams): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.biome = params?.biome || 'pasto';
    this.onBattleEndCallback = params?.onBattleEnd;

    // 1. Initialize Battle Engine
    if (!params || !params.playerParty || !params.opponentParty) {
      throw new Error('[BattleScene] Missing battle engine parameters!');
    }

    this.engine = new BattleEngine(params);
    this.player = new BattlePlayer(this);

    // 2. Compute percentage layout & Build Layers
    this.layout = this.computeLayout(GlobalPixiRenderer.width, GlobalPixiRenderer.height);
    this.buildBackground();
    this.buildFieldPlatforms();
    this.buildHUD();
    this.buildUIMenu();
    this.buildDebugOverlay();

    // Refresh sprites if async battle sheet finishes loading while in scene
    SoulDollSpriteFactory.onSpritesheetReady(() => {
      if (this.playerSprite && this.opponentSprite && !this.playerSprite.destroyed) {
        this.applyCreatureSpritesAndScales();
        if (this.debugVisible) this.renderDebugOverlay();
      }
    });

    // 3. Init VFX System
    GlobalVFXSystem.init(this.container);

    // 4. Play Entrance Transition (Swirl / Curtain Flash)
    await this.playEntranceTransition();

    // 5. Play Battle BGM
    GlobalAudioService.playBattleBgm();

    // 6. Start Battle Engine & Play Initial Events
    const startEvents = this.engine.startBattle();
    this.currentMenuState = 'busy';
    await this.player.playEvents(startEvents);
    this.openMainMenu();
  }

  public onResize(width: number, height: number): void {
    if (!this.engine || !this.container || this.container.destroyed) return;
    this.layout = this.computeLayout(width, height);
    this.rebuildSceneLayout();
  }

  private rebuildSceneLayout(): void {
    this.bgContainer.destroy({ children: true });
    this.fieldContainer.destroy({ children: true });
    this.hudContainer.destroy({ children: true });
    this.uiMenuContainer.destroy({ children: true });
    this.debugOverlayContainer.destroy({ children: true });
    this.debugPanelContainer.destroy({ children: true });

    this.buildBackground();
    this.buildFieldPlatforms();
    this.buildHUD();
    this.buildUIMenu();
    this.buildDebugOverlay();

    if (this.currentMenuState === 'main') this.openMainMenu();
    else if (this.currentMenuState === 'fight') this.openFightMenu();
    else if (this.currentMenuState === 'bag') this.openBagMenu();
    else if (this.currentMenuState === 'party') this.openPartyMenu();
  }

  /**
   * Req 6: Diseño de la escena por porcentajes del viewport (vertical móvil y horizontal)
   * Garantiza que las plataformas y sprites nunca se solapen con los paneles de HP ni el cuadro de texto.
   */
  private computeLayout(width: number, height: number): ComputedBattleLayout {
    const w = Math.round(width);
    const h = Math.round(height);
    const isPortrait = h >= w;
    const cfgLayout = (battleConfigRaw as any).layout || {};

    // Enemy HUD (Top-Left)
    const eHudW = Math.round(Math.min(370, Math.max(200, w * (isPortrait ? 0.56 : cfgLayout.enemyHud?.wPct || 0.40))));
    const eHudH = Math.round(isPortrait ? 84 : 88);
    const eHudX = Math.round(w * (cfgLayout.enemyHud?.xPct || 0.025));
    const eHudY = Math.round(h * (cfgLayout.enemyHud?.yPct || 0.025));

    // Menu Box (Bottom)
    const menuW = Math.round(w * (cfgLayout.menuBox?.wPct || 0.95));
    const menuH = Math.round(Math.max(136, Math.min(168, h * (cfgLayout.menuBox?.hPct || 0.22))));
    const menuX = Math.round((w - menuW) / 2);
    const menuY = Math.round(h - menuH - Math.max(8, Math.round(h * 0.015)));

    // Narrator Box (Above Menu Box)
    const narrW = menuW;
    const narrH = Math.round(Math.max(56, Math.min(72, h * (cfgLayout.narratorBox?.hPct || 0.10))));
    const narrX = menuX;
    const narrY = Math.round(menuY - narrH - 8);

    // Ally HUD (Bottom-Right, above Narrator Box)
    const aHudW = Math.round(Math.min(380, Math.max(210, w * (isPortrait ? 0.58 : cfgLayout.allyHud?.wPct || 0.40))));
    const aHudH = Math.round(isPortrait ? 104 : 112);
    const aHudX = Math.round(w - aHudW - Math.round(w * 0.025));
    const aHudY = Math.round(narrY - aHudH - 10);

    // Platforms (Upper-Right for Enemy, Lower-Left for Ally, placed so sprites never overlap HUD or Narrator)
    const enemyCx = Math.round(w * (isPortrait ? 0.74 : cfgLayout.enemyPlatform?.xPct || 0.72));
    const enemyCy = Math.round(
      Math.min(aHudY - 18, Math.max(eHudY + eHudH + 70, h * (isPortrait ? 0.33 : cfgLayout.enemyPlatform?.yPct || 0.36)))
    );
    const enemyRx = Math.round(Math.max(76, Math.min(170, w * (cfgLayout.enemyPlatform?.rxPct || 0.16))));
    const enemyRy = Math.round(Math.max(22, Math.min(46, h * (cfgLayout.enemyPlatform?.ryPct || 0.055))));

    const allyCx = Math.round(w * (isPortrait ? 0.25 : cfgLayout.allyPlatform?.xPct || 0.26));
    const allyCy = Math.round(Math.min(narrY - 16, Math.max(eHudY + eHudH + 130, h * (isPortrait ? 0.56 : cfgLayout.allyPlatform?.yPct || 0.57))));
    const allyRx = Math.round(Math.max(90, Math.min(200, w * (cfgLayout.allyPlatform?.rxPct || 0.20))));
    const allyRy = Math.round(Math.max(26, Math.min(54, h * (cfgLayout.allyPlatform?.ryPct || 0.065))));

    // Available vertical clearance above each platform so sprites don't overlap top HUD or screen top
    const allyMaxClearance = Math.max(120, allyCy - (eHudY + eHudH + 12));
    const enemyMaxClearance = Math.max(110, enemyCy - 12);

    const allyPct = (battleConfigRaw as any).allyHeightPct || 0.38;
    const enemyPct = (battleConfigRaw as any).enemyHeightPct || 0.30;

    const allyTargetHeight = Math.round(Math.min(h * allyPct, allyMaxClearance));
    const enemyTargetHeight = Math.round(Math.min(h * enemyPct, enemyMaxClearance));

    return {
      width: w,
      height: h,
      isPortrait,
      enemyPlatform: { cx: enemyCx, cy: enemyCy, rx: enemyRx, ry: enemyRy },
      allyPlatform: { cx: allyCx, cy: allyCy, rx: allyRx, ry: allyRy },
      enemyHud: { x: eHudX, y: eHudY, w: eHudW, h: eHudH },
      allyHud: { x: aHudX, y: aHudY, w: aHudW, h: aHudH },
      narratorBox: { x: narrX, y: narrY, w: narrW, h: narrH },
      menuBox: { x: menuX, y: menuY, w: menuW, h: menuH },
      allyTargetHeight,
      enemyTargetHeight,
    };
  }

  private getTextRes(): number {
    return GlobalPixiRenderer.resolution || Math.min(window.devicePixelRatio || 1, 3);
  }

  private buildBackground(): void {
    this.bgContainer = new Container();
    this.bgContainer.roundPixels = true;
    this.container.addChild(this.bgContainer);

    const { width, height } = this.layout;

    const bg = new Graphics();
    bg.rect(0, 0, width, height);

    if (this.biome === 'bosque') {
      bg.fill({ color: COLOR_NUM.woodDark });
    } else if (this.biome === 'cueva') {
      bg.fill({ color: COLOR_NUM.inkCrypt });
    } else if (this.biome === 'interior') {
      bg.fill({ color: COLOR_NUM.smokedWood });
    } else {
      bg.fill({ color: COLOR_NUM.inkCrypt });
    }
    this.bgContainer.addChild(bg);

    // Subtle horizon gradient line
    const horizonY = Math.round(height * 0.42);
    const horizon = new Graphics();
    horizon.rect(0, horizonY, width, height - horizonY);
    horizon.fill({ color: COLOR_NUM.cyan, alpha: 0.14 });
    this.bgContainer.addChild(horizon);
  }

  private buildFieldPlatforms(): void {
    this.fieldContainer = new Container();
    this.fieldContainer.roundPixels = true;
    this.container.addChild(this.fieldContainer);

    const { enemyPlatform, allyPlatform } = this.layout;
    const shadowAlpha = (battleConfigRaw as any).shadowAlpha ?? 0.35;

    // 1. Opponent Platform (Upper-Right)
    this.opponentPlatform = new Graphics();
    this.opponentPlatform.ellipse(enemyPlatform.cx, enemyPlatform.cy, enemyPlatform.rx, enemyPlatform.ry);
    this.opponentPlatform.fill({ color: this.getPlatformColor(), alpha: 0.88 });
    this.opponentPlatform.stroke({ color: GlobalTheme.bronzeNum, width: 3 });
    this.fieldContainer.addChild(this.opponentPlatform);

    // 2. Player Platform (Lower-Left)
    this.playerPlatform = new Graphics();
    this.playerPlatform.ellipse(allyPlatform.cx, allyPlatform.cy, allyPlatform.rx, allyPlatform.ry);
    this.playerPlatform.fill({ color: this.getPlatformColor(), alpha: 0.88 });
    this.playerPlatform.stroke({ color: GlobalTheme.bronzeNum, width: 3 });
    this.fieldContainer.addChild(this.playerPlatform);

    // 3. Dedicated Elliptical Shadows under each sprite (Req 6: Sombra elíptica alpha 0.35)
    this.opponentShadow = new Graphics();
    this.opponentShadow.ellipse(
      enemyPlatform.cx,
      enemyPlatform.cy,
      Math.round(enemyPlatform.rx * 0.48),
      Math.round(enemyPlatform.ry * 0.45)
    );
    this.opponentShadow.fill({ color: 0x000000, alpha: shadowAlpha });
    this.fieldContainer.addChild(this.opponentShadow);

    this.playerShadow = new Graphics();
    this.playerShadow.ellipse(
      allyPlatform.cx,
      allyPlatform.cy,
      Math.round(allyPlatform.rx * 0.48),
      Math.round(allyPlatform.ry * 0.45)
    );
    this.playerShadow.fill({ color: 0x000000, alpha: shadowAlpha });
    this.fieldContainer.addChild(this.playerShadow);

    // 4. Create BattleIdleMesh instances (MeshPlane per pixel with feet anchored at (0,0) on the elliptical platform center)
    const bustMode: BustAnimationMode =
      GlobalSaveService.getCurrentState()?.settings?.bustAnimation || 'subtle';

    this.opponentSprite = new BattleIdleMesh({
      texture: GlobalAssetRegistry.getCreatureSpritePixi(this.engine.getOpponentActive().speciesId, 'view_front34'),
      bustMode,
      phaseOffsetSec: 1.45,
      cycleJitterFactor: 1.08,
    });
    this.opponentSprite.roundPixels = true;
    this.fieldContainer.addChild(this.opponentSprite);

    this.playerSprite = new BattleIdleMesh({
      texture: GlobalAssetRegistry.getCreatureSpritePixi(this.engine.getPlayerActive().speciesId, 'view_back34'),
      bustMode,
      phaseOffsetSec: 0.15,
      cycleJitterFactor: 0.93,
    });
    this.playerSprite.roundPixels = true;
    this.fieldContainer.addChild(this.playerSprite);

    this.applyCreatureSpritesAndScales();
  }

  private getEffectiveIdleMeta(speciesId: string, view: SpriteView): IdleBandMeta | null {
    if (this.debugCustomIdleMeta[view]) {
      return this.debugCustomIdleMeta[view]!;
    }
    const meta = GlobalAssetRegistry.getCreatureFrameMeta(speciesId, view);
    return meta.idle ? JSON.parse(JSON.stringify(meta.idle)) : null;
  }

  /**
   * Bloque 38 & 39:
   * - Asignación por data (battle.json -> battleViews):
   *   ally:  { view: "view_back34",  flipX: true } (de espaldas, mirando arriba-derecha hacia el enemigo)
   *   enemy: { view: "view_front34", flipX: true } (de frente en 3/4, mirando abajo-izquierda hacia el jugador)
   * - Si existe una vista con "native": true en el atlas, se usa con flipX: false.
   * - Fallback si falta view_back34 -> view_back (sin flip). Si falta view_front34 -> view_front.
   * - Escala UNIFORME y ENTERA respecto al tamaño nativo del frame (Math.max(1, Math.floor(targetHeight / nativeHeight))).
   * - Pies en el centro de su plataforma elíptica en coordenadas enteras, con deformación idle por filas.
   */
  private applyCreatureSpritesAndScales(): void {
    const { enemyPlatform, allyPlatform, allyTargetHeight, enemyTargetHeight } = this.layout;
    const battleViews = (battleConfigRaw as any).battleViews || {
      ally: { view: 'view_back34', flipX: true },
      enemy: { view: 'view_front34', flipX: true },
    };

    const bustMode: BustAnimationMode =
      GlobalSaveService.getCurrentState()?.settings?.bustAnimation || 'subtle';

    const plCreature = this.engine.getPlayerActive();
    const opCreature = this.engine.getOpponentActive();

    // --- ALLY (Abajo-Izquierda: de espaldas 3/4, mirando arriba-derecha hacia la enemiga) ---
    let allyView = (this.debugAllyViewOverride || battleViews.ally?.view || 'view_back34') as SpriteView;
    let allyFlipX = this.debugAllyFlipOverride !== null ? this.debugAllyFlipOverride : Boolean(battleViews.ally?.flipX ?? true);

    if (allyView === 'view_back34' && !GlobalAssetRegistry.hasRealCreatureView(plCreature.speciesId, 'view_back34')) {
      allyView = 'view_back';
      if (this.debugAllyFlipOverride === null) allyFlipX = false;
    } else {
      const allyMeta = GlobalAssetRegistry.getCreatureFrameMeta(plCreature.speciesId, allyView);
      if (allyMeta.native && this.debugAllyFlipOverride === null) {
        allyFlipX = false;
      }
    }

    this.playerView = allyView;
    this.playerFlipX = allyFlipX;

    const plTex = GlobalAssetRegistry.getCreatureSpritePixi(plCreature.speciesId, allyView);
    this.playerSprite.texture = plTex;
    this.playerSprite.bustMode = bustMode;
    this.playerSprite.timeScale = this.debugSlowMotion ? 0.25 : 1.0;
    this.playerSprite.setIdleMeta(this.getEffectiveIdleMeta(plCreature.speciesId, allyView));

    const plNativeH = Math.max(1, plTex.height || 160);
    let plScale = this.debugNativeSize
      ? 1
      : this.debugIntegerScale
      ? Math.max(1, Math.floor(allyTargetHeight / plNativeH))
      : Number((allyTargetHeight / plNativeH).toFixed(2));

    this.playerBaseScale = plScale;
    this.playerSignX = allyFlipX ? -1 : 1;

    this.playerSprite.scale.set(this.playerSignX * plScale, plScale);
    this.playerBaseX = Math.round(allyPlatform.cx);
    this.playerBaseY = Math.round(allyPlatform.cy);
    this.playerSprite.position.set(this.playerBaseX, this.playerBaseY);

    // --- ENEMY (Arriba-Derecha: de frente 3/4, mirando abajo-izquierda hacia el jugador) ---
    let enemyView = (this.debugEnemyViewOverride || battleViews.enemy?.view || 'view_front34') as SpriteView;
    let enemyFlipX =
      this.debugEnemyFlipOverride !== null ? this.debugEnemyFlipOverride : Boolean(battleViews.enemy?.flipX ?? true);

    if (enemyView === 'view_front34' && !GlobalAssetRegistry.hasRealCreatureView(opCreature.speciesId, 'view_front34')) {
      enemyView = 'view_front';
      if (this.debugEnemyFlipOverride === null) enemyFlipX = false;
    } else {
      const enemyMeta = GlobalAssetRegistry.getCreatureFrameMeta(opCreature.speciesId, enemyView);
      if (enemyMeta.native && this.debugEnemyFlipOverride === null) {
        enemyFlipX = false;
      }
    }

    this.opponentView = enemyView;
    this.opponentFlipX = enemyFlipX;

    const opTex = GlobalAssetRegistry.getCreatureSpritePixi(opCreature.speciesId, enemyView);
    this.opponentSprite.texture = opTex;
    this.opponentSprite.bustMode = bustMode;
    this.opponentSprite.timeScale = this.debugSlowMotion ? 0.25 : 1.0;
    this.opponentSprite.setIdleMeta(this.getEffectiveIdleMeta(opCreature.speciesId, enemyView));

    const opNativeH = Math.max(1, opTex.height || 160);
    let opScale = this.debugNativeSize
      ? 1
      : this.debugIntegerScale
      ? Math.max(1, Math.floor(enemyTargetHeight / opNativeH))
      : Number((enemyTargetHeight / opNativeH).toFixed(2));

    // La enemiga no debe superar la escala de la aliada para mantener sensación de profundidad
    if (this.debugIntegerScale && !this.debugNativeSize && opScale > plScale) {
      opScale = plScale;
    }

    this.opponentBaseScale = opScale;
    this.opponentSignX = enemyFlipX ? -1 : 1;

    this.opponentSprite.scale.set(this.opponentSignX * opScale, opScale);
    this.opponentBaseX = Math.round(enemyPlatform.cx);
    this.opponentBaseY = Math.round(enemyPlatform.cy);
    this.opponentSprite.position.set(this.opponentBaseX, this.opponentBaseY);

    // Validación en consola de escala entera, transparencia y aviso de mirrorSafe: false
    this.validateSpriteCompliance('Aliada', this.playerSprite, plCreature.speciesId, allyView, allyFlipX);
    this.validateSpriteCompliance('Enemiga', this.opponentSprite, opCreature.speciesId, enemyView, enemyFlipX);
  }

  private validateSpriteCompliance(
    roleLabel: string,
    sprite: BattleIdleMesh,
    speciesId: string,
    view: SpriteView,
    flipX: boolean
  ): void {
    const absScaleX = Math.abs(sprite.scale.x);
    const absScaleY = Math.abs(sprite.scale.y);

    if (!Number.isInteger(absScaleX) || !Number.isInteger(absScaleY) || absScaleX !== absScaleY) {
      console.warn(
        `⚠️ [BattleScene Debug] Sprite '${roleLabel}' (${speciesId}) se está renderizando con escala NO entera o no uniforme: scale=(${sprite.scale.x}, ${sprite.scale.y})`
      );
    }

    const meta = GlobalAssetRegistry.getCreatureFrameMeta(speciesId, view);
    if (flipX && !meta.mirrorSafe) {
      console.info(
        `ℹ️ [BattleScene Asimetría] '${roleLabel}' (${speciesId}, ${view}, flipX=true) -> mirrorSafe: false (${meta.note})`
      );
    }

    const set = GlobalAssetRegistry.getCreatureSpriteSet(speciesId);
    const canvas = set ? (set as any)[view] || set.view_front34 || set.front : null;
    if (canvas && canvas instanceof HTMLCanvasElement) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const cornerAlpha = ctx.getImageData(0, 0, 1, 1).data[3];
        if (cornerAlpha > 0) {
          console.warn(
            `⚠️ [BattleScene Debug] La textura de '${roleLabel}' (${speciesId}, vista ${view}) aún tiene fondo NO transparente en (0,0) (alpha=${cornerAlpha}).`
          );
        }
      }
    }
  }

  private getPlatformColor(): number {
    if (this.biome === 'bosque') return COLOR_NUM.smokedWood;
    if (this.biome === 'cueva') return COLOR_NUM.inkCrypt;
    if (this.biome === 'interior') return COLOR_NUM.bronze;
    return COLOR_NUM.smokedWood; // Pasto
  }

  /**
   * Req 5: TEXTO Y UI
   * - Texto con resolution igual a la del renderer y tamaños múltiplos del tamaño nativo de Pixelify Sans (8, 16, 24 px).
   * - Posiciones alineadas a la cuadrícula de píxeles (Math.round).
   */
  private buildHUD(): void {
    this.hudContainer = new Container();
    this.hudContainer.roundPixels = true;
    this.container.addChild(this.hudContainer);

    const { enemyHud, allyHud } = this.layout;
    const textRes = this.getTextRes();

    // 1. Opponent HUD Card (Top-Left)
    const opCard = new KitCard({
      width: enemyHud.w,
      height: enemyHud.h,
      variant: 'smokedWood',
    });
    opCard.position.set(Math.round(enemyHud.x), Math.round(enemyHud.y));

    const opCreature = this.engine.getOpponentActive();
    const opNameTxt = new Text({
      text: (opCreature.nickname || opCreature.speciesId).toUpperCase(),
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    opNameTxt.roundPixels = true;
    opNameTxt.position.set(14, 10);
    opCard.addChild(opNameTxt);

    this.opponentLevelText = new Text({
      text: `Nv.${opCreature.level}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.opponentLevelText.roundPixels = true;
    this.opponentLevelText.position.set(Math.round(enemyHud.w - 104), 10);
    opCard.addChild(this.opponentLevelText);

    // Opponent HP Track & Fill
    this.opponentBarWidth = Math.round(enemyHud.w - 72);
    const opTrack = new Graphics();
    opTrack.roundRect(14, 38, this.opponentBarWidth, 16, 4);
    opTrack.fill({ color: COLOR_NUM.inkCrypt });
    opCard.addChild(opTrack);

    this.opponentHpBarFill = new Graphics();
    opCard.addChild(this.opponentHpBarFill);

    this.opponentHpText = new Text({
      text: `${opCreature.currentHp}/${opCreature.maxHp}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.smoke,
      }),
    });
    this.opponentHpText.roundPixels = true;
    this.opponentHpText.anchor.set(1, 0);
    this.opponentHpText.position.set(Math.round(14 + this.opponentBarWidth), 58);
    opCard.addChild(this.opponentHpText);

    this.opponentStatusBadge = new Container();
    this.opponentStatusBadge.position.set(14, 58);
    opCard.addChild(this.opponentStatusBadge);

    // Opponent Mini Part Silhouette
    this.opponentSilhouette = new HumanoidPartSilhouette();
    this.opponentSilhouette.position.set(Math.round(enemyHud.w - 48), 8);
    this.opponentSilhouette.scale.set(0.75);
    opCard.addChild(this.opponentSilhouette);

    this.hudContainer.addChild(opCard);

    // 2. Player HUD Card (Bottom-Right)
    const plCard = new KitCard({
      width: allyHud.w,
      height: allyHud.h,
      variant: 'smokedWood',
    });
    plCard.position.set(Math.round(allyHud.x), Math.round(allyHud.y));

    const plCreature = this.engine.getPlayerActive();
    const plNameTxt = new Text({
      text: (plCreature.nickname || plCreature.speciesId).toUpperCase(),
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    plNameTxt.roundPixels = true;
    plNameTxt.position.set(14, 10);
    plCard.addChild(plNameTxt);

    this.playerLevelText = new Text({
      text: `Nv.${plCreature.level}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.playerLevelText.roundPixels = true;
    this.playerLevelText.position.set(Math.round(allyHud.w - 104), 10);
    plCard.addChild(this.playerLevelText);

    // Player HP Track & Fill
    this.playerBarWidth = Math.round(allyHud.w - 72);
    const plTrack = new Graphics();
    plTrack.roundRect(14, 38, this.playerBarWidth, 18, 4);
    plTrack.fill({ color: COLOR_NUM.inkCrypt });
    plCard.addChild(plTrack);

    this.playerHpBarFill = new Graphics();
    plCard.addChild(this.playerHpBarFill);

    this.playerHpText = new Text({
      text: `${plCreature.currentHp}/${plCreature.maxHp}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.playerHpText.roundPixels = true;
    this.playerHpText.anchor.set(1, 0);
    this.playerHpText.position.set(Math.round(14 + this.playerBarWidth), 60);
    plCard.addChild(this.playerHpText);

    // Player EXP Bar
    const expTrack = new Graphics();
    expTrack.roundRect(14, Math.round(allyHud.h - 16), this.playerBarWidth, 8, 4);
    expTrack.fill({ color: COLOR_NUM.inkCrypt });
    plCard.addChild(expTrack);

    this.playerExpBarFill = new Graphics();
    plCard.addChild(this.playerExpBarFill);

    this.playerStatusBadge = new Container();
    this.playerStatusBadge.position.set(14, 60);
    plCard.addChild(this.playerStatusBadge);

    // Player Mini Part Silhouette
    this.playerSilhouette = new HumanoidPartSilhouette();
    this.playerSilhouette.position.set(Math.round(allyHud.w - 48), 8);
    this.playerSilhouette.scale.set(0.75);
    plCard.addChild(this.playerSilhouette);

    this.hudContainer.addChild(plCard);

    // Initial render of fills and silhouettes
    this.renderHpBar('player', plCreature.currentHp, plCreature.maxHp);
    this.renderHpBar('opponent', opCreature.currentHp, opCreature.maxHp);
    this.renderExpBar(plCreature.currentExp, plCreature.maxHp * 10);
    this.updateSilhouettes();

    UIKitLinter.inspectTree(this.hudContainer, 'BattleHUD');
  }

  private buildUIMenu(): void {
    this.uiMenuContainer = new Container();
    this.uiMenuContainer.zIndex = 900;
    this.uiMenuContainer.roundPixels = true;
    this.container.addChild(this.uiMenuContainer);

    const { narratorBox } = this.layout;
    const textRes = this.getTextRes();

    // Narrator Box using KitCard (smokedWood + bronze frame)
    this.narratorBox = new KitCard({
      width: narratorBox.w,
      height: narratorBox.h,
      variant: 'smokedWood',
    });
    this.narratorBox.position.set(Math.round(narratorBox.x), Math.round(narratorBox.y));

    this.narratorText = new Text({
      text: '¿Qué debería hacer tu Souldoll?',
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: Math.round(narratorBox.w - 32),
      }),
    });
    this.narratorText.roundPixels = true;
    this.narratorText.position.set(16, Math.round((narratorBox.h - 20) / 2));
    this.narratorBox.addChild(this.narratorText);

    this.uiMenuContainer.addChild(this.narratorBox);
  }

  public openMainMenu(): void {
    this.currentMenuState = 'main';
    this.selectedIndex = 0;
    this.clearSubmenus();

    const { menuBox } = this.layout;

    const menuContainer = new Container();
    menuContainer.roundPixels = true;
    menuContainer.position.set(Math.round(menuBox.x), Math.round(menuBox.y));

    const items = [
      { label: 'LUCHAR', iconId: 'weapon' as const, action: () => this.openFightMenu(), variant: 'primary' as const },
      { label: 'MOCHILA', iconId: 'bag' as const, action: () => this.openBagMenu(), variant: 'secondary' as const },
      { label: 'EQUIPO', iconId: 'party' as const, action: () => this.openPartyMenu(), variant: 'secondary' as const },
      { label: 'HUIR', iconId: 'back' as const, action: () => this.handleFleeAction(), variant: 'secondary' as const },
    ];

    const gapX = 10;
    const gapY = 10;
    const btnW = Math.floor((menuBox.w - gapX) / 2);
    const btnH = Math.floor((menuBox.h - gapY) / 2);

    this.menuItemsContainers = [];
    items.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const btn = new KitButton({
        width: btnW,
        height: btnH,
        label: item.label,
        iconId: item.iconId,
        variant: item.variant,
        fontSize: 16,
        onClick: () => item.action(),
      });
      btn.position.set(Math.round(col * (btnW + gapX)), Math.round(row * (btnH + gapY)));

      menuContainer.addChild(btn);
      this.menuItemsContainers.push(btn);
    });

    this.uiMenuContainer.addChild(menuContainer);
    this.showNarratorMessage('¿Qué debería hacer tu Souldoll?');
    UIKitLinter.inspectTree(this.uiMenuContainer, 'BattleMainMenu');
  }

  private openFightMenu(): void {
    this.currentMenuState = 'fight';
    this.selectedIndex = 0;
    this.clearSubmenus();

    const { menuBox } = this.layout;
    const textRes = this.getTextRes();

    const fightBox = new Container();
    fightBox.roundPixels = true;
    fightBox.position.set(Math.round(menuBox.x), Math.round(menuBox.y));

    const activeCreature = this.engine.getPlayerActive();
    const opponentCreature = this.engine.getOpponentActive();
    const opponentSpecies = CREATURES_DATA[opponentCreature.speciesId];

    const gapX = 10;
    const gapY = 10;
    const btnW = Math.floor((menuBox.w - gapX) / 2);
    const btnH = Math.floor((menuBox.h - gapY) / 2);

    this.menuItemsContainers = [];
    activeCreature.moves.forEach((m, idx) => {
      const moveDef = MOVES_DATA[m.moveId];
      if (!moveDef) return;

      const col = idx % 2;
      const row = Math.floor(idx / 2);

      const btn = new Container();
      btn.roundPixels = true;
      btn.position.set(Math.round(col * (btnW + gapX)), Math.round(row * (btnH + gapY)));
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      // Determine main target part
      let mainPart = 'torso';
      let maxWeight = -1;
      if (moveDef.partTargeting) {
        for (const [p, w] of Object.entries(moveDef.partTargeting)) {
          if ((w || 0) > maxWeight) {
            maxWeight = w || 0;
            mainPart = p;
          }
        }
      }
      const partNameMap: Record<string, string> = { head: 'Cabeza', torso: 'Torso', arms: 'Brazos', legs: 'Piernas' };
      const targetPartLabel = partNameMap[mainPart] || 'Torso';

      // Check if blocked by broken arms
      const armsBroken = activeCreature.partHP && activeCreature.partHP.arms <= 0;
      const requiresArms = moveDef.tags?.includes('weapon') || false;
      const isBlocked = armsBroken && requiresArms;

      const typeEff = DamageCalculator.calculateTypeEffectiveness(moveDef.type, opponentSpecies.types);
      let effTag = '1x';
      let tagCol = COLOR_NUM.bronze;
      if (typeEff.multiplier >= 2.0) {
        effTag = '2x';
        tagCol = COLOR_SEMANTIC.ok;
      } else if (typeEff.multiplier < 1.0 && typeEff.multiplier > 0) {
        effTag = '0.5x';
        tagCol = COLOR_SEMANTIC.warning;
      } else if (typeEff.multiplier === 0) {
        effTag = '0x';
        tagCol = COLOR_SEMANTIC.danger;
      }

      const bg = new Graphics();
      bg.roundRect(0, 0, btnW, btnH, 8);
      bg.fill({ color: isBlocked ? COLOR_NUM.disabledBg : COLOR_NUM.smokedWood, alpha: isBlocked ? 0.7 : 0.95 });
      bg.stroke({ color: isBlocked ? COLOR_SEMANTIC.danger : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      const nameTxt = new Text({
        text: moveDef.name.toUpperCase(),
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: isBlocked ? COLOR_HEX.disabledText : COLOR_HEX.parchment,
        }),
      });
      nameTxt.roundPixels = true;
      nameTxt.position.set(12, 8);
      btn.addChild(nameTxt);

      const subTxt = new Text({
        text: isBlocked ? 'BLOQUEADO' : `PP:${m.currentPp}/${m.maxPp} · ${targetPartLabel} (${effTag})`,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: isBlocked ? COLOR_HEX.disabledText : m.currentPp > 0 ? COLOR_HEX.gold : COLOR_HEX.smoke,
        }),
      });
      subTxt.roundPixels = true;
      subTxt.position.set(12, Math.round(btnH - 26));
      btn.addChild(subTxt);

      const badgeDot = new Graphics();
      badgeDot.roundRect(Math.round(btnW - 18), 10, 8, 8, 2);
      badgeDot.fill({ color: isBlocked ? COLOR_NUM.disabledBg : tagCol });
      btn.addChild(badgeDot);

      btn.on('pointerdown', () => {
        if (isBlocked) {
          GlobalAudioService.playSfx('cancel');
          this.showNarratorMessage(`¡${moveDef.name} requiere brazos intactos!`);
          return;
        }
        if (m.currentPp <= 0) {
          GlobalAudioService.playSfx('cancel');
          this.showNarratorMessage('¡No quedan PP para este movimiento!');
          return;
        }
        GlobalAudioService.playSfx('confirm');
        this.submitPlayerAction({ type: 'move', moveIndex: idx });
      });

      fightBox.addChild(btn);
      this.menuItemsContainers.push(btn);
    });

    this.addBackButtonToSubmenu(fightBox, menuBox.w);
    this.uiMenuContainer.addChild(fightBox);
  }

  private openBagMenu(): void {
    this.currentMenuState = 'bag';
    this.clearSubmenus();

    const { menuBox } = this.layout;
    const textRes = this.getTextRes();

    const bagBox = new Container();
    bagBox.roundPixels = true;
    bagBox.position.set(Math.round(menuBox.x), Math.round(menuBox.y));

    const saveState = GlobalSaveService.getCurrentState();
    const invEntries: Array<{ itemId: string; count: number }> = saveState?.inventory
      ? Object.entries(saveState.inventory).map(([itemId, count]) => ({ itemId, count }))
      : [
          { itemId: 'potion', count: 5 },
          { itemId: 'capsule_basic', count: 5 },
        ];

    const gapX = 10;
    const gapY = 10;
    const btnW = Math.floor((menuBox.w - gapX) / 2);
    const btnH = Math.floor((menuBox.h - gapY) / 2);

    this.menuItemsContainers = [];
    invEntries.slice(0, 4).forEach((item, idx) => {
      const itemDef = ITEMS_DATA[item.itemId];
      if (!itemDef) return;

      const col = idx % 2;
      const row = Math.floor(idx / 2);

      const btn = new Container();
      btn.roundPixels = true;
      btn.position.set(Math.round(col * (btnW + gapX)), Math.round(row * (btnH + gapY)));
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, btnW, btnH, 8);
      bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      const title = new Text({
        text: `${itemDef.name.toUpperCase()} x${item.count}`,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.gold,
        }),
      });
      title.roundPixels = true;
      title.position.set(12, Math.round((btnH - 20) / 2));
      btn.addChild(title);

      btn.on('pointerdown', () => {
        if (item.count <= 0) {
          GlobalAudioService.playSfx('cancel');
          return;
        }
        GlobalAudioService.playSfx('confirm');
        if (itemDef.category === 'bottle') {
          if (this.engine.battleType !== 'wild') {
            this.showNarratorMessage('¡No puedes capturar Souldolls de otro Soultrainer!');
            return;
          }
          this.submitPlayerAction({ type: 'capture', capsuleItemId: item.itemId });
        } else {
          this.submitPlayerAction({ type: 'item', itemId: item.itemId });
        }
      });

      bagBox.addChild(btn);
    });

    this.addBackButtonToSubmenu(bagBox, menuBox.w);
    this.uiMenuContainer.addChild(bagBox);
  }

  private openPartyMenu(): void {
    this.currentMenuState = 'party';
    this.clearSubmenus();

    const { menuBox } = this.layout;
    const textRes = this.getTextRes();

    const partyBox = new Container();
    partyBox.roundPixels = true;
    partyBox.position.set(Math.round(menuBox.x), Math.round(menuBox.y));

    const gapX = 10;
    const gapY = 10;
    const btnW = Math.floor((menuBox.w - gapX) / 2);
    const btnH = Math.floor((menuBox.h - gapY) / 2);

    this.engine.playerParty.slice(0, 4).forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);

      const btn = new Container();
      btn.roundPixels = true;
      btn.position.set(Math.round(col * (btnW + gapX)), Math.round(row * (btnH + gapY)));
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const isCurrent = idx === this.engine.playerActiveIndex;
      const bg = new Graphics();
      bg.roundRect(0, 0, btnW, btnH, 8);
      bg.fill({ color: isCurrent ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isCurrent ? COLOR_NUM.white : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      const nameTxt = new Text({
        text: `${(c.nickname || c.speciesId).toUpperCase()} Nv.${c.level}`,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: isCurrent ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
        }),
      });
      nameTxt.roundPixels = true;
      nameTxt.position.set(12, 8);
      btn.addChild(nameTxt);

      const hpTxt = new Text({
        text: `HP: ${c.currentHp}/${c.maxHp}`,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: isCurrent ? COLOR_HEX.inkCrypt : c.currentHp > 0 ? COLOR_HEX.gold : COLOR_HEX.smoke,
        }),
      });
      hpTxt.roundPixels = true;
      hpTxt.position.set(12, Math.round(btnH - 26));
      btn.addChild(hpTxt);

      // Botón rápido para abrir la Ficha de Souldoll desde el menú de equipo en batalla (Bloque 40 Req 4)
      const sheetBtn = new Container();
      sheetBtn.roundPixels = true;
      sheetBtn.position.set(Math.round(btnW - 68), Math.round(btnH - 30));
      sheetBtn.eventMode = 'static';
      sheetBtn.cursor = 'pointer';

      const sheetBg = new Graphics();
      sheetBg.roundRect(0, 0, 60, 24, 4);
      sheetBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.9 });
      sheetBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
      sheetBtn.addChild(sheetBg);

      const sheetTxt = new Text({
        text: 'FICHA',
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 10,
          fontWeight: 'bold',
          fill: COLOR_HEX.gold,
        }),
      });
      sheetTxt.roundPixels = true;
      sheetTxt.anchor.set(0.5);
      sheetTxt.position.set(30, 12);
      sheetBtn.addChild(sheetTxt);

      sheetBtn.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        GlobalSceneManager.pushScene('CreatureDetail', {
          index: idx,
          list: this.engine.playerParty,
        });
      });
      btn.addChild(sheetBtn);

      btn.on('pointerdown', () => {
        if (isCurrent) {
          this.showNarratorMessage('¡Esta Souldoll ya está en combate!');
          return;
        }
        if (c.currentHp <= 0) {
          GlobalAudioService.playSfx('cancel');
          this.showNarratorMessage('¡Esta Souldoll está debilitada y no puede luchar!');
          return;
        }
        GlobalAudioService.playSfx('confirm');
        this.submitPlayerAction({ type: 'switch', targetPartyIndex: idx });
      });

      partyBox.addChild(btn);
    });

    this.addBackButtonToSubmenu(partyBox, menuBox.w);
    this.uiMenuContainer.addChild(partyBox);
  }

  private addBackButtonToSubmenu(parentBox: Container, menuWidth: number): void {
    const backBtn = new KitButton({
      width: 116,
      height: 36,
      label: 'ATRÁS',
      iconId: 'back',
      variant: 'secondary',
      fontSize: 14,
      onClick: () => {
        this.openMainMenu();
      },
    });
    backBtn.position.set(Math.round(menuWidth - 116), -44);
    parentBox.addChild(backBtn);
  }

  private handleFleeAction(): void {
    if (this.engine.battleType !== 'wild') {
      this.showNarratorMessage('¡No puedes huir de un combate contra otro Soultrainer!');
      return;
    }
    this.submitPlayerAction({ type: 'flee' });
  }

  private async submitPlayerAction(action: BattleAction): Promise<void> {
    this.currentMenuState = 'busy';
    this.clearSubmenus();

    const turnEvents = this.engine.executeTurn(action);
    await this.player.playEvents(turnEvents);

    if (this.engine.isBattleOver) {
      await this.handleBattleEnd();
    } else {
      this.openMainMenu();
    }
  }

  private async handleBattleEnd(): Promise<void> {
    if (this.engine.victory) {
      GlobalAudioService.playVictoryTheme();
      await this.showNarratorMessage('¡Has ganado el combate!');

      // Hook for Evolution Check (Bloque 10)
      this.checkEvolutionHook();

      if (this.onBattleEndCallback) {
        this.onBattleEndCallback(true);
      } else {
        GlobalSceneManager.popScene();
      }
    } else {
      await this.showNarratorMessage('¡Te has quedado sin Souldolls activas! Regresas al Taller de Artífices.');
      const saveState = GlobalSaveService.getCurrentState();
      saveState.player.money = Math.floor(saveState.player.money / 2);
      saveState.party.forEach((c) => {
        c.currentHp = c.maxHp;
        c.status = null;
        c.moves.forEach((m) => (m.currentPp = m.maxPp));
      });
      GlobalSaveService.save();

      if (this.onBattleEndCallback) {
        this.onBattleEndCallback(false);
      } else {
        GlobalSceneManager.popScene();
        GlobalSceneManager.pushScene('Overworld', {
          mapId: 'interior_center',
          x: 5,
          y: 6,
          dir: 'up',
        });
      }
    }
  }

  public checkEvolutionHook(): void {
    const activeCreature = this.engine.getPlayerActive();
    if (!activeCreature) return;

    const evoCheck = GlobalEvolutionSystem.checkEvolution(activeCreature, 'level_up');
    if (evoCheck) {
      GlobalSceneManager.pushScene('Evolution', {
        creature: activeCreature,
        targetSpeciesId: evoCheck.targetSpeciesId,
      });
    }
  }

  private clearSubmenus(): void {
    while (this.uiMenuContainer.children.length > 1) {
      const child = this.uiMenuContainer.children[1];
      child.destroy({ children: true });
    }
  }

  public async showNarratorMessage(msg: string): Promise<void> {
    this.narratorText.text = msg;
    await this.sleep(400);
  }

  // --- ANIMATIONS, HOTSPOTS & VISUAL UPDATES (BLOQUE 38 REQ 3, 4 & 7) ---

  /**
   * Dirección visual horizontal hacia la que mira el rol (1 = derecha, -1 = izquierda),
   * calculada dinámicamente según la vista activa y su flipX (nunca un signo fijo).
   */
  public getRoleFacingDirX(side: BattleSide): number {
    const view = side === 'player' ? this.playerView : this.opponentView;
    const flipX = side === 'player' ? this.playerFlipX : this.opponentFlipX;
    // En el arte original: view_front34 mira a la DERECHA (+1), view_back34 mira a la IZQUIERDA (-1)
    const baseDir = view === 'view_back34' || view === 'side_l' ? -1 : 1;
    return flipX ? -baseDir : baseDir;
  }

  /**
   * Bloque 38 Req 3 & Bloque 39 Req 5:
   * Los hotspots de partes (head, torso, arms, legs, weapon), los números de daño y las chispas de ki
   * se reflejan junto al sprite (x' = -x cuando flipX es true) y se transforman con la misma
   * deformación por franjas del idle (los hotspots de torso y cabeza suben con la franja).
   */
  public getPartHotspotWorldPos(
    side: BattleSide,
    part: 'head' | 'torso' | 'arms' | 'legs' | 'weapon' = 'torso'
  ): { x: number; y: number } {
    const isPlayer = side === 'player';
    const baseX = isPlayer ? this.playerBaseX : this.opponentBaseX;
    const baseY = isPlayer ? this.playerBaseY : this.opponentBaseY;
    const flipX = isPlayer ? this.playerFlipX : this.opponentFlipX;
    const sprite = isPlayer ? this.playerSprite : this.opponentSprite;
    const scale = isPlayer ? this.playerBaseScale : this.opponentBaseScale;
    const texH = Math.max(1, sprite?.texture?.height || 160);
    const renderedH = texH * scale;

    const hotspotsCfg = (battleConfigRaw as any).partHotspots || {
      head: { dx: 4, dy: -0.78 },
      torso: { dx: 2, dy: -0.52 },
      arms: { dx: 22, dy: -0.50 },
      legs: { dx: 0, dy: -0.20 },
      weapon: { dx: 26, dy: -0.54 },
    };

    const spec = hotspotsCfg[part] || hotspotsCfg.torso;
    const rawDx = (spec.dx || 0) * scale;
    // Reflejo exacto respecto al pivote: x' = -x cuando flipX es true
    const reflectedDx = flipX ? -rawDx : rawDx;
    const dyNorm = spec.dy ?? -0.5;
    const dyBase = dyNorm * renderedH;

    // Deformación por franjas en píxeles nativos multiplicada por la escala entera del contenedor
    const deformDeltaY = sprite ? sprite.getDeformedRowDeltaY(dyNorm) * scale : 0;

    return {
      x: Math.round(baseX + reflectedDx),
      y: Math.round(baseY + dyBase + deformDeltaY),
    };
  }

  public getSpritePosition(side: BattleSide): { x: number; y: number } {
    return this.getPartHotspotWorldPos(side, 'torso');
  }

  /**
   * Bloque 38 Req 4 & Bloque 39 Req 3 & 5:
   * Ataque: embestida hacia el rival respetando el flip y la orientación del rol,
   * aplicando un impulso al resorte secundario del busto sin reiniciar la fase del idle.
   */
  public async animateAttackerLunge(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    const cfgIdle = (battleConfigRaw as any).idle || {};
    sprite.applyImpulse(cfgIdle.lungeImpulse ?? -22);

    this.isActionAnimating = true;
    const origX = Math.round(sprite.position.x);
    const origY = Math.round(sprite.position.y);

    const dirX = this.getRoleFacingDirX(side);
    const otherBaseY = side === 'player' ? this.opponentBaseY : this.playerBaseY;
    const dirY = otherBaseY < origY ? -1 : 1;

    const lungeDx = Math.round(dirX * 28);
    const lungeDy = Math.round(dirY * 16);

    sprite.position.set(Math.round(origX + lungeDx), Math.round(origY + lungeDy));
    await this.sleep(120);
    sprite.position.set(origX, origY);
    this.isActionAnimating = false;
  }

  /**
   * Bloque 38 Req 4 & Bloque 39 Req 3 & 5:
   * Daño: parpadeo blanco, retroceso de 1-2 px enteros alejándose del atacante e impulso mayor al resorte.
   */
  public async animateDefenderHitBlink(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    const cfgIdle = (battleConfigRaw as any).idle || {};
    sprite.applyImpulse(cfgIdle.hitImpulse ?? 28);

    this.isActionAnimating = true;
    const origX = Math.round(sprite.position.x);
    const origY = Math.round(sprite.position.y);

    // Alejarse del atacante (opuesto a la dirección hacia la que mira el defensor)
    const retreatDirX = -this.getRoleFacingDirX(side);
    const retreatDirY = side === 'player' ? 1 : -1;

    for (let i = 0; i < 4; i++) {
      const stepPx = i % 2 === 0 ? 2 : 1;
      sprite.position.set(Math.round(origX + retreatDirX * stepPx), Math.round(origY + retreatDirY * stepPx));
      sprite.tint = i % 2 === 0 ? 0xffffff : 0xf43f5e;
      sprite.alpha = i % 2 === 0 ? 0.45 : 1.0;
      await this.sleep(60);
    }
    sprite.tint = 0xffffff;
    sprite.alpha = 1.0;
    sprite.position.set(origX, origY);
    this.isActionAnimating = false;
  }

  /**
   * Bloque 38 Req 4 & Bloque 39 Req 3 & 5:
   * KO: impulso de caída, desplazamiento en píxeles enteros y fundido de alpha.
   */
  public async animateFaint(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    const cfgIdle = (battleConfigRaw as any).idle || {};
    sprite.applyImpulse(cfgIdle.koImpulse ?? 34);
    sprite.setPaused(true);

    this.isActionAnimating = true;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.05;
      sprite.position.y = Math.round(sprite.position.y + 3);
      sprite.alpha = Math.max(0, 1 - elapsed / 0.5);
      if (elapsed >= 0.5) {
        clearInterval(interval);
        sprite.visible = false;
      }
    }, 30);
    await this.sleep(550);
    this.isActionAnimating = false;
  }

  public async animateSwitchIn(side: BattleSide, _creatureName: string, hp: number, maxHp: number): Promise<void> {
    const creature = side === 'player' ? this.engine.getPlayerActive() : this.engine.getOpponentActive();
    this.applyCreatureSpritesAndScales();

    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    sprite.setPaused(false);
    sprite.visible = true;
    sprite.alpha = 0;

    await GlobalVFXSystem.screenFlash(0x38bdf8, 150);
    sprite.alpha = 1;

    this.renderHpBar(side, hp, maxHp);
    if (side === 'player') {
      this.updateLevelBadge('player', creature.level);
    } else {
      this.updateLevelBadge('opponent', creature.level);
    }
    if (this.debugVisible) this.renderDebugOverlay();
  }

  public async animateCaptureSequence(shakes: number, success: boolean): Promise<void> {
    this.opponentSprite.setPaused(true);
    const bottle = new Container();
    bottle.roundPixels = true;
    const startX = this.playerBaseX;
    const startY = Math.round(this.playerBaseY - 50);
    bottle.position.set(startX, startY);

    const bottleG = new Graphics();
    bottleG.roundRect(-8, -14, 16, 24, 4);
    bottleG.fill({ color: 0x38bdf8, alpha: 0.9 });
    bottleG.stroke({ color: 0xffffff, width: 2 });
    bottle.addChild(bottleG);
    this.container.addChild(bottle);

    const targetX = this.opponentBaseX;
    const targetY = Math.round(this.opponentBaseY - 24);
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(startX + (targetX - startX) * t);
      const y = Math.round(startY + (targetY - startY) * t - Math.sin(t * Math.PI) * 110);
      bottle.position.set(x, y);
      bottle.rotation = t * Math.PI * 4;
      await this.sleep(25);
    }
    bottle.rotation = 0;

    const opCreature = this.engine.getOpponentActive();
    const soulSprite = new Sprite(this.opponentSprite.texture);
    soulSprite.anchor.set(0.5, 1.0);
    soulSprite.scale.copyFrom(this.opponentSprite.scale);
    soulSprite.position.copyFrom(this.opponentSprite.position);
    soulSprite.alpha = 0.65;
    soulSprite.tint = 0x38bdf8;
    this.container.addChild(soulSprite);

    this.opponentSprite.alpha = 0.35;
    GlobalVFXSystem.playPresetVfx('bottle_seal', targetX, targetY, targetX, targetY - 40);

    const soulSteps = 12;
    for (let s = 1; s <= soulSteps; s++) {
      const st = s / soulSteps;
      soulSprite.position.set(targetX, Math.round(this.opponentBaseY - st * 30));
      soulSprite.alpha = 0.65 * (1 - st * 0.8);
      await this.sleep(30);
    }
    soulSprite.visible = false;

    await GlobalVFXSystem.screenFlash(0xffffff, 120);

    for (let s = 1; s <= shakes; s++) {
      await this.sleep(350);
      bottle.rotation = 0.35;
      GlobalAudioService.playSfx('confirm');
      await this.sleep(100);
      bottle.rotation = -0.35;
      await this.sleep(100);
      bottle.rotation = 0;
    }

    if (success) {
      await GlobalVFXSystem.screenFlash(0xfacc15, 250);
      await GlobalVFXSystem.playPresetVfx('ki_burst', targetX, targetY, targetX, targetY);
      GlobalAudioService.playSfx('levelUp');
      await this.showNarratorMessage(
        `¡Alma de ${(opCreature.nickname || opCreature.speciesId).toUpperCase()} capturada! Guardada SIN CUERPO en tu Códice.`
      );
      bottle.destroy();
      soulSprite.destroy();
      this.opponentSprite.visible = false;
    } else {
      await GlobalVFXSystem.screenFlash(0xf43f5e, 150);
      soulSprite.visible = true;
      for (let s = soulSteps; s >= 0; s--) {
        const st = s / soulSteps;
        soulSprite.position.set(targetX, Math.round(this.opponentBaseY - st * 30));
        soulSprite.alpha = 0.65 * (1 - st * 0.8);
        await this.sleep(25);
      }
      soulSprite.destroy();
      this.opponentSprite.alpha = 1.0;
      this.opponentSprite.visible = true;
      this.opponentSprite.setPaused(false);
      bottle.destroy();
      await this.showNarratorMessage('¡El alma salvaje resistió la resonancia y regresó a su contenedor!');
    }
  }

  public updateSilhouettes(): void {
    if (this.engine) {
      const plCreature = this.engine.getPlayerActive();
      const opCreature = this.engine.getOpponentActive();
      if (plCreature && this.playerSilhouette) {
        this.playerSilhouette.updateParts(plCreature.partHP, plCreature.maxPartHP);
      }
      if (opCreature && this.opponentSilhouette) {
        this.opponentSilhouette.updateParts(opCreature.partHP, opCreature.maxPartHP);
      }
    }
  }

  public flashPartZone(side: BattleSide, part: BodyPart, colorHex = 0xffffff): void {
    const sil = side === 'player' ? this.playerSilhouette : this.opponentSilhouette;
    if (sil) {
      sil.flashZone(part, colorHex);
    }
  }

  public renderHpBar(side: BattleSide, currentHp: number, maxHp: number): void {
    const fillG = side === 'player' ? this.playerHpBarFill : this.opponentHpBarFill;
    const txt = side === 'player' ? this.playerHpText : this.opponentHpText;

    const barWidth = side === 'player' ? this.playerBarWidth : this.opponentBarWidth;
    const barHeight = side === 'player' ? 18 : 16;
    const posX = 14;
    const posY = 38;

    const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
    let color = COLOR_SEMANTIC.ok;
    if (ratio < 0.25) color = COLOR_SEMANTIC.danger;
    else if (ratio < 0.5) color = COLOR_SEMANTIC.warning;

    fillG.clear();
    fillG.roundRect(posX, posY, Math.floor(barWidth * ratio), barHeight, 4);
    fillG.fill({ color });

    txt.text = `${currentHp}/${maxHp}`;
  }

  public async updateHpBarAnimated(side: BattleSide, newHp: number, maxHp: number): Promise<void> {
    this.renderHpBar(side, newHp, maxHp);
    await this.sleep(250);
  }

  public renderExpBar(currentExp: number, maxExp: number): void {
    const ratio = Math.max(0, Math.min(1, currentExp / maxExp));
    this.playerExpBarFill.clear();
    this.playerExpBarFill.roundRect(
      14,
      Math.round(this.layout.allyHud.h - 16),
      Math.floor(this.playerBarWidth * ratio),
      8,
      4
    );
    this.playerExpBarFill.fill({ color: COLOR_NUM.soulViolet });
  }

  public async updateExpBarAnimated(currentExp: number, maxExp: number): Promise<void> {
    this.renderExpBar(currentExp, maxExp);
    await this.sleep(300);
  }

  public updateLevelBadge(side: BattleSide, level: number): void {
    const txt = side === 'player' ? this.playerLevelText : this.opponentLevelText;
    txt.text = `Nv.${level}`;
  }

  public setStatusBadge(side: BattleSide, status: string): void {
    const badgeContainer = side === 'player' ? this.playerStatusBadge : this.opponentStatusBadge;
    badgeContainer.removeChildren();

    if (!status) return;

    const bg = new Graphics();
    bg.roundRect(0, 0, 52, 20, 4);

    let color = COLOR_NUM.disabledBg;
    if (status === 'burn') color = COLOR_SEMANTIC.danger;
    if (status === 'paralysis') color = COLOR_SEMANTIC.warning;
    if (status === 'poison') color = COLOR_NUM.soulViolet;
    if (status === 'sleep') color = COLOR_SEMANTIC.info;

    bg.fill({ color });
    badgeContainer.addChild(bg);

    const txt = new Text({
      text: status.slice(0, 3).toUpperCase(),
      resolution: this.getTextRes(),
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.white,
      }),
    });
    txt.roundPixels = true;
    txt.anchor.set(0.5);
    txt.position.set(26, 10);
    badgeContainer.addChild(txt);
  }

  // ---------------------------------------------------------------------------
  // BLOQUE 37 REQ 7: PANEL Y OVERLAY DE DEBUG DE COMBATE (F2)
  // Toggles: orientación (flip), escala entera, bounding boxes, anclas y grid de píxeles,
  // tamaño nativo vs escalado, y contador de FPS.
  // ---------------------------------------------------------------------------

  public toggleDebugOverlay(): void {
    this.debugVisible = !this.debugVisible;
    this.debugOverlayContainer.visible = this.debugVisible;
    this.debugPanelContainer.visible = this.debugVisible;
    GlobalAudioService.playSfx('select');
    if (this.debugVisible) {
      this.renderDebugOverlay();
      this.renderDebugPanel();
    }
  }

  private buildDebugOverlay(): void {
    this.debugOverlayContainer = new Container();
    this.debugOverlayContainer.zIndex = 950;
    this.debugOverlayContainer.visible = this.debugVisible;
    this.container.addChild(this.debugOverlayContainer);

    this.debugPanelContainer = new Container();
    this.debugPanelContainer.zIndex = 960;
    this.debugPanelContainer.visible = this.debugVisible;
    this.container.addChild(this.debugPanelContainer);

    if (this.debugVisible) {
      this.renderDebugOverlay();
      this.renderDebugPanel();
    }
  }

  private renderDebugOverlay(): void {
    this.debugOverlayContainer.removeChildren();
    if (!this.debugVisible) return;

    const g = new Graphics();

    const drawSpriteDebug = (side: BattleSide, sprite: BattleIdleMesh, baseScale: number, boxColor: number) => {
      if (!sprite || !sprite.visible) return;
      const w = Math.round((sprite.texture.width || 64) * baseScale);
      const h = Math.round((sprite.texture.height || 160) * baseScale);
      const ax = Math.round(sprite.position.x);
      const ay = Math.round(sprite.position.y);
      const left = Math.round(ax - w * 0.5);
      const top = Math.round(ay - h);

      // 1. Pixel Grid inside sprite bounds (step = integer scale factor)
      if (this.debugShowAnchorsAndGrid && baseScale >= 2) {
        const step = Math.max(2, Math.round(baseScale));
        for (let x = left; x <= left + w; x += step) {
          g.moveTo(x, top);
          g.lineTo(x, top + h);
        }
        for (let y = top; y <= top + h; y += step) {
          g.moveTo(left, y);
          g.lineTo(left + w, y);
        }
        g.stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
      }

      // 2. Bounding Box
      if (this.debugShowBoundingBoxes) {
        g.rect(left, top, w, h);
        g.stroke({ color: boxColor, width: 2, alpha: 0.85 });
      }

      // 3. Bloque 39 Req 6: Líneas de neck, waist, caja de bust y línea horizontal de anclaje en los pies
      if (this.debugShowIdleBands) {
        const idleMeta = sprite.idleMeta;
        if (idleMeta) {
          const neckY = Math.round(top + idleMeta.neck * h);
          const waistY = Math.round(top + idleMeta.waist * h);

          // Neck line (Cyan)
          g.moveTo(left - 8, neckY);
          g.lineTo(left + w + 8, neckY);
          g.stroke({ color: 0x38bdf8, width: 2 });

          // Waist line (Amber)
          g.moveTo(left - 8, waistY);
          g.lineTo(left + w + 8, waistY);
          g.stroke({ color: 0xf59e0b, width: 2 });

          // Bust box (Magenta)
          if (idleMeta.bust) {
            const flipX = side === 'player' ? this.playerFlipX : this.opponentFlipX;
            const bx0 = flipX ? 1 - idleMeta.bust.x1 : idleMeta.bust.x0;
            const bx1 = flipX ? 1 - idleMeta.bust.x0 : idleMeta.bust.x1;
            const boxX = Math.round(left + bx0 * w);
            const boxY = Math.round(top + idleMeta.bust.y0 * h);
            const boxW = Math.round((bx1 - bx0) * w);
            const boxH = Math.round((idleMeta.bust.y1 - idleMeta.bust.y0) * h);
            g.rect(boxX, boxY, boxW, boxH);
            g.stroke({ color: 0xec4899, width: 2 });
          }
        }

        // Feet Horizontal Anchor Line (Green if anchored 0px, Red if moved)
        const feetAnchored = !sprite.feetMovedWarning;
        g.moveTo(left - 18, ay);
        g.lineTo(left + w + 18, ay);
        g.stroke({ color: feetAnchored ? 0x10b981 : 0xef4444, width: 3 });
      }

      // 4. Anchor point (0.5, 1.0) at the feet
      if (this.debugShowAnchorsAndGrid) {
        g.moveTo(ax - 12, ay);
        g.lineTo(ax + 12, ay);
        g.moveTo(ax, ay - 12);
        g.lineTo(ax, ay + 12);
        g.stroke({ color: 0xfacc15, width: 2 });
        g.circle(ax, ay, 4);
        g.fill({ color: 0xef4444 });
      }

      // 5. Reflected & Deformed Part Hotspots (head, torso, arms, legs, weapon)
      if (this.debugShowHotspots) {
        const parts: Array<{ key: 'head' | 'torso' | 'arms' | 'legs' | 'weapon'; col: number }> = [
          { key: 'head', col: 0xfacc15 },
          { key: 'torso', col: 0x38bdf8 },
          { key: 'arms', col: 0x22c55e },
          { key: 'legs', col: 0xa855f7 },
          { key: 'weapon', col: 0xf97316 },
        ];
        parts.forEach((p) => {
          const hp = this.getPartHotspotWorldPos(side, p.key);
          g.circle(hp.x, hp.y, 4);
          g.fill({ color: p.col });
          g.circle(hp.x, hp.y, 4);
          g.stroke({ color: 0x090d16, width: 1.5 });
        });
      }
    };

    drawSpriteDebug('player', this.playerSprite, this.playerBaseScale, 0x38bdf8);
    drawSpriteDebug('opponent', this.opponentSprite, this.opponentBaseScale, 0xf43f5e);

    this.debugOverlayContainer.addChild(g);
  }

  private renderDebugPanel(): void {
    this.debugPanelContainer.removeChildren();
    if (!this.debugVisible) return;

    const textRes = this.getTextRes();
    const panelW = Math.min(410, this.layout.width - 16);
    const panelH = 486;
    const panelX = Math.round(this.layout.width - panelW - 8);
    const panelY = 8;

    const panel = new Container();
    panel.roundPixels = true;
    panel.position.set(panelX, panelY);

    const bg = new Graphics();
    bg.roundRect(0, 0, panelW, panelH, 8);
    bg.fill({ color: 0x090d16, alpha: 0.95 });
    bg.stroke({ color: 0x38bdf8, width: 2 });
    panel.addChild(bg);

    const title = new Text({
      text: 'DEBUG IDLE & VISTAS (F2) - B39',
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#38bdf8',
      }),
    });
    title.roundPixels = true;
    title.position.set(12, 8);
    panel.addChild(title);

    this.fpsText = new Text({
      text: `FPS:${this.currentFps}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#10b981',
      }),
    });
    this.fpsText.roundPixels = true;
    this.fpsText.position.set(panelW - 88, 8);
    panel.addChild(this.fpsText);

    const totalBufUpd =
      (this.playerSprite?.getBufferUpdatesPerSec() || 0) + (this.opponentSprite?.getBufferUpdatesPerSec() || 0);
    const anyFeetMoved = Boolean(this.playerSprite?.feetMovedWarning || this.opponentSprite?.feetMovedWarning);
    const anyNonInt = Boolean(this.playerSprite?.hasNonIntegerWarning || this.opponentSprite?.hasNonIntegerWarning);

    this.bufUpdatesText = new Text({
      text: `BufUpd/s: ${totalBufUpd} | Pies: ${anyFeetMoved ? '⚠ MOVIDO' : '✓ FIJOS (0px)'} | Int: ${
        anyNonInt ? '⚠ FLOAT' : '✓ ENTERO'
      }`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 8,
        fill: anyFeetMoved || anyNonInt ? '#ef4444' : '#4ade80',
      }),
    });
    this.bufUpdatesText.roundPixels = true;
    this.bufUpdatesText.position.set(12, 28);
    panel.addChild(this.bufUpdatesText);

    const editSpr = this.debugEditSide === 'player' ? this.playerSprite : this.opponentSprite;
    const editView = this.debugEditSide === 'player' ? this.playerView : this.opponentView;
    const editSpecies =
      this.debugEditSide === 'player'
        ? this.engine.getPlayerActive().speciesId
        : this.engine.getOpponentActive().speciesId;

    const ensureEditMeta = (): IdleBandMeta => {
      if (!this.debugCustomIdleMeta[editView]) {
        const base = this.getEffectiveIdleMeta(editSpecies, editView) || { neck: 0.30, waist: 0.48 };
        this.debugCustomIdleMeta[editView] = JSON.parse(JSON.stringify(base));
      }
      return this.debugCustomIdleMeta[editView]!;
    };

    const curMeta = this.getEffectiveIdleMeta(editSpecies, editView) || { neck: 0.30, waist: 0.48 };

    // Helper for compact stepper rows (Sliders / +/-)
    const addStepperRow = (
      rowIdx: number,
      label: string,
      valueStr: string,
      onMinus: () => void,
      onPlus: () => void
    ) => {
      const y = 44 + rowIdx * 32;
      const rowBg = new Graphics();
      rowBg.roundRect(12, y, panelW - 24, 28, 5);
      rowBg.fill({ color: 0x1e293b });
      rowBg.stroke({ color: 0x334155, width: 1 });
      panel.addChild(rowBg);

      const lbl = new Text({
        text: `${label}: ${valueStr}`,
        resolution: textRes,
        style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fontWeight: 'bold', fill: '#f8fafc' }),
      });
      lbl.roundPixels = true;
      lbl.position.set(20, y + 4);
      panel.addChild(lbl);

      const makeStepBtn = (bx: number, signTxt: string, cb: () => void) => {
        const b = new Container();
        b.roundPixels = true;
        b.position.set(bx, y + 2);
        b.eventMode = 'static';
        b.cursor = 'pointer';
        const g = new Graphics();
        g.roundRect(0, 0, 34, 24, 4);
        g.fill({ color: 0x0284c7 });
        b.addChild(g);
        const t = new Text({
          text: signTxt,
          resolution: textRes,
          style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fontWeight: 'bold', fill: '#ffffff' }),
        });
        t.roundPixels = true;
        t.anchor.set(0.5);
        t.position.set(17, 12);
        b.addChild(t);
        b.on('pointerdown', () => {
          GlobalAudioService.playSfx('select');
          cb();
          this.applyCreatureSpritesAndScales();
          this.renderDebugOverlay();
          this.renderDebugPanel();
        });
        panel.addChild(b);
      };

      makeStepBtn(panelW - 88, '-', onMinus);
      makeStepBtn(panelW - 48, '+', onPlus);
    };

    const viewCycle: SpriteView[] = ['view_back34', 'view_back', 'view_front34', 'view_front'];

    // Row 0: Rol editado + Vista
    addStepperRow(
      0,
      `Rol [${this.debugEditSide === 'player' ? 'ALIADA' : 'ENEMIGA'}]`,
      editView,
      () => {
        this.debugEditSide = this.debugEditSide === 'player' ? 'opponent' : 'player';
      },
      () => {
        const idx = viewCycle.indexOf(editView);
        const nextV = viewCycle[(idx + 1) % viewCycle.length];
        if (this.debugEditSide === 'player') this.debugAllyViewOverride = nextV;
        else this.debugEnemyViewOverride = nextV;
      }
    );

    // Row 1: Neck (0..1)
    addStepperRow(
      1,
      'Neck (Cuello)',
      curMeta.neck.toFixed(2),
      () => {
        const m = ensureEditMeta();
        m.neck = Math.max(0.05, Number((m.neck - 0.01).toFixed(2)));
      },
      () => {
        const m = ensureEditMeta();
        m.neck = Math.min(m.waist - 0.02, Number((m.neck + 0.01).toFixed(2)));
      }
    );

    // Row 2: Waist (0..1)
    addStepperRow(
      2,
      'Waist (Torso ½)',
      curMeta.waist.toFixed(2),
      () => {
        const m = ensureEditMeta();
        m.waist = Math.max(m.neck + 0.02, Number((m.waist - 0.01).toFixed(2)));
      },
      () => {
        const m = ensureEditMeta();
        m.waist = Math.min(0.85, Number((m.waist + 0.01).toFixed(2)));
      }
    );

    // Row 3: Bust Y0..Y1
    addStepperRow(
      3,
      'Bust Y0..Y1',
      curMeta.bust ? `${curMeta.bust.y0.toFixed(2)}..${curMeta.bust.y1.toFixed(2)}` : 'SIN BUST',
      () => {
        const m = ensureEditMeta();
        if (!m.bust) m.bust = { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 };
        else {
          m.bust.y0 = Math.max(0.15, Number((m.bust.y0 - 0.01).toFixed(2)));
          m.bust.y1 = Math.max(m.bust.y0 + 0.04, Number((m.bust.y1 - 0.01).toFixed(2)));
        }
      },
      () => {
        const m = ensureEditMeta();
        if (!m.bust) m.bust = { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 };
        else {
          m.bust.y0 = Math.min(0.6, Number((m.bust.y0 + 0.01).toFixed(2)));
          m.bust.y1 = Math.min(0.75, Number((m.bust.y1 + 0.01).toFixed(2)));
        }
      }
    );

    // Row 4: Amplitud Respiración & Rebote (1-3 px)
    addStepperRow(
      4,
      'Amp Resp/Bust',
      `${editSpr.breathAmpPx}px / ${editSpr.bustJigglePx}px`,
      () => {
        const next = Math.max(0, editSpr.breathAmpPx - 1);
        this.playerSprite.breathAmpPx = next;
        this.opponentSprite.breathAmpPx = next;
      },
      () => {
        const next = Math.min(3, editSpr.breathAmpPx + 1);
        this.playerSprite.breathAmpPx = next;
        this.opponentSprite.breathAmpPx = next;
      }
    );

    // Row 5: Resorte k (rigidez)
    addStepperRow(
      5,
      'Resorte k / c',
      `k=${editSpr.springK} c=${editSpr.springC}`,
      () => {
        this.playerSprite.springK = Math.max(20, editSpr.springK - 10);
        this.opponentSprite.springK = this.playerSprite.springK;
      },
      () => {
        this.playerSprite.springK = Math.min(200, editSpr.springK + 10);
        this.opponentSprite.springK = this.playerSprite.springK;
      }
    );

    // Row 6: Amortiguamiento c
    addStepperRow(
      6,
      'Amortig. c',
      `${editSpr.springC}`,
      () => {
        this.playerSprite.springC = Math.max(1, editSpr.springC - 1);
        this.opponentSprite.springC = this.playerSprite.springC;
      },
      () => {
        this.playerSprite.springC = Math.min(25, editSpr.springC + 1);
        this.opponentSprite.springC = this.playerSprite.springC;
      }
    );

    // Action Buttons at bottom of Debug Panel
    const actions = [
      {
        label: `Vel: ${this.debugSlowMotion ? '0.25x LENTA' : '1.0x NORMAL'}`,
        col: this.debugSlowMotion ? 0xd97706 : 0x1e293b,
        onClick: () => {
          this.debugSlowMotion = !this.debugSlowMotion;
          this.applyCreatureSpritesAndScales();
          this.renderDebugPanel();
        },
      },
      {
        label: `FlipX ${this.debugEditSide === 'player' ? 'Aliada' : 'Enemiga'}`,
        col: 0x0284c7,
        onClick: () => {
          if (this.debugEditSide === 'player') this.debugAllyFlipOverride = !this.playerFlipX;
          else this.debugEnemyFlipOverride = !this.opponentFlipX;
          this.applyCreatureSpritesAndScales();
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
      {
        label: '💥 IMPULSO (GOLPE)',
        col: 0xe11d48,
        onClick: () => {
          this.playerSprite.applyImpulse(28);
          this.opponentSprite.applyImpulse(28);
        },
      },
      {
        label: '📋 EXPORTAR JSON',
        col: 0x16a34a,
        onClick: () => {
          const exported = {
            view_front: this.getEffectiveIdleMeta('maga', 'view_front'),
            view_front34: this.getEffectiveIdleMeta('maga', 'view_front34'),
            view_back: this.getEffectiveIdleMeta('maga', 'view_back'),
            view_back34: this.getEffectiveIdleMeta('maga', 'view_back34'),
          };
          const jsonStr = JSON.stringify(exported, null, 2);
          console.log('📦 [Bloque 39 Export Idle JSON]:\n' + jsonStr);
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(jsonStr).catch(() => {});
          }
          this.showNarratorMessage('¡JSON de franjas idle exportado a consola y portapapeles!');
        },
      },
    ];

    actions.forEach((act, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const btnW = Math.floor((panelW - 32) / 2);
      const bx = 12 + col * (btnW + 8);
      const by = 274 + row * 38;

      const btn = new Container();
      btn.roundPixels = true;
      btn.position.set(bx, by);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bBg = new Graphics();
      bBg.roundRect(0, 0, btnW, 32, 6);
      bBg.fill({ color: act.col });
      bBg.stroke({ color: 0xffffff, width: 1.5 });
      btn.addChild(bBg);

      const bTxt = new Text({
        text: act.label,
        resolution: textRes,
        style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fontWeight: 'bold', fill: '#ffffff' }),
      });
      bTxt.roundPixels = true;
      bTxt.anchor.set(0.5);
      bTxt.position.set(Math.round(btnW / 2), 16);
      btn.addChild(bTxt);

      btn.on('pointerdown', () => {
        GlobalAudioService.playSfx('confirm');
        act.onClick();
      });

      panel.addChild(btn);
    });

    // Bust Animation Mode Selector (Apagada / Sutil 50% / Normal) - Bloque 39 Req 3
    const state = GlobalSaveService.getCurrentState();
    const curBustMode: BustAnimationMode = state?.settings?.bustAnimation || 'subtle';
    const bustBtn = new Container();
    bustBtn.roundPixels = true;
    bustBtn.position.set(12, 354);
    bustBtn.eventMode = 'static';
    bustBtn.cursor = 'pointer';

    const bustBg = new Graphics();
    bustBg.roundRect(0, 0, panelW - 24, 32, 6);
    bustBg.fill({ color: 0x7e22ce });
    bustBg.stroke({ color: 0xffffff, width: 1.5 });
    bustBtn.addChild(bustBg);

    const bustTxt = new Text({
      text: `Animación Busto: ${
        curBustMode === 'off' ? 'APAGADA' : curBustMode === 'normal' ? 'NORMAL (100%)' : 'SUTIL (50%)'
      }`,
      resolution: textRes,
      style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fontWeight: 'bold', fill: '#ffffff' }),
    });
    bustTxt.roundPixels = true;
    bustTxt.anchor.set(0.5);
    bustTxt.position.set(Math.round((panelW - 24) / 2), 16);
    bustBtn.addChild(bustTxt);

    bustBtn.on('pointerdown', () => {
      GlobalAudioService.playSfx('select');
      const modes: BustAnimationMode[] = ['off', 'subtle', 'normal'];
      const nextMode = modes[(modes.indexOf(curBustMode) + 1) % modes.length];
      if (state && state.settings) {
        state.settings.bustAnimation = nextMode;
        GlobalSaveService.save();
      }
      this.applyCreatureSpritesAndScales();
      this.renderDebugPanel();
    });
    panel.addChild(bustBtn);

    // Toggle Lines / Overlays button
    const ovBtn = new Container();
    ovBtn.roundPixels = true;
    ovBtn.position.set(12, 392);
    ovBtn.eventMode = 'static';
    ovBtn.cursor = 'pointer';

    const ovBg = new Graphics();
    ovBg.roundRect(0, 0, panelW - 24, 32, 6);
    ovBg.fill({ color: this.debugShowIdleBands ? 0x0284c7 : 0x1e293b });
    ovBg.stroke({ color: 0xffffff, width: 1.5 });
    ovBtn.addChild(ovBg);

    const ovTxt = new Text({
      text: `Ver Franjas/Pies/Hotspots: ${this.debugShowIdleBands ? 'ON' : 'OFF'}`,
      resolution: textRes,
      style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fontWeight: 'bold', fill: '#ffffff' }),
    });
    ovTxt.roundPixels = true;
    ovTxt.anchor.set(0.5);
    ovTxt.position.set(Math.round((panelW - 24) / 2), 16);
    ovBtn.addChild(ovTxt);

    ovBtn.on('pointerdown', () => {
      GlobalAudioService.playSfx('select');
      const next = !this.debugShowIdleBands;
      this.debugShowIdleBands = next;
      this.debugShowBoundingBoxes = next;
      this.debugShowAnchorsAndGrid = next;
      this.debugShowHotspots = next;
      this.renderDebugOverlay();
      this.renderDebugPanel();
    });
    panel.addChild(ovBtn);

    const footNote = new Text({
      text: `Línea verde en pies = anclados (0px). Escala aliada: x${this.playerSprite?.scale.x}, enemiga: x${this.opponentSprite?.scale.x}`,
      resolution: textRes,
      style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 8, fill: '#cbd5e1' }),
    });
    footNote.roundPixels = true;
    footNote.position.set(12, 434);
    panel.addChild(footNote);

    const asymNote = new Text({
      text:
        this.playerFlipX || this.opponentFlipX
          ? '⚠ mirrorSafe: false -> El brazo del guantelete cambia de lado al espejar'
          : '✓ mirrorSafe: sin flipX activo',
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 8,
        fill: this.playerFlipX || this.opponentFlipX ? '#facc15' : '#4ade80',
      }),
    });
    asymNote.roundPixels = true;
    asymNote.position.set(12, 450);
    panel.addChild(asymNote);

    this.debugPanelContainer.addChild(panel);
  }

  private async playEntranceTransition(): Promise<void> {
    await GlobalVFXSystem.screenFlash(0xffffff, 200);
  }

  /**
   * Bloque 39 Req 1, 2, 3, 4 & 5:
   * - Los pies y todo lo que está debajo de waist permanecen inmóviles en la plataforma (0 px de desplazamiento).
   * - Solo se deforma la malla entre waist y neck (pecho se infla) y la cabeza sube como bloque rígido,
   *   más el rebote secundario amortiguado en la zona bust.
   * - Si la vista carece de datos de "idle" (fallback), se aplica el desplazamiento entero de 1 px.
   */
  public update(dt: number): void {
    this.animTimer += dt;

    // FPS & Buffer updates counter
    this.fpsFrames++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      if (this.debugVisible && this.fpsText && !this.fpsText.destroyed) {
        this.fpsText.text = `FPS:${this.currentFps}`;
      }
      if (this.debugVisible && this.bufUpdatesText && !this.bufUpdatesText.destroyed) {
        const totalBufUpd =
          (this.playerSprite?.getBufferUpdatesPerSec() || 0) + (this.opponentSprite?.getBufferUpdatesPerSec() || 0);
        const anyFeetMoved = Boolean(this.playerSprite?.feetMovedWarning || this.opponentSprite?.feetMovedWarning);
        const anyNonInt = Boolean(this.playerSprite?.hasNonIntegerWarning || this.opponentSprite?.hasNonIntegerWarning);
        this.bufUpdatesText.text = `BufUpd/s: ${totalBufUpd} | Pies: ${
          anyFeetMoved ? '⚠ MOVIDO' : '✓ FIJOS (0px)'
        } | Int: ${anyNonInt ? '⚠ FLOAT' : '✓ ENTERO'}`;
      }
    }

    GlobalVFXSystem.update(dt);
    if (this.engine?.weather) {
      GlobalVFXSystem.updateWeatherVFX(dt, this.engine.weather.type);
    }

    if (this.engine) {
      const pl = this.engine.getPlayerActive();
      if (pl && this.playerSprite && this.playerSprite.visible) {
        const legsBroken = pl.partHP && pl.partHP.legs <= 0;
        const armsBroken = pl.partHP && pl.partHP.arms <= 0;

        this.playerSprite.rotation = legsBroken ? -0.12 : 0;
        this.playerSprite.update(dt);

        if (!this.isActionAnimating) {
          const fallbackY = this.playerSprite.currentFallbackOffsetY;
          this.playerSprite.position.x = Math.round(this.playerBaseX);
          this.playerSprite.position.y = Math.round(this.playerBaseY + (legsBroken ? 6 : 0) + fallbackY);
        }

        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const sparkPart = armsBroken ? 'arms' : 'legs';
          const sparkOrigin = this.getPartHotspotWorldPos('player', sparkPart);
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = Math.round(sparkOrigin.x + (Math.random() - 0.5) * 18);
            p.y = Math.round(sparkOrigin.y + (Math.random() - 0.5) * 18);
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = -1 - Math.random() * 2;
            p.life = 0;
            p.maxLife = 0.4;
            p.alpha = 0.8;
            p.graphic.clear();
            p.graphic.circle(0, 0, 2 + Math.random() * 2);
            p.graphic.fill({ color: 0x38bdf8 });
          }
        }
      }

      const op = this.engine.getOpponentActive();
      if (op && this.opponentSprite && this.opponentSprite.visible) {
        const legsBroken = op.partHP && op.partHP.legs <= 0;
        const armsBroken = op.partHP && op.partHP.arms <= 0;

        this.opponentSprite.rotation = legsBroken ? 0.12 : 0;
        this.opponentSprite.update(dt);

        if (!this.isActionAnimating) {
          const fallbackY = this.opponentSprite.currentFallbackOffsetY;
          this.opponentSprite.position.x = Math.round(this.opponentBaseX);
          this.opponentSprite.position.y = Math.round(this.opponentBaseY + (legsBroken ? 6 : 0) + fallbackY);
        }

        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const sparkPart = armsBroken ? 'arms' : 'legs';
          const sparkOrigin = this.getPartHotspotWorldPos('opponent', sparkPart);
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = Math.round(sparkOrigin.x + (Math.random() - 0.5) * 18);
            p.y = Math.round(sparkOrigin.y + (Math.random() - 0.5) * 18);
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = -1 - Math.random() * 2;
            p.life = 0;
            p.maxLife = 0.4;
            p.alpha = 0.8;
            p.graphic.clear();
            p.graphic.circle(0, 0, 2 + Math.random() * 2);
            p.graphic.fill({ color: 0xc084fc });
          }
        }
      }

      if (this.debugVisible && this.debugShowHotspots) {
        this.renderDebugOverlay();
      }
    }

    if (this.currentMenuState === 'main') {
      if (GlobalInput.justPressed('CONFIRM')) {
        GlobalAudioService.playSfx('confirm');
        this.openFightMenu();
      }
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
