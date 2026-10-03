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
import { GlobalEvolutionSystem } from '../systems/evolution/EvolutionSystem';
import { CreatureInstance } from '../types';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { BodyPart } from '../types/bodies';
import { GlobalTheme } from '../data/theme/ThemeManager';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';

export type BiomeType = 'pasto' | 'bosque' | 'cueva' | 'interior';

export interface BattleSceneParams extends BattleEngineConfig {
  biome?: BiomeType;
  onBattleEnd?: (victory: boolean, capturedCreature?: CreatureInstance) => void;
}

export class BattleScene implements IScene {
  public name = 'Battle';

  private container: Container = new Container();
  private bgContainer: Container = new Container();
  private fieldContainer: Container = new Container();
  private hudContainer: Container = new Container();
  private uiMenuContainer: Container = new Container();

  private engine!: BattleEngine;
  private player!: BattlePlayer;
  private biome: BiomeType = 'pasto';

  // Sprites & Platforms
  private playerPlatform!: Graphics;
  private opponentPlatform!: Graphics;
  private playerSprite!: Sprite;
  private opponentSprite!: Sprite;

  // Idle Animation Timers
  private animTimer = 0;

  // HUD Elements
  private playerHpBarFill!: Graphics;
  private playerHpText!: Text;
  private playerExpBarFill!: Graphics;
  private playerLevelText!: Text;
  private playerStatusBadge!: Container;
  private playerSilhouette!: HumanoidPartSilhouette;

  private opponentHpBarFill!: Graphics;
  private opponentHpText!: Text;
  private opponentLevelText!: Text;
  private opponentStatusBadge!: Container;
  private opponentSilhouette!: HumanoidPartSilhouette;

  // Narrator Box
  private narratorBox!: Container;
  private narratorText!: Text;

  // State
  private currentMenuState: 'main' | 'fight' | 'bag' | 'party' | 'busy' = 'main';
  private selectedIndex = 0;
  private menuItemsContainers: Container[] = [];
  private onBattleEndCallback?: (victory: boolean, capturedCreature?: CreatureInstance) => void;

  public async enter(params?: BattleSceneParams): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.biome = params?.biome || 'pasto';
    this.onBattleEndCallback = params?.onBattleEnd;

    // 1. Initialize Battle Engine
    if (!params || !params.playerParty || !params.opponentParty) {
      throw new Error('[BattleScene] Missing battle engine parameters!');
    }

    this.engine = new BattleEngine(params);
    this.player = new BattlePlayer(this);

    // 2. Build Layers
    this.buildBackground();
    this.buildFieldPlatforms();
    this.buildHUD();
    this.buildUIMenu();

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

  private buildBackground(): void {
    this.bgContainer = new Container();
    this.container.addChild(this.bgContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

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
    const horizon = new Graphics();
    horizon.rect(0, height * 0.45, width, height * 0.55);
    horizon.fill({ color: 0x0284c7, alpha: 0.15 });
    this.bgContainer.addChild(horizon);
  }

  private buildFieldPlatforms(): void {
    this.fieldContainer = new Container();
    this.container.addChild(this.fieldContainer);

    // Opponent Platform (Upper-Right)
    this.opponentPlatform = new Graphics();
    this.opponentPlatform.ellipse(680, 240, 180, 50);
    this.opponentPlatform.fill({ color: this.getPlatformColor(), alpha: 0.85 });
    this.opponentPlatform.stroke({ color: GlobalTheme.bronzeNum, width: 3 });
    this.fieldContainer.addChild(this.opponentPlatform);

    // Player Platform (Lower-Left)
    this.playerPlatform = new Graphics();
    this.playerPlatform.ellipse(260, 420, 220, 60);
    this.playerPlatform.fill({ color: this.getPlatformColor(), alpha: 0.85 });
    this.playerPlatform.stroke({ color: GlobalTheme.bronzeNum, width: 3 });
    this.fieldContainer.addChild(this.playerPlatform);

    // Opponent Creature Sprite
    const opCreature = this.engine.getOpponentActive();
    const opTex = GlobalAssetRegistry.getCreatureSpritePixi(opCreature.speciesId, 'front');
    this.opponentSprite = new Sprite(opTex);
    this.opponentSprite.anchor.set(0.5, 1.0);
    this.opponentSprite.scale.set(3.2);
    this.opponentSprite.position.set(680, 250);
    this.fieldContainer.addChild(this.opponentSprite);

    // Player Creature Sprite
    const plCreature = this.engine.getPlayerActive();
    const plTex = GlobalAssetRegistry.getCreatureSpritePixi(plCreature.speciesId, 'back');
    this.playerSprite = new Sprite(plTex);
    this.playerSprite.anchor.set(0.5, 1.0);
    this.playerSprite.scale.set(3.8);
    this.playerSprite.position.set(260, 430);
    this.fieldContainer.addChild(this.playerSprite);
  }

  private getPlatformColor(): number {
    if (this.biome === 'bosque') return COLOR_NUM.smokedWood;
    if (this.biome === 'cueva') return COLOR_NUM.inkCrypt;
    if (this.biome === 'interior') return COLOR_NUM.bronze;
    return COLOR_NUM.smokedWood; // Pasto
  }

  private buildHUD(): void {
    this.hudContainer = new Container();
    this.container.addChild(this.hudContainer);

    const width = GlobalPixiRenderer.width;

    // 1. Opponent HUD Card (Top-Left)
    const opCard = new Container();
    opCard.position.set(30, 30);

    const opBg = new Graphics();
    opBg.roundRect(0, 0, 360, 90, 10);
    opBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    opBg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    opCard.addChild(opBg);

    // Inner gold pinstripe for elegant look
    opBg.roundRect(3, 3, 354, 84, 8);
    opBg.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.4 });

    const opCreature = this.engine.getOpponentActive();
    const opNameTxt = new Text({
      text: opCreature.nickname || opCreature.speciesId.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 15,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 1,
      }),
    });
    opNameTxt.position.set(16, 12);
    opCard.addChild(opNameTxt);

    this.opponentLevelText = new Text({
      text: `Nv. ${opCreature.level}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.opponentLevelText.position.set(260, 14);
    opCard.addChild(this.opponentLevelText);

    // Opponent HP Track & Fill
    const opTrack = new Graphics();
    opTrack.roundRect(16, 48, 328, 18, 6);
    opTrack.fill({ color: COLOR_NUM.smokedWood });
    opCard.addChild(opTrack);

    this.opponentHpBarFill = new Graphics();
    opCard.addChild(this.opponentHpBarFill);

    this.opponentHpText = new Text({
      text: `${opCreature.currentHp} / ${opCreature.maxHp}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 11,
        fontWeight: 'bold',
        fill: COLOR_HEX.smoke,
      }),
    });
    this.opponentHpText.anchor.set(1, 0);
    this.opponentHpText.position.set(344, 70);
    opCard.addChild(this.opponentHpText);

    this.opponentStatusBadge = new Container();
    this.opponentStatusBadge.position.set(180, 12);
    opCard.addChild(this.opponentStatusBadge);

    // Opponent Mini Part Silhouette
    this.opponentSilhouette = new HumanoidPartSilhouette();
    this.opponentSilhouette.position.set(310, 8);
    this.opponentSilhouette.scale.set(0.75);
    opCard.addChild(this.opponentSilhouette);

    this.hudContainer.addChild(opCard);

    // 2. Player HUD Card (Bottom-Right)
    const plCard = new Container();
    plCard.position.set(width - 400, 290);

    const plBg = new Graphics();
    plBg.roundRect(0, 0, 370, 120, 10);
    plBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    plBg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    plCard.addChild(plBg);

    // Inner gold pinstripe for elegant look
    plBg.roundRect(3, 3, 364, 114, 8);
    plBg.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.4 });

    const plCreature = this.engine.getPlayerActive();
    const plNameTxt = new Text({
      text: plCreature.nickname || plCreature.speciesId.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 15,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 1,
      }),
    });
    plNameTxt.position.set(16, 12);
    plCard.addChild(plNameTxt);

    this.playerLevelText = new Text({
      text: `Nv. ${plCreature.level}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.playerLevelText.position.set(270, 14);
    plCard.addChild(this.playerLevelText);

    // Player HP Track & Fill
    const plTrack = new Graphics();
    plTrack.roundRect(16, 48, 338, 20, 6);
    plTrack.fill({ color: COLOR_NUM.smokedWood });
    plCard.addChild(plTrack);

    this.playerHpBarFill = new Graphics();
    plCard.addChild(this.playerHpBarFill);

    this.playerHpText = new Text({
      text: `${plCreature.currentHp} / ${plCreature.maxHp}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.playerHpText.anchor.set(1, 0);
    this.playerHpText.position.set(354, 72);
    plCard.addChild(this.playerHpText);

    // Player EXP Bar
    const expTrack = new Graphics();
    expTrack.roundRect(16, 96, 338, 8, 4);
    expTrack.fill({ color: COLOR_NUM.inkCrypt });
    plCard.addChild(expTrack);

    this.playerExpBarFill = new Graphics();
    plCard.addChild(this.playerExpBarFill);

    this.playerStatusBadge = new Container();
    this.playerStatusBadge.position.set(200, 12);
    plCard.addChild(this.playerStatusBadge);

    // Player Mini Part Silhouette
    this.playerSilhouette = new HumanoidPartSilhouette();
    this.playerSilhouette.position.set(320, 8);
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
    this.container.addChild(this.uiMenuContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Narrator Box (Bottom full width)
    this.narratorBox = new Container();
    this.narratorBox.position.set(20, height - 260);

    const narrBg = new Graphics();
    narrBg.roundRect(0, 0, width - 40, 70, 10);
    narrBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    narrBg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    this.narratorBox.addChild(narrBg);

    // Inner gold hairline border
    narrBg.roundRect(3, 3, width - 46, 64, 8);
    narrBg.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.35 });

    this.narratorText = new Text({
      text: '¿Qué debería hacer tu Souldoll?',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: width - 80,
      }),
    });
    this.narratorText.position.set(20, 22);
    this.narratorBox.addChild(this.narratorText);

    this.uiMenuContainer.addChild(this.narratorBox);
  }

  public openMainMenu(): void {
    this.currentMenuState = 'main';
    this.selectedIndex = 0;
    this.clearSubmenus();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const menuBox = new Container();
    menuBox.position.set(20, height - 175);

    const items = [
      { label: '⚔️ LUCHAR', action: () => this.openFightMenu(), isGold: true },
      { label: '🎒 MOCHILA', action: () => this.openBagMenu(), isGold: false },
      { label: '🔄 EQUIPO', action: () => this.openPartyMenu(), isGold: false },
      { label: '🏃 HUIR', action: () => this.handleFleeAction(), isGold: false },
    ];

    this.menuItemsContainers = [];
    items.forEach((item, idx) => {
      const btn = new Container();
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      btn.position.set(col * 455, row * 78);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 445, 68, 8);
      bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: item.isGold ? COLOR_NUM.gold : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      // Inner ornate corner hairline
      bg.roundRect(2, 2, 441, 64, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.25 });

      const txt = new Text({
        text: item.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: item.isGold ? COLOR_HEX.gold : COLOR_HEX.parchment,
          letterSpacing: 1,
        }),
      });
      txt.anchor.set(0.5);
      txt.position.set(222, 34);
      btn.addChild(txt);

      btn.on('pointerdown', () => {
        GlobalAudioService.playSfx('confirm');
        item.action();
      });

      menuBox.addChild(btn);
      this.menuItemsContainers.push(btn);
    });

    this.uiMenuContainer.addChild(menuBox);
    this.showNarratorMessage('¿Qué debería hacer tu Souldoll?');
  }

  private openFightMenu(): void {
    this.currentMenuState = 'fight';
    this.selectedIndex = 0;
    this.clearSubmenus();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const fightBox = new Container();
    fightBox.position.set(20, height - 180);

    const activeCreature = this.engine.getPlayerActive();
    const opponentCreature = this.engine.getOpponentActive();
    const opponentSpecies = CREATURES_DATA[opponentCreature.speciesId];

    this.menuItemsContainers = [];
    activeCreature.moves.forEach((m, idx) => {
      const moveDef = MOVES_DATA[m.moveId];
      if (!moveDef) return;

      const col = idx % 2;
      const row = Math.floor(idx / 2);

      const btn = new Container();
      btn.position.set(col * 455, row * 82);
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
      let effTag = '1.0x';
      let tagCol = COLOR_NUM.bronze;
      if (typeEff.multiplier >= 2.0) {
        effTag = '2.0x SÚPER';
        tagCol = COLOR_SEMANTIC.ok;
      } else if (typeEff.multiplier < 1.0 && typeEff.multiplier > 0) {
        effTag = '0.5x POCO';
        tagCol = COLOR_SEMANTIC.warning;
      } else if (typeEff.multiplier === 0) {
        effTag = 'INMUNE';
        tagCol = COLOR_SEMANTIC.danger;
      }

      const bg = new Graphics();
      bg.roundRect(0, 0, 445, 74, 8);
      bg.fill({ color: isBlocked ? COLOR_NUM.disabledBg : COLOR_NUM.smokedWood, alpha: isBlocked ? 0.7 : 0.95 });
      bg.stroke({ color: isBlocked ? COLOR_SEMANTIC.danger : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      // Inner gold hairline border inside Move buttons
      bg.roundRect(2, 2, 441, 70, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.2 });

      // Move Title
      const nameTxt = new Text({
        text: moveDef.name.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 14,
          fontWeight: 'bold',
          fill: isBlocked ? COLOR_HEX.disabledText : COLOR_HEX.parchment,
          letterSpacing: 0.5,
        }),
      });
      nameTxt.position.set(16, 12);
      btn.addChild(nameTxt);

      // PP & Target Part info
      const subTxt = new Text({
        text: isBlocked ? '❌ BLOQUEADO (Brazos rotos)' : `PP: ${m.currentPp}/${m.maxPp}  ·  🎯 Obj: ${targetPartLabel}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 11,
          fontWeight: 'bold',
          fill: isBlocked ? COLOR_HEX.disabledText : m.currentPp > 0 ? COLOR_HEX.gold : COLOR_HEX.smoke,
        }),
      });
      subTxt.position.set(16, 44);
      btn.addChild(subTxt);

      // Effectiveness Badge Tag
      const tagG = new Graphics();
      tagG.roundRect(300, 16, 130, 40, 6);
      tagG.fill({ color: isBlocked ? COLOR_NUM.disabledBg : tagCol });
      tagG.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.4 });
      btn.addChild(tagG);

      const tagTxt = new Text({
        text: isBlocked ? 'BLOQUEADO' : effTag,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 11,
          fontWeight: 'bold',
          fill: COLOR_HEX.white,
        }),
      });
      tagTxt.anchor.set(0.5);
      tagTxt.position.set(365, 36);
      btn.addChild(tagTxt);

      btn.on('pointerdown', () => {
        if (isBlocked) {
          GlobalAudioService.playSfx('cancel');
          this.showNarratorMessage(`¡${moveDef.name} requiere armas/brazos intactos! Tus brazos están destruidos.`);
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

    // Back button
    const backBtn = new Container();
    backBtn.position.set(width - 160, -60);
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';

    const backBg = new Graphics();
    backBg.roundRect(0, 0, 130, 44, 6);
    backBg.fill({ color: COLOR_NUM.bronze });
    backBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    backBtn.addChild(backBg);

    // Inner gold hairline border inside back button
    backBg.roundRect(2, 2, 126, 40, 4);
    backBg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.25 });

    const backTxt = new Text({
      text: '↩ ATRÁS',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 1,
      }),
    });
    backTxt.anchor.set(0.5);
    backTxt.position.set(65, 22);
    backBtn.addChild(backTxt);

    backBtn.on('pointerdown', () => {
      GlobalAudioService.playSfx('cancel');
      this.openMainMenu();
    });

    fightBox.addChild(backBtn);
    this.uiMenuContainer.addChild(fightBox);
  }

  private openBagMenu(): void {
    this.currentMenuState = 'bag';
    this.clearSubmenus();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const bagBox = new Container();
    bagBox.position.set(20, height - 180);

    const saveState = GlobalSaveService.getCurrentState();
    const invEntries: Array<{ itemId: string; count: number }> = saveState?.inventory
      ? Object.entries(saveState.inventory).map(([itemId, count]) => ({ itemId, count }))
      : [
          { itemId: 'potion', count: 5 },
          { itemId: 'capsule_basic', count: 5 },
        ];

    this.menuItemsContainers = [];
    invEntries.forEach((item, idx) => {
      const itemDef = ITEMS_DATA[item.itemId];
      if (!itemDef) return;

      const btn = new Container();
      btn.position.set(idx * 455, 0);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 440, 140, 8);
      bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      // Inner gold hairline border
      bg.roundRect(2, 2, 436, 136, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.25 });

      const title = new Text({
        text: `📦 ${itemDef.name.toUpperCase()} (x${item.count})`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 15,
          fontWeight: 'bold',
          fill: COLOR_HEX.gold,
          letterSpacing: 1,
        }),
      });
      title.position.set(16, 16);
      btn.addChild(title);

      const desc = new Text({
        text: itemDef.description,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: COLOR_HEX.parchment,
          wordWrap: true,
          wordWrapWidth: 400,
        }),
      });
      desc.position.set(16, 56);
      btn.addChild(desc);

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

    this.uiMenuContainer.addChild(bagBox);
  }

  private openPartyMenu(): void {
    this.currentMenuState = 'party';
    this.clearSubmenus();

    const height = GlobalPixiRenderer.height;
    const partyBox = new Container();
    partyBox.position.set(20, height - 180);

    this.engine.playerParty.forEach((c, idx) => {
      const btn = new Container();
      btn.position.set(idx * 290, 0);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const isCurrent = idx === this.engine.playerActiveIndex;
      const bg = new Graphics();
      bg.roundRect(0, 0, 275, 140, 8);
      bg.fill({ color: isCurrent ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isCurrent ? COLOR_NUM.white : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      // Inner gold hairline border
      bg.roundRect(2, 2, 271, 136, 6);
      bg.stroke({ color: isCurrent ? COLOR_NUM.inkCrypt : COLOR_NUM.gold, width: 0.5, alpha: isCurrent ? 0.15 : 0.25 });

      const nameTxt = new Text({
        text: `${(c.nickname || c.speciesId).toUpperCase()} (Nv.${c.level})`,
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 12,
          fontWeight: 'bold',
          fill: isCurrent ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
          letterSpacing: 0.5,
        }),
      });
      nameTxt.position.set(14, 14);
      btn.addChild(nameTxt);

      const hpTxt = new Text({
        text: `HP: ${c.currentHp}/${c.maxHp}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 13,
          fontWeight: 'bold',
          fill: isCurrent ? COLOR_HEX.inkCrypt : (c.currentHp > 0 ? COLOR_HEX.gold : COLOR_HEX.smoke),
        }),
      });
      hpTxt.position.set(14, 48);
      btn.addChild(hpTxt);

      btn.on('pointerdown', () => {
        if (isCurrent) {
          this.showNarratorMessage('¡Esta criatura ya está en combate!');
          return;
        }
        if (c.currentHp <= 0) {
          GlobalAudioService.playSfx('cancel');
          this.showNarratorMessage('¡Esta criatura está debilitada y no puede luchar!');
          return;
        }
        GlobalAudioService.playSfx('confirm');
        this.submitPlayerAction({ type: 'switch', targetPartyIndex: idx });
      });

      partyBox.addChild(btn);
    });

    this.uiMenuContainer.addChild(partyBox);
  }

  private handleFleeAction(): void {
    if (this.engine.battleType !== 'wild') {
      this.showNarratorMessage('¡No puedes huir de un combate contra un entrenador!');
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
      await this.showNarratorMessage('¡Te has quedado sin criaturas útiles! Te retiras al Centro de Sanación.');
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
    return side === 'player' ? { x: 260, y: 360 } : { x: 680, y: 190 };
  }

  public async animateAttackerLunge(side: BattleSide): Promise<void> {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    const origX = sprite.position.x;
    const origY = sprite.position.y;
    const targetDx = side === 'player' ? 40 : -40;
    const targetDy = side === 'player' ? -30 : 30;

    sprite.position.set(origX + targetDx, origY + targetDy);
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
      sprite.position.y += 3;
      sprite.alpha = 1 - elapsed / 0.5;
      if (elapsed >= 0.5) {
        clearInterval(interval);
        sprite.visible = false;
      }
    }, 30);
    await this.sleep(550);
  }

  public async animateSwitchIn(side: BattleSide, creatureName: string, hp: number, maxHp: number): Promise<void> {
    const creature = side === 'player' ? this.engine.getPlayerActive() : this.engine.getOpponentActive();
    const tex = GlobalAssetRegistry.getCreatureSpritePixi(creature.speciesId, side === 'player' ? 'back' : 'front');

    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    sprite.texture = tex;
    sprite.visible = true;
    sprite.alpha = 0;
    sprite.position.set(side === 'player' ? 260 : 680, side === 'player' ? 430 : 250);

    await GlobalVFXSystem.screenFlash(0x38bdf8, 150);
    sprite.alpha = 1;

    this.renderHpBar(side, hp, maxHp);
    if (side === 'player') {
      this.updateLevelBadge('player', creature.level);
    } else {
      this.updateLevelBadge('opponent', creature.level);
    }
  }

  public async animateCaptureSequence(shakes: number, success: boolean): Promise<void> {
    const bottle = new Container();
    bottle.position.set(260, 360);
    
    const bottleG = new Graphics();
    bottleG.roundRect(-8, -14, 16, 24, 4);
    bottleG.fill({ color: 0x38bdf8, alpha: 0.9 });
    bottleG.stroke({ color: 0xffffff, width: 2 });
    bottle.addChild(bottleG);
    this.container.addChild(bottle);

    // 1. Arc trajectory throw
    const targetX = 680;
    const targetY = 220;
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = 260 + (targetX - 260) * t;
      const y = 360 + (targetY - 360) * t - Math.sin(t * Math.PI) * 120;
      bottle.position.set(x, y);
      bottle.rotation = t * Math.PI * 4;
      await this.sleep(25);
    }
    bottle.rotation = 0;

    // 2. Translucent Soul Detaches from Body Container
    const opCreature = this.engine.getOpponentActive();
    const soulSprite = new Sprite(this.opponentSprite.texture);
    soulSprite.anchor.set(0.5, 1.0);
    soulSprite.scale.copyFrom(this.opponentSprite.scale);
    soulSprite.position.copyFrom(this.opponentSprite.position);
    soulSprite.alpha = 0.65;
    soulSprite.tint = 0x38bdf8;
    this.container.addChild(soulSprite);

    // Dim the physical chassis body
    this.opponentSprite.alpha = 0.35;

    // Play bottle seal beam VFX
    GlobalVFXSystem.playPresetVfx('bottle_seal', targetX, targetY, targetX, targetY - 40);

    // Translucent soul floats into bottle
    const soulSteps = 12;
    for (let s = 1; s <= soulSteps; s++) {
      const st = s / soulSteps;
      soulSprite.position.set(targetX, 250 - st * 30);
      soulSprite.scale.set(3.2 * (1 - st * 0.5));
      soulSprite.alpha = 0.65 * (1 - st * 0.8);
      await this.sleep(30);
    }
    soulSprite.visible = false;

    await GlobalVFXSystem.screenFlash(0xffffff, 120);

    // 3. Bottle shakes
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
      await this.showNarratorMessage(`¡Alma de ${opCreature.nickname || opCreature.speciesId.toUpperCase()} capturada! Guardada SIN CUERPO en tu Códice.`);
      bottle.destroy();
      soulSprite.destroy();
      this.opponentSprite.visible = false;
    } else {
      await GlobalVFXSystem.screenFlash(0xf43f5e, 150);
      
      // Soul escapes bottle and returns to body container
      soulSprite.visible = true;
      for (let s = soulSteps; s >= 0; s--) {
        const st = s / soulSteps;
        soulSprite.position.set(targetX, 250 - st * 30);
        soulSprite.scale.set(3.2 * (1 - st * 0.5));
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

    const barWidth = side === 'player' ? 338 : 328;
    const barHeight = side === 'player' ? 20 : 18;
    const posX = side === 'player' ? 16 : 16;
    const posY = side === 'player' ? 48 : 48;

    const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
    let color = COLOR_SEMANTIC.ok; // Green
    if (ratio < 0.25) color = COLOR_SEMANTIC.danger; // Red
    else if (ratio < 0.5) color = COLOR_SEMANTIC.warning; // Yellow

    fillG.clear();
    fillG.roundRect(posX, posY, Math.floor(barWidth * ratio), barHeight, 6);
    fillG.fill({ color });

    txt.text = `${currentHp} / ${maxHp}`;
  }

  public async updateHpBarAnimated(side: BattleSide, newHp: number, maxHp: number): Promise<void> {
    this.renderHpBar(side, newHp, maxHp);
    await this.sleep(250);
  }

  public renderExpBar(currentExp: number, maxExp: number): void {
    const ratio = Math.max(0, Math.min(1, currentExp / maxExp));
    this.playerExpBarFill.clear();
    this.playerExpBarFill.roundRect(16, 96, Math.floor(338 * ratio), 8, 4);
    this.playerExpBarFill.fill({ color: COLOR_NUM.soulViolet });
  }

  public async updateExpBarAnimated(currentExp: number, maxExp: number): Promise<void> {
    this.renderExpBar(currentExp, maxExp);
    await this.sleep(300);
  }

  public updateLevelBadge(side: BattleSide, level: number): void {
    const txt = side === 'player' ? this.playerLevelText : this.opponentLevelText;
    txt.text = `Nv. ${level}`;
  }

  public setStatusBadge(side: BattleSide, status: string): void {
    const badgeContainer = side === 'player' ? this.playerStatusBadge : this.opponentStatusBadge;
    badgeContainer.removeChildren();

    if (!status) return;

    const bg = new Graphics();
    bg.roundRect(0, 0, 56, 22, 4);

    let color = 0x64748b;
    if (status === 'burn') color = 0xe11d48;
    if (status === 'paralysis') color = 0xd97706;
    if (status === 'poison') color = 0x7e22ce;
    if (status === 'sleep') color = 0x0284c7;

    bg.fill({ color });
    badgeContainer.addChild(bg);

    const txt = new Text({
      text: status.slice(0, 3).toUpperCase(),
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fontWeight: '900',
        fill: '#ffffff',
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(28, 11);
    badgeContainer.addChild(txt);
  }

  private async playEntranceTransition(): Promise<void> {
    await GlobalVFXSystem.screenFlash(0xffffff, 200);
  }

  public update(dt: number): void {
    this.animTimer += dt;
    GlobalVFXSystem.update(dt);
    if (this.engine?.weather) {
      GlobalVFXSystem.updateWeatherVFX(dt, this.engine.weather.type);
    }

    // Active creatures broken part visual states
    if (this.engine) {
      const pl = this.engine.getPlayerActive();
      if (pl && this.playerSprite && this.playerSprite.visible) {
        const legsBroken = pl.partHP && pl.partHP.legs <= 0;
        const armsBroken = pl.partHP && pl.partHP.arms <= 0;

        // Posture tilt for broken legs
        const targetRot = legsBroken ? -0.15 : 0;
        this.playerSprite.rotation = targetRot;

        this.playerSprite.position.y = 430 + (legsBroken ? 8 : 0) + Math.sin(this.animTimer * 2.5) * 4;

        // Emit escaping ki sparks if arms or legs broken
        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = 260 + (Math.random() - 0.5) * 40;
            p.y = 380 + (Math.random() - 0.5) * 40;
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

        const targetRot = legsBroken ? 0.15 : 0;
        this.opponentSprite.rotation = targetRot;

        this.opponentSprite.position.y = 250 + (legsBroken ? 8 : 0) + Math.sin(this.animTimer * 2.5 + 1) * 3;

        if ((armsBroken || legsBroken) && Math.random() < 0.25) {
          const p = GlobalVFXSystem.particlePool?.getParticle();
          if (p) {
            p.x = 680 + (Math.random() - 0.5) * 40;
            p.y = 210 + (Math.random() - 0.5) * 40;
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
