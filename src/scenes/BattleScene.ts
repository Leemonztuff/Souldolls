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
import { SoulDollSpriteFactory, SpriteView } from '../render/procedural/SoulDollSpriteFactory';
import { GlobalEvolutionSystem } from '../systems/evolution/EvolutionSystem';
import { CreatureInstance } from '../types';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { BodyPart } from '../types/bodies';
import { GlobalTheme } from '../data/theme/ThemeManager';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';
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

  // Sprites, Platforms & Elliptical Shadows
  private playerPlatform!: Graphics;
  private opponentPlatform!: Graphics;
  private playerShadow!: Graphics;
  private opponentShadow!: Graphics;
  private playerSprite!: Sprite;
  private opponentSprite!: Sprite;

  // Base scales & coordinates for integer pixel placement
  private playerBaseScale = 2;
  private opponentBaseScale = 2;
  private playerSignX = 1;
  private opponentSignX = -1;
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

  // Debug State (Bloque 37 Req 7)
  private debugVisible = false;
  private debugFlipOverride = false;
  private debugIntegerScale = true;
  private debugShowBoundingBoxes = true;
  private debugShowAnchorsAndGrid = true;
  private debugNativeSize = false;

  public async enter(params?: BattleSceneParams): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    this.container.roundPixels = true;
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
      bg.fill({ color: 0x064e3b }); // Deep emerald forest
    } else if (this.biome === 'cueva') {
      bg.fill({ color: 0x1e1b4b }); // Dark cave indigo
    } else if (this.biome === 'interior') {
      bg.fill({ color: 0x1e293b }); // Modern arena slate
    } else {
      bg.fill({ color: 0x0f172a }); // Lush Pasto night/day sky
    }
    this.bgContainer.addChild(bg);

    // Subtle horizon gradient line
    const horizonY = Math.round(height * 0.42);
    const horizon = new Graphics();
    horizon.rect(0, horizonY, width, height - horizonY);
    horizon.fill({ color: 0x0284c7, alpha: 0.14 });
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

    // 4. Create Sprites with anchor (0.5, 1.0) at the feet on the exact center of their elliptical platform
    this.opponentSprite = new Sprite();
    this.opponentSprite.anchor.set(0.5, 1.0);
    this.opponentSprite.roundPixels = true;
    this.fieldContainer.addChild(this.opponentSprite);

    this.playerSprite = new Sprite();
    this.playerSprite.anchor.set(0.5, 1.0);
    this.playerSprite.roundPixels = true;
    this.fieldContainer.addChild(this.playerSprite);

    this.applyCreatureSpritesAndScales();
  }

  /**
   * Req 1, 2, 3, 4 & 7:
   * - Orientación desde battle.json (ally: "side_r" mirando a la derecha; enemy: "side_r" con flip horizontal mirando a la izquierda).
   * - Escala UNIFORME y ENTERA respecto al tamaño nativo del frame (Math.max(1, Math.floor(targetHeight / nativeHeight))).
   * - Pies en el centro de su plataforma elíptica en coordenadas enteras.
   * - Validación en consola si escala no es entera o si la textura tiene fondo opaco.
   */
  private applyCreatureSpritesAndScales(): void {
    const { enemyPlatform, allyPlatform, allyTargetHeight, enemyTargetHeight } = this.layout;
    const roleViews = (battleConfigRaw as any).roleViews || { ally: 'side_r', enemy: 'side_r' };
    const battleFacing = (battleConfigRaw as any).battleFacing || { ally: 'right', enemy: 'left' };

    const plCreature = this.engine.getPlayerActive();
    const opCreature = this.engine.getOpponentActive();

    // --- ALLY (Abajo-Izquierda, mira a la DERECHA) ---
    const allyView = (roleViews.ally || 'side_r') as SpriteView;
    const plTex = GlobalAssetRegistry.getCreatureSpritePixi(plCreature.speciesId, allyView);
    this.playerSprite.texture = plTex;
    this.playerSprite.anchor.set(0.5, 1.0);

    const plNativeH = Math.max(1, plTex.height || 160);
    let plScale = this.debugNativeSize
      ? 1
      : this.debugIntegerScale
      ? Math.max(1, Math.floor(allyTargetHeight / plNativeH))
      : Number((allyTargetHeight / plNativeH).toFixed(2));

    this.playerBaseScale = plScale;
    const allyWantRight = battleFacing.ally !== 'left';
    this.playerSignX = (allyWantRight ? 1 : -1) * (this.debugFlipOverride ? -1 : 1);

    this.playerSprite.scale.set(this.playerSignX * plScale, plScale);
    this.playerBaseX = Math.round(allyPlatform.cx);
    this.playerBaseY = Math.round(allyPlatform.cy);
    this.playerSprite.position.set(this.playerBaseX, this.playerBaseY);

    // --- ENEMY (Arriba-Derecha, mira a la IZQUIERDA) ---
    let enemyView = (roleViews.enemy || 'side_r') as SpriteView;
    const enemyWantLeft = battleFacing.enemy === 'left';

    // Req 1: "Enemiga (arriba-derecha): la misma vista side_r con flip horizontal (scale.x negativo), mira a la IZQUIERDA.
    // Si el atlas define side_l real, úsalo en lugar del flip."
    let useEnemyFlip = enemyWantLeft;
    if (enemyView === 'side_l' && GlobalAssetRegistry.hasRealCreatureView(opCreature.speciesId, 'side_l')) {
      useEnemyFlip = false;
    } else if (enemyView === 'side_l') {
      enemyView = 'side_r';
      useEnemyFlip = true;
    }

    const opTex = GlobalAssetRegistry.getCreatureSpritePixi(opCreature.speciesId, enemyView);
    this.opponentSprite.texture = opTex;
    this.opponentSprite.anchor.set(0.5, 1.0);

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
    this.opponentSignX = (useEnemyFlip ? -1 : 1) * (this.debugFlipOverride ? -1 : 1);

    this.opponentSprite.scale.set(this.opponentSignX * opScale, opScale);
    this.opponentBaseX = Math.round(enemyPlatform.cx);
    this.opponentBaseY = Math.round(enemyPlatform.cy);
    this.opponentSprite.position.set(this.opponentBaseX, this.opponentBaseY);

    // Req 7: Validación en consola de escala entera y transparencia de esquinas
    this.validateSpriteCompliance('Aliada', this.playerSprite, plCreature.speciesId, allyView);
    this.validateSpriteCompliance('Enemiga', this.opponentSprite, opCreature.speciesId, enemyView);
  }

  private validateSpriteCompliance(roleLabel: string, sprite: Sprite, speciesId: string, view: SpriteView): void {
    const absScaleX = Math.abs(sprite.scale.x);
    const absScaleY = Math.abs(sprite.scale.y);

    if (!Number.isInteger(absScaleX) || !Number.isInteger(absScaleY) || absScaleX !== absScaleY) {
      console.warn(
        `⚠️ [BattleScene Debug] Sprite '${roleLabel}' (${speciesId}) se está renderizando con escala NO entera o no uniforme: scale=(${sprite.scale.x}, ${sprite.scale.y})`
      );
    }

    const set = GlobalAssetRegistry.getCreatureSpriteSet(speciesId);
    const canvas = set ? (set as any)[view] || set.side_r || set.front : null;
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
    const opCard = new Container();
    opCard.roundPixels = true;
    opCard.position.set(Math.round(enemyHud.x), Math.round(enemyHud.y));

    const opBg = new Graphics();
    opBg.roundRect(0, 0, enemyHud.w, enemyHud.h, 8);
    opBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    opBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    opBg.roundRect(3, 3, enemyHud.w - 6, enemyHud.h - 6, 6);
    opBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.35 });
    opCard.addChild(opBg);

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
    opTrack.fill({ color: COLOR_NUM.smokedWood });
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
    const plCard = new Container();
    plCard.roundPixels = true;
    plCard.position.set(Math.round(allyHud.x), Math.round(allyHud.y));

    const plBg = new Graphics();
    plBg.roundRect(0, 0, allyHud.w, allyHud.h, 8);
    plBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    plBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    plBg.roundRect(3, 3, allyHud.w - 6, allyHud.h - 6, 6);
    plBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.35 });
    plCard.addChild(plBg);

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
    plTrack.fill({ color: COLOR_NUM.smokedWood });
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
  }

  private buildUIMenu(): void {
    this.uiMenuContainer = new Container();
    this.uiMenuContainer.zIndex = 900;
    this.uiMenuContainer.roundPixels = true;
    this.container.addChild(this.uiMenuContainer);

    const { narratorBox } = this.layout;
    const textRes = this.getTextRes();

    // Narrator Box (pixel-aligned, fontSize 16px multiple of 8)
    this.narratorBox = new Container();
    this.narratorBox.roundPixels = true;
    this.narratorBox.position.set(Math.round(narratorBox.x), Math.round(narratorBox.y));

    const narrBg = new Graphics();
    narrBg.roundRect(0, 0, narratorBox.w, narratorBox.h, 8);
    narrBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    narrBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    narrBg.roundRect(3, 3, narratorBox.w - 6, narratorBox.h - 6, 6);
    narrBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.35 });
    this.narratorBox.addChild(narrBg);

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
    const textRes = this.getTextRes();

    const menuContainer = new Container();
    menuContainer.roundPixels = true;
    menuContainer.position.set(Math.round(menuBox.x), Math.round(menuBox.y));

    // Req 5: Botones LUCHAR, MOCHILA, EQUIPO y HUIR nítidos, completos, sin distorsión ni letterSpacing fraccionario
    const items = [
      { label: 'LUCHAR', action: () => this.openFightMenu(), isGold: true },
      { label: 'MOCHILA', action: () => this.openBagMenu(), isGold: false },
      { label: 'EQUIPO', action: () => this.openPartyMenu(), isGold: false },
      { label: 'HUIR', action: () => this.handleFleeAction(), isGold: false },
    ];

    const gapX = 10;
    const gapY = 10;
    const btnW = Math.floor((menuBox.w - gapX) / 2);
    const btnH = Math.floor((menuBox.h - gapY) / 2);

    this.menuItemsContainers = [];
    items.forEach((item, idx) => {
      const btn = new Container();
      btn.roundPixels = true;
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      btn.position.set(Math.round(col * (btnW + gapX)), Math.round(row * (btnH + gapY)));
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, btnW, btnH, 8);
      bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.96 });
      bg.stroke({ color: item.isGold ? COLOR_NUM.gold : COLOR_NUM.bronze, width: 2 });
      bg.roundRect(2, 2, btnW - 4, btnH - 4, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.25 });
      btn.addChild(bg);

      const txt = new Text({
        text: item.label,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: item.isGold ? COLOR_HEX.gold : COLOR_HEX.parchment,
        }),
      });
      txt.roundPixels = true;
      txt.anchor.set(0.5);
      txt.position.set(Math.round(btnW / 2), Math.round(btnH / 2));
      btn.addChild(txt);

      btn.on('pointerdown', () => {
        GlobalAudioService.playSfx('confirm');
        item.action();
      });

      menuContainer.addChild(btn);
      this.menuItemsContainers.push(btn);
    });

    this.uiMenuContainer.addChild(menuContainer);
    this.showNarratorMessage('¿Qué debería hacer tu Souldoll?');
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
    const textRes = this.getTextRes();
    const backBtn = new Container();
    backBtn.roundPixels = true;
    backBtn.position.set(Math.round(menuWidth - 116), -44);
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';

    const backBg = new Graphics();
    backBg.roundRect(0, 0, 116, 36, 6);
    backBg.fill({ color: COLOR_NUM.bronze });
    backBg.stroke({ color: COLOR_NUM.gold, width: 2 });
    backBtn.addChild(backBg);

    const backTxt = new Text({
      text: 'ATRÁS',
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    backTxt.roundPixels = true;
    backTxt.anchor.set(0.5);
    backTxt.position.set(58, 18);
    backBtn.addChild(backTxt);

    backBtn.on('pointerdown', () => {
      GlobalAudioService.playSfx('cancel');
      this.openMainMenu();
    });

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

  // --- ANIMATIONS & VISUAL UPDATES ---

  public getSpritePosition(side: BattleSide): { x: number; y: number } {
    return side === 'player'
      ? { x: this.playerBaseX, y: Math.round(this.playerBaseY - 60) }
      : { x: this.opponentBaseX, y: Math.round(this.opponentBaseY - 60) };
  }

  public async animateAttackerLunge(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    const origX = Math.round(sprite.position.x);
    const origY = Math.round(sprite.position.y);
    const targetDx = side === 'player' ? 32 : -32;
    const targetDy = side === 'player' ? -20 : 20;

    sprite.position.set(Math.round(origX + targetDx), Math.round(origY + targetDy));
    await this.sleep(120);
    sprite.position.set(origX, origY);
  }

  public async animateDefenderHitBlink(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    for (let i = 0; i < 4; i++) {
      sprite.visible = !sprite.visible;
      await this.sleep(60);
    }
    sprite.visible = true;
  }

  public async animateFaint(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
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
  }

  public async animateSwitchIn(side: BattleSide, _creatureName: string, hp: number, maxHp: number): Promise<void> {
    const creature = side === 'player' ? this.engine.getPlayerActive() : this.engine.getOpponentActive();
    this.applyCreatureSpritesAndScales();

    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
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

    let color = 0x64748b;
    if (status === 'burn') color = 0xe11d48;
    if (status === 'paralysis') color = 0xd97706;
    if (status === 'poison') color = 0x7e22ce;
    if (status === 'sleep') color = 0x0284c7;

    bg.fill({ color });
    badgeContainer.addChild(bg);

    const txt = new Text({
      text: status.slice(0, 3).toUpperCase(),
      resolution: this.getTextRes(),
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#ffffff',
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

    const drawSpriteDebug = (sprite: Sprite, baseScale: number, boxColor: number) => {
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
        g.stroke({ color: 0xffffff, width: 1, alpha: 0.14 });
      }

      // 2. Bounding Box
      if (this.debugShowBoundingBoxes) {
        g.rect(left, top, w, h);
        g.stroke({ color: boxColor, width: 2, alpha: 0.9 });
      }

      // 3. Anchor point (0.5, 1.0) at the feet
      if (this.debugShowAnchorsAndGrid) {
        g.moveTo(ax - 12, ay);
        g.lineTo(ax + 12, ay);
        g.moveTo(ax, ay - 12);
        g.lineTo(ax, ay + 12);
        g.stroke({ color: 0xfacc15, width: 2 });
        g.circle(ax, ay, 4);
        g.fill({ color: 0xef4444 });
      }
    };

    drawSpriteDebug(this.playerSprite, this.playerBaseScale, 0x38bdf8);
    drawSpriteDebug(this.opponentSprite, this.opponentBaseScale, 0xf43f5e);

    this.debugOverlayContainer.addChild(g);
  }

  private renderDebugPanel(): void {
    this.debugPanelContainer.removeChildren();
    if (!this.debugVisible) return;

    const textRes = this.getTextRes();
    const panelW = Math.min(340, this.layout.width - 16);
    const panelH = 236;
    const panelX = Math.round(this.layout.width - panelW - 8);
    const panelY = 8;

    const panel = new Container();
    panel.roundPixels = true;
    panel.position.set(panelX, panelY);

    const bg = new Graphics();
    bg.roundRect(0, 0, panelW, panelH, 8);
    bg.fill({ color: 0x090d16, alpha: 0.92 });
    bg.stroke({ color: 0x38bdf8, width: 2 });
    panel.addChild(bg);

    const title = new Text({
      text: 'DEBUG COMBATE (F2)',
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
      text: `FPS: ${this.currentFps}`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#10b981',
      }),
    });
    this.fpsText.roundPixels = true;
    this.fpsText.position.set(panelW - 92, 8);
    panel.addChild(this.fpsText);

    const plW = this.playerSprite?.texture?.width || 0;
    const plH = this.playerSprite?.texture?.height || 0;
    const opW = this.opponentSprite?.texture?.width || 0;
    const opH = this.opponentSprite?.texture?.height || 0;

    const metricsTxt = new Text({
      text: `Aliada: ${plW}x${plH}px (x${this.playerSprite?.scale.x}) | Enemiga: ${opW}x${opH}px (x${this.opponentSprite?.scale.x})`,
      resolution: textRes,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 8,
        fill: '#cbd5e1',
      }),
    });
    metricsTxt.roundPixels = true;
    metricsTxt.position.set(12, 30);
    panel.addChild(metricsTxt);

    const toggles = [
      {
        label: `1. Orientación Flip: ${this.debugFlipOverride ? 'INVERTIDO' : 'NORMAL'}`,
        active: this.debugFlipOverride,
        onClick: () => {
          this.debugFlipOverride = !this.debugFlipOverride;
          this.applyCreatureSpritesAndScales();
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
      {
        label: `2. Escala Entera: ${this.debugIntegerScale ? 'ON (Floor)' : 'OFF (Float)'}`,
        active: this.debugIntegerScale,
        onClick: () => {
          this.debugIntegerScale = !this.debugIntegerScale;
          this.applyCreatureSpritesAndScales();
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
      {
        label: `3. Bounding Boxes: ${this.debugShowBoundingBoxes ? 'ON' : 'OFF'}`,
        active: this.debugShowBoundingBoxes,
        onClick: () => {
          this.debugShowBoundingBoxes = !this.debugShowBoundingBoxes;
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
      {
        label: `4. Anclas y Grid Píxel: ${this.debugShowAnchorsAndGrid ? 'ON' : 'OFF'}`,
        active: this.debugShowAnchorsAndGrid,
        onClick: () => {
          this.debugShowAnchorsAndGrid = !this.debugShowAnchorsAndGrid;
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
      {
        label: `5. Tamaño: ${this.debugNativeSize ? 'NATIVO (1x)' : 'ESCALADO'}`,
        active: this.debugNativeSize,
        onClick: () => {
          this.debugNativeSize = !this.debugNativeSize;
          this.applyCreatureSpritesAndScales();
          this.renderDebugOverlay();
          this.renderDebugPanel();
        },
      },
    ];

    toggles.forEach((t, idx) => {
      const btn = new Container();
      btn.roundPixels = true;
      btn.position.set(12, 46 + idx * 36);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bBg = new Graphics();
      bBg.roundRect(0, 0, panelW - 24, 30, 6);
      bBg.fill({ color: t.active ? 0x0284c7 : 0x1e293b });
      bBg.stroke({ color: t.active ? 0xffffff : 0x475569, width: 1.5 });
      btn.addChild(bBg);

      const bTxt = new Text({
        text: t.label,
        resolution: textRes,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#ffffff',
        }),
      });
      bTxt.roundPixels = true;
      bTxt.position.set(10, 6);
      btn.addChild(bTxt);

      btn.on('pointerdown', () => {
        GlobalAudioService.playSfx('select');
        t.onClick();
      });

      panel.addChild(btn);
    });

    this.debugPanelContainer.addChild(panel);
  }

  private async playEntranceTransition(): Promise<void> {
    await GlobalVFXSystem.screenFlash(0xffffff, 200);
  }

  /**
   * Req 4: Posiciones y escalas de sprites en píxeles enteros (Math.round) para evitar
   * parpadeo y bordes irregulares durante animaciones (idle de respiración con desplazamientos de 1 px enteros).
   */
  public update(dt: number): void {
    this.animTimer += dt;

    // FPS Counter update
    this.fpsFrames++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      if (this.debugVisible && this.fpsText && !this.fpsText.destroyed) {
        this.fpsText.text = `FPS: ${this.currentFps}`;
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

        // Idle de respiración con desplazamiento entero de 1 px (sin sub-píxeles)
        const breathOffsetPx = Math.round(Math.sin(this.animTimer * 2.5));
        this.playerSprite.position.x = Math.round(this.playerBaseX);
        this.playerSprite.position.y = Math.round(this.playerBaseY + (legsBroken ? 6 : 0) + breathOffsetPx);

        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = Math.round(this.playerBaseX + (Math.random() - 0.5) * 40);
            p.y = Math.round(this.playerBaseY - 40 + (Math.random() - 0.5) * 40);
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

        // Idle de respiración con desplazamiento entero de 1 px (sin sub-píxeles)
        const breathOffsetPx = Math.round(Math.sin(this.animTimer * 2.5 + 1.2));
        this.opponentSprite.position.x = Math.round(this.opponentBaseX);
        this.opponentSprite.position.y = Math.round(this.opponentBaseY + (legsBroken ? 6 : 0) + breathOffsetPx);

        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = Math.round(this.opponentBaseX + (Math.random() - 0.5) * 40);
            p.y = Math.round(this.opponentBaseY - 40 + (Math.random() - 0.5) * 40);
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
