import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { CHARACTER_PALETTES } from '../render/procedural/CharacterFactory';
import { ALL_TILE_TYPES } from '../types/tilesets';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { Direction, BustAnimationMode } from '../types';
import { SoulDollSpriteFactory, ChassisMaterial, SpriteView } from '../render/procedural/SoulDollSpriteFactory';
import { BattleIdleMesh } from '../render/battle/BattleIdleMesh';
import { GlobalSaveService } from '../services/SaveService';
import {
  ScreenFrame,
  KitCard,
  KitButton,
  KitTabBar,
  KitListRow,
  KitStepper,
  KitToggle,
  KitSlider,
  KitDropdown,
  KitTextInput,
  KitStatBox,
  KitBar,
  KitBadge,
  KitStars,
  KitHearts,
  KitPartsSilhouette,
  KitItemSlot,
  KitCurrencyChip,
  KitModal,
  KitModalType,
  IconRegistry,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

type DebugTab = 'creatures' | 'characters' | 'tiles' | 'lab' | 'battle_test' | 'uikit_gallery';

export class DebugScene implements IScene {
  public name = 'Debug';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private contentContainer: Container = new Container();
  private activeTab: DebugTab = 'creatures';

  private animTimer = 0;
  private currentWalkFrame = 0;
  private charSprites: Array<{ sprite: Sprite; charId: string; dir: Direction }> = [];

  private scrollY = 0;
  private maxScrollY = 0;

  // Lab Inspector State (Bloque 19)
  private labSpeciesId = 'maga';
  private labChassisMat: ChassisMaterial = 'wood';
  private labWeaponId = 'baculo_fuego';
  private labView: SpriteView = 'view_front34';
  private labFrame = 0;
  private labBrokenParts = { head: 15, torso: 40, arms: 20, legs: 25 };

  // Battle Test State (Bloque 37, 38 & 39)
  private btAllyView: SpriteView = 'view_back34';
  private btEnemyView: SpriteView = 'view_front34';
  private btAllyFlipX = true;
  private btEnemyFlipX = true;
  private btIntegerScale = true;
  private btShowBoundingBoxes = true;
  private btShowAnchorsAndGrid = true;
  private btShowHotspots = true;
  private btNativeSize = false;
  private btSlowMotion = false;
  private btFps = 60;
  private btFpsFrames = 0;
  private btFpsAccum = 0;
  private btFpsText?: Text;
  private btAllyMesh?: BattleIdleMesh;
  private btEnemyMesh?: BattleIdleMesh;

  // Bloque 41: UI Kit Gallery State
  private galleryPortraitMode = false;
  private galleryTextScale: 1.0 | 1.15 = 1.0;
  private galleryActiveTab = 'souls';
  private galleryStepperVal = 3;
  private galleryToggleVal = true;
  private gallerySliderVal = 0.75;
  private galleryDropdownIdx = 0;
  private galleryNickname = 'Maga';
  private galleryActiveModal: KitModal | null = null;
  private galleryScreenFrame: ScreenFrame | null = null;

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.buildUI();
    GlobalAudioService.playSfx('confirm');
  }

  private buildUI(): void {
    this.container.removeChildren();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Dark backdrop
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x090d16, alpha: 0.96 });
    bg.eventMode = 'static';
    this.container.addChild(bg);

    // Header Bar
    const header = new Container();
    header.position.set(0, 0);

    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 68);
    headerBg.fill({ color: 0x0f172a });
    headerBg.stroke({ color: 0x38bdf8, width: 2.5 });
    header.addChild(headerBg);

    const titleText = new Text({
      text: '🛠 VISOR DE ARTE (F2)',
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '900',
        fill: '#38bdf8',
        letterSpacing: 2,
      }),
    });
    titleText.position.set(24, 18);
    header.addChild(titleText);

    // Tabs
    const tabs: Array<{ id: DebugTab; label: string }> = [
      { id: 'creatures', label: '1. ALMAS' },
      { id: 'characters', label: '2. ENTRENADORES' },
      { id: 'tiles', label: '3. TILES' },
      { id: 'lab', label: '4. VISOR CAPAS' },
      { id: 'battle_test', label: '5. COMBATE TEST' },
      { id: 'uikit_gallery', label: '6. UI KIT (B41)' },
    ];

    tabs.forEach((tab, index) => {
      const tabBtn = new Container();
      tabBtn.position.set(205 + index * 124, 10);
      tabBtn.eventMode = 'static';
      tabBtn.cursor = 'pointer';

      const isActive = tab.id === this.activeTab;
      const tabBg = new Graphics();
      tabBg.roundRect(0, 0, 118, 48, 8);
      tabBg.fill({ color: isActive ? 0x0284c7 : 0x1e293b });
      tabBg.stroke({ color: isActive ? 0xffffff : 0x334155, width: 2 });
      tabBtn.addChild(tabBg);

      const tabLabel = new Text({
        text: tab.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 12,
          fontWeight: 'bold',
          fill: isActive ? '#ffffff' : '#94a3b8',
        }),
      });
      tabLabel.anchor.set(0.5);
      tabLabel.position.set(59, 24);
      tabBtn.addChild(tabLabel);

      tabBtn.on('pointerdown', () => {
        if (this.activeTab !== tab.id) {
          this.activeTab = tab.id;
          this.scrollY = 0;
          GlobalAudioService.playSfx('select');
          this.refreshTabContent();
        }
      });

      header.addChild(tabBtn);
    });

    // Close Button
    const closeBtn = new Container();
    closeBtn.position.set(width - 150, 10);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    const closeBg = new Graphics();
    closeBg.roundRect(0, 0, 130, 48, 8);
    closeBg.fill({ color: 0xe11d48 });
    closeBg.stroke({ color: 0xffffff, width: 2 });
    closeBtn.addChild(closeBg);

    const closeTxt = new Text({
      text: '✕ CERRAR',
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fontWeight: '900',
        fill: '#ffffff',
      }),
    });
    closeTxt.anchor.set(0.5);
    closeTxt.position.set(65, 24);
    closeBtn.addChild(closeTxt);

    closeBtn.on('pointerdown', () => {
      this.close();
    });

    // Bloque 43 Req. 6: Excepción de depuración: con DEBUG activo, el panel debug puede abrir cualquier servicio
    const makeDebugServiceBtn = (label: string, x: number, onClick: () => void) => {
      const btn = new KitButton({
        width: 96,
        height: 36,
        label,
        variant: 'secondary',
        fontSize: 10,
        onClick,
      });
      btn.position.set(x, 16);
      header.addChild(btn);
    };
    if (width >= 1220) {
      makeDebugServiceBtn('GACHA QR', width - 562, () => {
        GlobalSceneManager.pushScene('GachaResonance', { tab: 'scan' });
      });
      makeDebugServiceBtn('MERCADO', width - 460, () => {
        GlobalSceneManager.pushScene('Shop', { mode: 'buy' });
      });
      makeDebugServiceBtn('TALLER', width - 358, () => {
        GlobalSceneManager.pushScene('Workshop');
      });
      makeDebugServiceBtn('ALMACÉN', width - 256, () => {
        GlobalSceneManager.pushScene('StorageBox');
      });
    }

    this.container.addChild(header);

    // Content container with scroll mask
    this.contentContainer = new Container();
    this.contentContainer.position.set(24, 70);

    const maskG = new Graphics();
    maskG.rect(0, 65, width, height - 75);
    maskG.fill({ color: 0xffffff });
    this.container.addChild(maskG);
    this.contentContainer.mask = maskG;

    this.container.addChild(this.contentContainer);

    this.renderActiveTab();
  }

  private refreshTabContent(): void {
    this.container.destroy({ children: true });
    this.container = new Container();
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.buildUI();
  }

  private renderActiveTab(): void {
    this.contentContainer.removeChildren();
    this.charSprites = [];

    if (this.activeTab === 'creatures') {
      this.renderCreaturesGrid();
    } else if (this.activeTab === 'characters') {
      this.renderCharactersGrid();
    } else if (this.activeTab === 'tiles') {
      this.renderTilesGrid();
    } else if (this.activeTab === 'lab') {
      this.renderLabTab();
    } else if (this.activeTab === 'battle_test') {
      this.renderBattleTestTab();
    } else if (this.activeTab === 'uikit_gallery') {
      this.renderUIKitGalleryTab();
    }
  }

  private renderCreaturesGrid(): void {
    const speciesList = Object.values(CREATURES_DATA);
    const cardWidth = 385;
    const cardHeight = 135;
    const padding = 16;
    const cols = 3;

    speciesList.forEach((sp, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const card = new Container();
      card.position.set(col * (cardWidth + padding), row * (cardHeight + padding));

      // Card Background
      const bg = new Graphics();
      bg.roundRect(0, 0, cardWidth, cardHeight, 10);
      bg.fill({ color: 0x111827, alpha: 0.95 });
      bg.stroke({ color: 0x1f2937, width: 2 });
      card.addChild(bg);

      // Header Tag
      const numTxt = new Text({
        text: `#${sp.dexNumber.toString().padStart(2, '0')} ${sp.name}`,
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#f8fafc',
        }),
      });
      numTxt.position.set(12, 10);
      card.addChild(numTxt);

      // Type Badge
      const typeBg = new Graphics();
      typeBg.roundRect(140, 10, 80, 20, 4);
      typeBg.fill({ color: this.getTypeColor(sp.types[0]) });
      card.addChild(typeBg);

      const typeTxt = new Text({
        text: sp.types.join('/'),
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#ffffff',
        }),
      });
      typeTxt.anchor.set(0.5);
      typeTxt.position.set(180, 20);
      card.addChild(typeTxt);

      // Front Sprite (64x64)
      const frontTex = GlobalAssetRegistry.getCreatureFrontPixi(sp.id);
      const frontSprite = new Sprite(frontTex);
      frontSprite.position.set(12, 40);
      frontSprite.scale.set(1.1);
      card.addChild(frontSprite);

      const frontLabel = new Text({
        text: 'FRENTE',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: '#64748b' }),
      });
      frontLabel.position.set(24, 114);
      card.addChild(frontLabel);

      // Back Sprite (64x64)
      const backTex = GlobalAssetRegistry.getCreatureBackPixi(sp.id);
      const backSprite = new Sprite(backTex);
      backSprite.position.set(92, 40);
      backSprite.scale.set(1.1);
      card.addChild(backSprite);

      const backLabel = new Text({
        text: 'ESPALDA',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: '#64748b' }),
      });
      backLabel.position.set(104, 114);
      card.addChild(backLabel);

      // Mini Icon (32x32)
      const iconTex = GlobalAssetRegistry.getCreatureIconPixi(sp.id);
      const iconSprite = new Sprite(iconTex);
      iconSprite.position.set(175, 45);
      card.addChild(iconSprite);

      const iconLabel = new Text({
        text: 'ICONO',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: '#64748b' }),
      });
      iconLabel.position.set(176, 82);
      card.addChild(iconLabel);

      // Stats Summary
      const bst =
        sp.baseStats.hp +
        sp.baseStats.atk +
        sp.baseStats.def +
        sp.baseStats.spAtk +
        sp.baseStats.spDef +
        sp.baseStats.speed;

      const statsTxt = new Text({
        text: `BST: ${bst}\nHP:${sp.baseStats.hp} ATK:${sp.baseStats.atk}\nDEF:${sp.baseStats.def} SPD:${sp.baseStats.speed}\n${sp.evolution ? `↳ ${CREATURES_DATA[sp.evolution.toSpeciesId]?.name || ''} Nv.${sp.evolution.level}` : '★ Etapa Final'}`,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 11,
          lineHeight: 15,
          fill: '#94a3b8',
        }),
      });
      statsTxt.position.set(228, 25);
      card.addChild(statsTxt);

      if (sp.evolution) {
        const evoBtn = new Container();
        evoBtn.position.set(228, 95);
        evoBtn.eventMode = 'static';
        evoBtn.cursor = 'pointer';

        const evoBg = new Graphics();
        evoBg.roundRect(0, 0, 74, 28, 6);
        evoBg.fill({ color: 0x0284c7 });
        evoBg.stroke({ color: 0xffffff, width: 1.5 });
        evoBtn.addChild(evoBg);

        const evoTxt = new Text({
          text: '⚡ ASCENSO',
          style: new TextStyle({
            fontFamily: 'system-ui, sans-serif',
            fontSize: 10,
            fontWeight: '900',
            fill: '#ffffff',
          }),
        });
        evoTxt.anchor.set(0.5);
        evoTxt.position.set(37, 14);
        evoBtn.addChild(evoTxt);

        evoBtn.on('pointerdown', () => {
          GlobalAudioService.playSfx('confirm');
          const level = sp.evolution?.level || 16;
          const testCreature = StatCalculator.createCreatureInstance(sp.id, level);
          GlobalSceneManager.pushScene('Evolution', {
            creature: testCreature,
            targetSpeciesId: sp.evolution!.toSpeciesId,
          });
        });

        card.addChild(evoBtn);
      }

      // Botón Debug: Abrir Ficha de Souldoll (Bloque 40 Req 6) con presets de estados
      const sheetBtn = new Container();
      sheetBtn.position.set(sp.evolution ? 306 : 228, 95);
      sheetBtn.eventMode = 'static';
      sheetBtn.cursor = 'pointer';

      const sheetW = sp.evolution ? 68 : 140;
      const sheetBg = new Graphics();
      sheetBg.roundRect(0, 0, sheetW, 28, 6);
      sheetBg.fill({ color: 0xd9a441 });
      sheetBg.stroke({ color: 0xffffff, width: 1.5 });
      sheetBtn.addChild(sheetBg);

      const sheetTxt = new Text({
        text: '📋 FICHA',
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 10,
          fontWeight: '900',
          fill: '#14101c',
        }),
      });
      sheetTxt.anchor.set(0.5);
      sheetTxt.position.set(sheetW / 2, 14);
      sheetBtn.addChild(sheetTxt);

      sheetBtn.on('pointerdown', () => {
        GlobalAudioService.playSfx('confirm');
        this.openDebugSheetShowroom(sp.id);
      });
      card.addChild(sheetBtn);

      this.contentContainer.addChild(card);
    });

    this.maxScrollY = Math.max(0, Math.ceil(speciesList.length / cols) * (cardHeight + padding) - 580);
  }

  /**
   * Bloque 40 Req 6: Abre la Ficha de Souldoll desde el Debug (F2) con una lista de variantes
   * para previsualizar en un clic:
   * 1) Óptima (Tier 3, Nv.18, Sincronía 180)
   * 2) Partes Dañadas / Brazos y Piernas Rotos (penalización -50% ATK/VEL y bloqueo de arma)
   * 3) Alma Sellada (sin cuerpo, 0 estrellas, partes en gris)
   * 4) KO (Cabeza/Torso a 0 PS, stats atenuados)
   * 5) Maestra Ascendida (Tier 5, Nv.50, Sincronía 255)
   */
  private openDebugSheetShowroom(speciesId: string): void {
    const saveState = GlobalSaveService.getCurrentState();
    if (!saveState.bodies) saveState.bodies = {};

    const ensureBody = (chassisId: string, keySuffix: string) => {
      const id = `debug_body_${keySuffix}`;
      if (!saveState.bodies[id]) {
        const b = StatCalculator.createBodyInstance(chassisId, `Chasis ${keySuffix.toUpperCase()}`);
        b.instanceId = id;
        saveState.bodies[id] = b;
      }
      return id;
    };

    const bodyT3 = ensureBody('chassis_piedra_t3', 't3');
    const bodyT2 = ensureBody('chassis_hierro_t2', 't2');
    const bodyT5 = ensureBody('chassis_arcano_t5', 't5');

    // 1. Intact Tier 3
    const dOptima = StatCalculator.createSouldoll(speciesId, 18, 'chassis_piedra_t3');
    dOptima.uid = `dbg_${speciesId}_optima`;
    dOptima.bodyInstanceId = bodyT3;
    dOptima.sync = 180;
    dOptima.equipped.relic = 'reliquia_eco';

    // 2. Broken Arms & Damaged Legs (Tier 2)
    const dBroken = StatCalculator.createSouldoll(speciesId, 14, 'chassis_hierro_t2');
    dBroken.uid = `dbg_${speciesId}_broken`;
    dBroken.nickname = `${dBroken.nickname} (Brazos Rotos)`;
    dBroken.bodyInstanceId = bodyT2;
    dBroken.sync = 95;
    dBroken.partHP.arms = 0;
    dBroken.partHP.legs = Math.max(1, Math.floor(dBroken.maxPartHP.legs * 0.3));
    dBroken.currentHp =
      dBroken.partHP.head + dBroken.partHP.torso + dBroken.partHP.arms + dBroken.partHP.legs;

    // 3. Sealed Soul (No Body)
    const dSealed = StatCalculator.createSouldoll(speciesId, 10, null);
    dSealed.uid = `dbg_${speciesId}_sealed`;
    dSealed.nickname = `${dSealed.nickname} (Sellada)`;
    dSealed.bodyInstanceId = null;
    dSealed.sync = 50;

    // 4. KO State
    const dKO = StatCalculator.createSouldoll(speciesId, 20, 'chassis_piedra_t3');
    dKO.uid = `dbg_${speciesId}_ko`;
    dKO.nickname = `${dKO.nickname} (KO)`;
    dKO.bodyInstanceId = bodyT3;
    dKO.currentHp = 0;
    dKO.partHP = { head: 0, torso: 0, arms: 0, legs: 0 };

    // 5. Tier 5 Max Sync
    const dMaster = StatCalculator.createSouldoll(speciesId, 50, 'chassis_arcano_t5');
    dMaster.uid = `dbg_${speciesId}_master`;
    dMaster.nickname = `${dMaster.nickname} (T5 Arcano)`;
    dMaster.bodyInstanceId = bodyT5;
    dMaster.sync = 255;
    dMaster.equipped.relic = 'reliquia_cristal';
    dMaster.equipped.accessory = 'cristal_mana_vigor';

    GlobalSceneManager.pushScene('CreatureDetail', {
      index: 0,
      list: [dOptima, dBroken, dSealed, dKO, dMaster],
    });
  }

  private renderCharactersGrid(): void {
    const chars = Object.values(CHARACTER_PALETTES);
    const cardWidth = 580;
    const cardHeight = 160;
    const padding = 20;
    const directions: Direction[] = ['down', 'up', 'left', 'right'];

    chars.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);

      const card = new Container();
      card.position.set(col * (cardWidth + padding), row * (cardHeight + padding));

      const bg = new Graphics();
      bg.roundRect(0, 0, cardWidth, cardHeight, 10);
      bg.fill({ color: 0x111827, alpha: 0.95 });
      bg.stroke({ color: 0x1f2937, width: 2 });
      card.addChild(bg);

      const nameTxt = new Text({
        text: `${c.name} (${c.id})`,
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#f8fafc',
        }),
      });
      nameTxt.position.set(16, 12);
      card.addChild(nameTxt);

      // Display 4 directions with animated walking sprite
      directions.forEach((dir, dirIdx) => {
        const dirBox = new Container();
        dirBox.position.set(16 + dirIdx * 135, 45);

        const dirBg = new Graphics();
        dirBg.roundRect(0, 0, 120, 95, 8);
        dirBg.fill({ color: 0x1f2937, alpha: 0.8 });
        dirBox.addChild(dirBg);

        const dirLabel = new Text({
          text: dir.toUpperCase(),
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 'bold',
            fill: '#64748b',
          }),
        });
        dirLabel.anchor.set(0.5);
        dirLabel.position.set(60, 14);
        dirBox.addChild(dirLabel);

        const tex = GlobalAssetRegistry.getCharacterFramePixi(c.id, dir, 0);
        const spr = new Sprite(tex);
        spr.scale.set(1.8);
        spr.anchor.set(0.5);
        spr.position.set(60, 56);
        dirBox.addChild(spr);

        this.charSprites.push({ sprite: spr, charId: c.id, dir });

        card.addChild(dirBox);
      });

      this.contentContainer.addChild(card);
    });

    this.maxScrollY = Math.max(0, Math.ceil(chars.length / 2) * (cardHeight + padding) - 580);
  }

  private renderTilesGrid(): void {
    const tiles = ALL_TILE_TYPES;
    const tileSlotSize = 135;
    const padding = 16;
    const cols = 6;

    tiles.forEach((t, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const card = new Container();
      card.position.set(col * (tileSlotSize + padding), row * (tileSlotSize + padding));

      const bg = new Graphics();
      bg.roundRect(0, 0, tileSlotSize, tileSlotSize, 8);
      bg.fill({ color: 0x111827, alpha: 0.95 });
      bg.stroke({ color: 0x1f2937, width: 2 });
      card.addChild(bg);

      // Tile Sprite 2x size
      const tex = GlobalAssetRegistry.getTilePixi(t);
      const spr = new Sprite(tex);
      spr.scale.set(2.0);
      spr.position.set(35, 18);
      card.addChild(spr);

      const nameTxt = new Text({
        text: t,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#cbd5e1',
        }),
      });
      nameTxt.anchor.set(0.5);
      nameTxt.position.set(tileSlotSize / 2, 105);
      card.addChild(nameTxt);

      this.contentContainer.addChild(card);
    });

    this.maxScrollY = Math.max(0, Math.ceil(tiles.length / cols) * (tileSlotSize + padding) - 580);
  }

  private getTypeColor(type: string): number {
    switch (type) {
      case 'Fuego': return 0xef4444;
      case 'Agua': return 0x0284c7;
      case 'Planta': return 0x16a34a;
      case 'Eléctrico': return 0xca8a04;
      case 'Tierra': return 0x78716c;
      case 'Sombra': return 0x7e22ce;
      default: return 0x64748b;
    }
  }

  public update(dt: number): void {
    // 0. Update FPS counter
    this.btFpsFrames++;
    this.btFpsAccum += dt;
    if (this.btFpsAccum >= 0.5) {
      this.btFps = Math.round(this.btFpsFrames / this.btFpsAccum);
      this.btFpsFrames = 0;
      this.btFpsAccum = 0;
      if (this.btFpsText && !this.btFpsText.destroyed) {
        this.btFpsText.text = `FPS: ${this.btFps}`;
      }
    }

    if (this.btAllyMesh && !this.btAllyMesh.destroyed) {
      this.btAllyMesh.update(dt);
    }
    if (this.btEnemyMesh && !this.btEnemyMesh.destroyed) {
      this.btEnemyMesh.update(dt);
    }
    if (this.galleryScreenFrame && !this.galleryScreenFrame.destroyed) {
      this.galleryScreenFrame.updateInertia();
    }
    if (this.galleryActiveModal && !this.galleryActiveModal.destroyed) {
      this.galleryActiveModal.updateTween(dt);
    }

    // 1. Animate character walk cycles
    this.animTimer += dt * 4;
    const frame = Math.floor(this.animTimer) % 3;
    if (frame !== this.currentWalkFrame) {
      this.currentWalkFrame = frame;
      this.charSprites.forEach(({ sprite, charId, dir }) => {
        sprite.texture = GlobalAssetRegistry.getCharacterFramePixi(charId, dir, frame);
      });
    }

    // 2. Keyboard / Touch Input
    if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.close();
    }

    if (GlobalInput.isDown('UP')) {
      this.scrollY = Math.min(0, this.scrollY + dt * 400);
      this.contentContainer.position.y = 70 + this.scrollY;
    } else if (GlobalInput.isDown('DOWN')) {
      this.scrollY = Math.max(-this.maxScrollY, this.scrollY - dt * 400);
      this.contentContainer.position.y = 70 + this.scrollY;
    }

    if (GlobalInput.justPressed('SELECT')) {
      // Tab cycle
      if (this.activeTab === 'creatures') this.activeTab = 'characters';
      else if (this.activeTab === 'characters') this.activeTab = 'tiles';
      else if (this.activeTab === 'tiles') this.activeTab = 'lab';
      else if (this.activeTab === 'lab') this.activeTab = 'battle_test';
      else this.activeTab = 'creatures';
      this.scrollY = 0;
      GlobalAudioService.playSfx('select');
      this.refreshTabContent();
    }
  }

  public close(): void {
    GlobalAudioService.playSfx('cancel');
    GlobalSceneManager.popScene();
  }

  private renderBattleTestTab(): void {
    const box = new Container();
    box.roundPixels = true;
    box.position.set(16, 10);

    // Left Controls Panel
    const ctrlPanel = new Container();
    ctrlPanel.position.set(0, 0);
    const ctrlBg = new Graphics();
    ctrlBg.roundRect(0, 0, 350, 500, 10);
    ctrlBg.fill({ color: 0x0f172a, alpha: 0.95 });
    ctrlBg.stroke({ color: 0x38bdf8, width: 2 });
    ctrlPanel.addChild(ctrlBg);

    const title = new Text({
      text: '⚔️ PRUEBA DE COMBATE (BLOQUE 39)',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: '900', fill: '#38bdf8' }),
    });
    title.position.set(16, 12);
    ctrlPanel.addChild(title);

    this.btFpsText = new Text({
      text: `FPS: ${this.btFps}`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: '900', fill: '#10b981' }),
    });
    this.btFpsText.position.set(260, 12);
    ctrlPanel.addChild(this.btFpsText);

    const viewCycle: SpriteView[] = ['view_back34', 'view_back', 'view_front34', 'view_front'];

    const toggles = [
      {
        label: `1. Vista Aliada: ${this.btAllyView}`,
        active: true,
        onClick: () => {
          const idx = viewCycle.indexOf(this.btAllyView);
          this.btAllyView = viewCycle[(idx + 1) % viewCycle.length];
          this.renderActiveTab();
        },
      },
      {
        label: `2. FlipX Aliada: ${this.btAllyFlipX ? 'ON (scale.x < 0)' : 'OFF (scale.x > 0)'}`,
        active: this.btAllyFlipX,
        onClick: () => {
          this.btAllyFlipX = !this.btAllyFlipX;
          this.renderActiveTab();
        },
      },
      {
        label: `3. Vista Enemiga: ${this.btEnemyView}`,
        active: true,
        onClick: () => {
          const idx = viewCycle.indexOf(this.btEnemyView);
          this.btEnemyView = viewCycle[(idx + 1) % viewCycle.length];
          this.renderActiveTab();
        },
      },
      {
        label: `4. FlipX Enemiga: ${this.btEnemyFlipX ? 'ON (scale.x < 0)' : 'OFF (scale.x > 0)'}`,
        active: this.btEnemyFlipX,
        onClick: () => {
          this.btEnemyFlipX = !this.btEnemyFlipX;
          this.renderActiveTab();
        },
      },
      {
        label: `5. Vel Idle: ${this.btSlowMotion ? '0.25x LENTA' : '1.0x NORMAL'} | Golpe (Impulso)`,
        active: !this.btSlowMotion,
        onClick: () => {
          this.btSlowMotion = !this.btSlowMotion;
          if (this.btAllyMesh) {
            this.btAllyMesh.timeScale = this.btSlowMotion ? 0.25 : 1.0;
            this.btAllyMesh.applyImpulse(28);
          }
          if (this.btEnemyMesh) {
            this.btEnemyMesh.timeScale = this.btSlowMotion ? 0.25 : 1.0;
            this.btEnemyMesh.applyImpulse(28);
          }
          this.renderActiveTab();
        },
      },
      {
        label: `6. Franjas Idle / Pies / Hotspots: ${this.btShowBoundingBoxes ? 'ON' : 'OFF'}`,
        active: this.btShowBoundingBoxes,
        onClick: () => {
          const next = !this.btShowBoundingBoxes;
          this.btShowBoundingBoxes = next;
          this.btShowAnchorsAndGrid = next;
          this.btShowHotspots = next;
          this.renderActiveTab();
        },
      },
    ];

    toggles.forEach((t, idx) => {
      const btn = new Container();
      btn.position.set(16, 38 + idx * 40);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bBg = new Graphics();
      bBg.roundRect(0, 0, 318, 34, 6);
      bBg.fill({ color: t.active ? 0x0284c7 : 0x1e293b });
      bBg.stroke({ color: t.active ? 0xffffff : 0x475569, width: 1.5 });
      btn.addChild(bBg);

      const bTxt = new Text({
        text: t.label,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#ffffff' }),
      });
      bTxt.position.set(12, 9);
      btn.addChild(bTxt);

      btn.on('pointerdown', () => {
        GlobalAudioService.playSfx('select');
        t.onClick();
      });

      ctrlPanel.addChild(btn);
    });

    // Aviso de mirrorSafe: false + pies anclados
    const mirrorNote = new Text({
      text:
        '✓ Pies anclados (0px debajo de waist). Línea verde = suelo.\n⚠ mirrorSafe: false (el guantelete cambia de lado al espejar).',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: '#4ade80',
        wordWrap: true,
        wordWrapWidth: 318,
      }),
    });
    mirrorNote.position.set(16, 284);
    ctrlPanel.addChild(mirrorNote);

    // Launch full interactive BattleScene button
    const launchBtn = new Container();
    launchBtn.position.set(16, 330);
    launchBtn.eventMode = 'static';
    launchBtn.cursor = 'pointer';

    const lBg = new Graphics();
    lBg.roundRect(0, 0, 318, 44, 8);
    lBg.fill({ color: 0x16a34a });
    lBg.stroke({ color: 0xffffff, width: 2 });
    launchBtn.addChild(lBg);

    const lTxt = new Text({
      text: '▶ ABRIR BATALLA REAL DE PRUEBA',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: '900', fill: '#ffffff' }),
    });
    lTxt.anchor.set(0.5);
    lTxt.position.set(159, 22);
    launchBtn.addChild(lTxt);

    launchBtn.on('pointerdown', () => {
      GlobalAudioService.playSfx('confirm');
      const ally = StatCalculator.createCreatureInstance('maga', 12);
      const enemy = StatCalculator.createCreatureInstance('maga', 10);
      GlobalSceneManager.popScene();
      GlobalSceneManager.pushScene('Battle', {
        battleType: 'wild',
        playerParty: [ally],
        opponentParty: [enemy],
        biome: 'pasto',
      });
    });
    ctrlPanel.addChild(launchBtn);

    box.addChild(ctrlPanel);

    // Right Arena Preview Panel
    const arenaW = 540;
    const arenaH = 500;
    const arena = new Container();
    arena.roundPixels = true;
    arena.position.set(366, 0);

    const arenaBg = new Graphics();
    arenaBg.roundRect(0, 0, arenaW, arenaH, 10);
    arenaBg.fill({ color: 0x0f172a });
    arenaBg.stroke({ color: 0x38bdf8, width: 2 });
    arena.addChild(arenaBg);

    const allyCx = 145;
    const allyCy = 415;
    const enemyCx = 395;
    const enemyCy = 235;

    // Platforms + Elliptical shadows (alpha 0.35)
    const platG = new Graphics();
    platG.ellipse(enemyCx, enemyCy, 86, 26);
    platG.fill({ color: 0x2a1f2d, alpha: 0.88 });
    platG.stroke({ color: 0x8a6a3b, width: 2 });
    platG.ellipse(allyCx, allyCy, 100, 30);
    platG.fill({ color: 0x2a1f2d, alpha: 0.88 });
    platG.stroke({ color: 0x8a6a3b, width: 2 });

    platG.ellipse(enemyCx, enemyCy, 42, 12);
    platG.fill({ color: 0x000000, alpha: 0.35 });
    platG.ellipse(allyCx, allyCy, 48, 14);
    platG.fill({ color: 0x000000, alpha: 0.35 });
    arena.addChild(platG);

    // Sprites: Bloque 38 & 39 (BattleIdleMesh con deformación por filas y pies anclados)
    const texAlly = GlobalAssetRegistry.getCreatureSpritePixi('maga', this.btAllyView);
    const texEnemy = GlobalAssetRegistry.getCreatureSpritePixi('maga', this.btEnemyView);
    const allyIdleMeta = GlobalAssetRegistry.getCreatureFrameMeta('maga', this.btAllyView).idle;
    const enemyIdleMeta = GlobalAssetRegistry.getCreatureFrameMeta('maga', this.btEnemyView).idle;
    const bustMode: BustAnimationMode = GlobalSaveService.getCurrentState()?.settings?.bustAnimation || 'subtle';

    const allyNativeH = Math.max(1, texAlly.height || 162);
    const enemyNativeH = Math.max(1, texEnemy.height || 162);

    const allyTargetH = arenaH * 0.38;
    const enemyTargetH = arenaH * 0.30;

    const allyScale = this.btNativeSize
      ? 1
      : this.btIntegerScale
      ? Math.max(1, Math.floor(allyTargetH / allyNativeH))
      : Number((allyTargetH / allyNativeH).toFixed(2));
    const enemyScale = this.btNativeSize
      ? 1
      : this.btIntegerScale
      ? Math.max(1, Math.floor(enemyTargetH / enemyNativeH))
      : Number((enemyTargetH / enemyNativeH).toFixed(2));

    const allySign = this.btAllyFlipX ? -1 : 1;
    const enemySign = this.btEnemyFlipX ? -1 : 1;

    const opSpr = new BattleIdleMesh({
      texture: texEnemy,
      idleMeta: enemyIdleMeta,
      bustMode,
      phaseOffsetSec: 1.4,
      cycleJitterFactor: 1.07,
    });
    opSpr.timeScale = this.btSlowMotion ? 0.25 : 1.0;
    opSpr.scale.set(enemySign * enemyScale, enemyScale);
    opSpr.position.set(enemyCx, enemyCy);
    arena.addChild(opSpr);
    this.btEnemyMesh = opSpr;

    const plSpr = new BattleIdleMesh({
      texture: texAlly,
      idleMeta: allyIdleMeta,
      bustMode,
      phaseOffsetSec: 0.2,
      cycleJitterFactor: 0.94,
    });
    plSpr.timeScale = this.btSlowMotion ? 0.25 : 1.0;
    plSpr.scale.set(allySign * allyScale, allyScale);
    plSpr.position.set(allyCx, allyCy);
    arena.addChild(plSpr);
    this.btAllyMesh = plSpr;

    // Debug Overlays (Bounding boxes, neck/waist/bust lines, feet anchor line, reflected hotspots)
    const dbgG = new Graphics();
    const drawOverlay = (spr: BattleIdleMesh, sc: number, flipX: boolean, col: number) => {
      const w = Math.round(spr.texture.width * sc);
      const h = Math.round(spr.texture.height * sc);
      const ax = Math.round(spr.position.x);
      const ay = Math.round(spr.position.y);
      const left = Math.round(ax - w / 2);
      const top = Math.round(ay - h);

      if (this.btShowAnchorsAndGrid && sc >= 2) {
        const step = Math.max(2, Math.round(sc));
        for (let x = left; x <= left + w; x += step) {
          dbgG.moveTo(x, top);
          dbgG.lineTo(x, top + h);
        }
        for (let y = top; y <= top + h; y += step) {
          dbgG.moveTo(left, y);
          dbgG.lineTo(left + w, y);
        }
        dbgG.stroke({ color: 0xffffff, width: 1, alpha: 0.14 });
      }
      if (this.btShowBoundingBoxes) {
        dbgG.rect(left, top, w, h);
        dbgG.stroke({ color: col, width: 2 });

        // Neck, waist, bust box & feet horizontal anchor line
        if (spr.idleMeta) {
          const neckY = Math.round(top + spr.idleMeta.neck * h);
          const waistY = Math.round(top + spr.idleMeta.waist * h);
          dbgG.moveTo(left - 6, neckY);
          dbgG.lineTo(left + w + 6, neckY);
          dbgG.stroke({ color: 0x38bdf8, width: 2 });

          dbgG.moveTo(left - 6, waistY);
          dbgG.lineTo(left + w + 6, waistY);
          dbgG.stroke({ color: 0xf59e0b, width: 2 });

          if (spr.idleMeta.bust) {
            const bx0 = flipX ? 1 - spr.idleMeta.bust.x1 : spr.idleMeta.bust.x0;
            const bx1 = flipX ? 1 - spr.idleMeta.bust.x0 : spr.idleMeta.bust.x1;
            dbgG.rect(
              Math.round(left + bx0 * w),
              Math.round(top + spr.idleMeta.bust.y0 * h),
              Math.round((bx1 - bx0) * w),
              Math.round((spr.idleMeta.bust.y1 - spr.idleMeta.bust.y0) * h)
            );
            dbgG.stroke({ color: 0xec4899, width: 2 });
          }
        }
        dbgG.moveTo(left - 14, ay);
        dbgG.lineTo(left + w + 14, ay);
        dbgG.stroke({ color: 0x10b981, width: 3 });
      }
      if (this.btShowAnchorsAndGrid) {
        dbgG.moveTo(ax - 10, ay);
        dbgG.lineTo(ax + 10, ay);
        dbgG.moveTo(ax, ay - 10);
        dbgG.lineTo(ax, ay + 10);
        dbgG.stroke({ color: 0xfacc15, width: 2 });
      }
      if (this.btShowHotspots) {
        const hs = [
          { dx: 4, dy: -0.78, col: 0xfacc15 },
          { dx: 2, dy: -0.52, col: 0x38bdf8 },
          { dx: 22, dy: -0.50, col: 0x22c55e },
          { dx: 0, dy: -0.20, col: 0xa855f7 },
          { dx: 26, dy: -0.54, col: 0xf97316 },
        ];
        hs.forEach((pt) => {
          const refDx = (flipX ? -pt.dx : pt.dx) * sc;
          const hx = Math.round(ax + refDx);
          const hy = Math.round(ay + pt.dy * h);
          dbgG.circle(hx, hy, 4);
          dbgG.fill({ color: pt.col });
        });
      }
    };
    drawOverlay(plSpr, allyScale, this.btAllyFlipX, 0x38bdf8);
    drawOverlay(opSpr, enemyScale, this.btEnemyFlipX, 0xf43f5e);
    arena.addChild(dbgG);

    const infoLabel = new Text({
      text: `Aliada [${this.btAllyView}]: ${texAlly.width}x${texAlly.height} scale=(${plSpr.scale.x},${plSpr.scale.y}) | Enemiga [${this.btEnemyView}]: ${texEnemy.width}x${texEnemy.height} scale=(${opSpr.scale.x},${opSpr.scale.y})`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: '#f8fafc' }),
    });
    infoLabel.position.set(12, arenaH - 26);
    arena.addChild(infoLabel);

    box.addChild(arena);
    this.contentContainer.addChild(box);
    this.maxScrollY = 0;
  }

  private renderLabTab(): void {
    const labBox = new Container();
    labBox.position.set(20, 10);

    // Left Control Panel
    const leftPanel = new Container();
    leftPanel.position.set(0, 0);

    const bgLeft = new Graphics();
    bgLeft.roundRect(0, 0, 480, 500, 10);
    bgLeft.fill({ color: 0x0f172a, alpha: 0.95 });
    bgLeft.stroke({ color: 0x38bdf8, width: 2 });
    leftPanel.addChild(bgLeft);

    // Title
    const title = new Text({
      text: '🎛 CONFIGURADOR DE CAPAS (SOULDOLL LAB)',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: '900', fill: '#38bdf8' }),
    });
    title.position.set(16, 12);
    leftPanel.addChild(title);

    // 1. Selector de Alma (14 almas)
    const soulTitle = new Text({
      text: '1. ALMA DE CLASE:',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    soulTitle.position.set(16, 38);
    leftPanel.addChild(soulTitle);

    const speciesKeys = Object.keys(CREATURES_DATA);
    speciesKeys.forEach((key, idx) => {
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const isSel = this.labSpeciesId === key;

      const btn = new Container();
      btn.position.set(16 + col * 64, 56 + row * 28);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 60, 24, 4);
      bg.fill({ color: isSel ? 0x0284c7 : 0x1e293b });
      bg.stroke({ color: isSel ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: key.slice(0, 6).toUpperCase(),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(30, 12);
      btn.addChild(label);

      btn.on('pointerdown', () => {
        this.labSpeciesId = key;
        GlobalAudioService.playSfx('select');
        this.renderActiveTab();
      });

      leftPanel.addChild(btn);
    });

    // 2. Material del Chasis
    const matTitle = new Text({
      text: '2. MATERIAL DEL CHASIS:',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    matTitle.position.set(16, 122);
    leftPanel.addChild(matTitle);

    const materials: ChassisMaterial[] = ['wood', 'iron', 'crystal', 'stone', 'clay', 'bone'];
    materials.forEach((mat, idx) => {
      const isSel = this.labChassisMat === mat;
      const btn = new Container();
      btn.position.set(16 + idx * 75, 140);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 70, 24, 4);
      bg.fill({ color: isSel ? 0x16a34a : 0x1e293b });
      bg.stroke({ color: isSel ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: mat.toUpperCase(),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(35, 12);
      btn.addChild(label);

      btn.on('pointerdown', () => {
        this.labChassisMat = mat;
        GlobalAudioService.playSfx('select');
        this.renderActiveTab();
      });

      leftPanel.addChild(btn);
    });

    // 3. Armas
    const wpnTitle = new Text({
      text: '3. ARMA EQUIPADA:',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    wpnTitle.position.set(16, 175);
    leftPanel.addChild(wpnTitle);

    const weapons = [
      'baculo_fuego',
      'baculo_solaria',
      'baculo_raiz',
      'baculo_gaia',
      'martillo_titan',
      'baston_alquimia',
      'cetro_marea',
      'nunchaku_trueno',
      'dagas_espectrales',
    ];
    weapons.forEach((wpn, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const isSel = this.labWeaponId === wpn;

      const btn = new Container();
      btn.position.set(16 + col * 150, 195 + row * 26);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 142, 22, 4);
      bg.fill({ color: isSel ? 0xd97706 : 0x1e293b });
      bg.stroke({ color: isSel ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: wpn.toUpperCase(),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(71, 11);
      btn.addChild(label);

      btn.on('pointerdown', () => {
        this.labWeaponId = wpn;
        GlobalAudioService.playSfx('select');
        this.renderActiveTab();
      });

      leftPanel.addChild(btn);
    });

    // 4. Partes Rotas Toggles
    const partsTitle = new Text({
      text: '4. PARTES ROTAS (0 PS):',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    partsTitle.position.set(16, 285);
    leftPanel.addChild(partsTitle);

    const partToggles: Array<{ key: 'head' | 'torso' | 'arms' | 'legs'; label: string }> = [
      { key: 'head', label: 'Cabeza' },
      { key: 'torso', label: 'Torso' },
      { key: 'arms', label: 'Brazos' },
      { key: 'legs', label: 'Piernas' },
    ];

    partToggles.forEach((p, idx) => {
      const isBroken = this.labBrokenParts[p.key] <= 0;
      const btn = new Container();
      btn.position.set(16 + idx * 110, 305);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 102, 26, 4);
      bg.fill({ color: isBroken ? 0xef4444 : 0x1e293b });
      bg.stroke({ color: isBroken ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: `${p.label} ${isBroken ? '💔' : '✓'}`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(51, 13);
      btn.addChild(label);

      btn.on('pointerdown', () => {
        this.labBrokenParts[p.key] = isBroken ? (p.key === 'head' ? 15 : p.key === 'torso' ? 40 : p.key === 'arms' ? 20 : 25) : 0;
        GlobalAudioService.playSfx('select');
        this.renderActiveTab();
      });

      leftPanel.addChild(btn);
    });

    // 5. Vista
    const viewTitle = new Text({
      text: '5. VISTA Y ANIMACIÓN:',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    viewTitle.position.set(16, 345);
    leftPanel.addChild(viewTitle);

    const views: SpriteView[] = ['view_front', 'view_front34', 'view_side', 'view_back34', 'view_back', 'icon'];
    views.forEach((v, idx) => {
      const isSel = this.labView === v;
      const btn = new Container();
      btn.position.set(16 + idx * 74, 365);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 70, 26, 4);
      bg.fill({ color: isSel ? 0x7e22ce : 0x1e293b });
      bg.stroke({ color: isSel ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: v.replace('view_', '').toUpperCase(),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9.5, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(35, 13);
      btn.addChild(label);

      btn.on('pointerdown', () => {
        this.labView = v;
        GlobalAudioService.playSfx('select');
        this.renderActiveTab();
      });

      leftPanel.addChild(btn);
    });

    // Trigger Attack animation frame toggle button
    const animBtn = new Container();
    animBtn.position.set(16, 410);
    animBtn.eventMode = 'static';
    animBtn.cursor = 'pointer';

    const animBg = new Graphics();
    animBg.roundRect(0, 0, 448, 32, 6);
    animBg.fill({ color: 0x0284c7 });
    animBg.stroke({ color: 0xffffff, width: 2 });
    animBtn.addChild(animBg);

    const animTxt = new Text({
      text: `▶ ALTERNAR FRAME DE ATAQUE (Frame: ${this.labFrame})`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 12, fontWeight: '900', fill: '#ffffff' }),
    });
    animTxt.anchor.set(0.5);
    animTxt.position.set(224, 16);
    animBtn.addChild(animTxt);

    animBtn.on('pointerdown', () => {
      this.labFrame = this.labFrame === 0 ? 1 : 0;
      this.labView = 'attack';
      GlobalAudioService.playSfx('confirm');
      this.renderActiveTab();
    });
    leftPanel.addChild(animBtn);

    labBox.addChild(leftPanel);

    // Right Preview Panel
    const rightPanel = new Container();
    rightPanel.position.set(500, 0);

    const bgRight = new Graphics();
    bgRight.roundRect(0, 0, 360, 500, 10);
    bgRight.fill({ color: 0x0f172a, alpha: 0.95 });
    bgRight.stroke({ color: 0x38bdf8, width: 2 });
    rightPanel.addChild(bgRight);

    // Preview Canvas
    const previewCanvas = SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: this.labSpeciesId,
      chassisMaterial: this.labChassisMat,
      equippedWeaponId: this.labWeaponId,
      brokenParts: this.labBrokenParts,
      view: this.labView,
      frame: this.labFrame,
    });

    const tex = GlobalAssetRegistry.createCrispPixiTexture(previewCanvas);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.roundPixels = true;
    sprite.position.set(180, 140);
    const previewScale = Math.max(1, Math.floor(200 / Math.max(1, previewCanvas.height)));
    sprite.scale.set(previewScale);
    rightPanel.addChild(sprite);

    // Layer Info Box
    const infoText = new Text({
      text: `CAPAS RENDERIZADAS:\n• Capa 1: Chasis ${this.labChassisMat.toUpperCase()}\n• Capa 2: Atuendo ${this.labSpeciesId.toUpperCase()}\n• Capa 3: Arma ${this.labWeaponId.toUpperCase()}\n• Capa 4: Accesorios / Auras\n• Capa 5: Daño (${Object.values(this.labBrokenParts).some((v) => v <= 0) ? 'PARTES ROTAS' : 'INTACTO'})\n\nVista: ${this.labView.toUpperCase()} (Frame ${this.labFrame})`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: '#cbd5e1',
        lineHeight: 17,
      }),
    });
    infoText.position.set(24, 270);
    rightPanel.addChild(infoText);

    labBox.addChild(rightPanel);
    this.contentContainer.addChild(labBox);
  }

  /**
   * BLOQUE 41 Req 8: Galería de componentes ("UI Kit Gallery") con todos los componentes y estados,
   * modales de ejemplo, conmutador de orientación y de tamaño de texto, y linter en tiempo de ejecución.
   */
  private renderUIKitGalleryTab(): void {
    const t = (esText as any).terms.uikit_gallery;
    const availW = GlobalPixiRenderer.width - 48;
    const availH = GlobalPixiRenderer.height - 96;

    const frameW = this.galleryPortraitMode ? Math.min(440, availW) : Math.min(920, availW);
    const frameH = Math.min(590, availH);

    const galleryRoot = new Container();
    galleryRoot.roundPixels = true;
    galleryRoot.position.set(Math.round((availW - frameW) / 2), 0);
    this.contentContainer.addChild(galleryRoot);

    const screenFrame = new ScreenFrame({
      width: frameW,
      height: frameH,
      title: t.title,
      currencies: [
        { iconId: 'coin', value: 3000 },
        { iconId: 'soul_fragment', value: 14 },
        { iconId: 'ki_dust', value: 28 },
      ],
      secondaryAction: {
        label: this.galleryPortraitMode ? t.orientation_portrait : t.orientation_landscape,
        iconId: 'settings_gear',
        onClick: () => {
          this.galleryPortraitMode = !this.galleryPortraitMode;
          this.renderActiveTab();
        },
      },
      primaryAction: {
        label: `${t.text_scale}: ${Math.round(this.galleryTextScale * 100)}%`,
        iconId: 'check',
        onClick: () => {
          this.galleryTextScale = this.galleryTextScale === 1.0 ? 1.15 : 1.0;
          this.renderActiveTab();
        },
      },
    });
    this.galleryScreenFrame = screenFrame;
    galleryRoot.addChild(screenFrame);

    const cw = screenFrame.contentWidth;
    const isTwoCol = !this.galleryPortraitMode && cw >= 680;
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    // 1. Card: Botones, Pestañas e Insignias
    const card1 = new KitCard({
      width: colW,
      height: 210,
      variant: 'smokedWood',
      title: t.sec_buttons,
    });
    card1.position.set(0, 0);
    screenFrame.contentRoot.addChild(card1);

    const btnW = Math.floor((colW - 28) / 2);
    const btnPrimary = new KitButton({
      label: t.btn_primary,
      iconId: 'sword',
      variant: 'primary',
      width: btnW,
      onClick: () => {},
    });
    btnPrimary.position.set(8, 36);
    card1.addChild(btnPrimary);

    const btnSec = new KitButton({
      label: t.btn_secondary,
      iconId: 'workshop_anvil',
      variant: 'secondary',
      width: btnW,
      onClick: () => {},
    });
    btnSec.position.set(16 + btnW, 36);
    card1.addChild(btnSec);

    const btnDanger = new KitButton({
      label: t.btn_danger,
      iconId: 'warning',
      variant: 'danger',
      width: btnW,
      onClick: () => {},
    });
    btnDanger.position.set(8, 86);
    card1.addChild(btnDanger);

    const btnDis = new KitButton({
      label: t.btn_disabled,
      iconId: 'close',
      variant: 'secondary',
      width: btnW,
      disabled: true,
      onClick: () => {},
    });
    btnDis.position.set(16 + btnW, 86);
    card1.addChild(btnDis);

    const tabBar = new KitTabBar(
      [
        { id: 'souls', label: 'ALMAS', iconId: 'soul_orb' },
        { id: 'bodies', label: 'CUERPOS', iconId: 'body_chassis' },
        { id: 'items', label: 'RELIQUIAS', iconId: 'relic' },
      ],
      this.galleryActiveTab,
      colW - 16,
      (id) => {
        this.galleryActiveTab = id;
        this.renderActiveTab();
      }
    );
    tabBar.position.set(8, 136);
    card1.addChild(tabBar);

    const badgeFire = new KitBadge('Fuego', 'element', 'fuego');
    badgeFire.position.set(8, 182);
    card1.addChild(badgeFire);

    const badgeWater = new KitBadge('Agua', 'element', 'agua');
    badgeWater.position.set(82, 182);
    card1.addChild(badgeWater);

    const badgeRarity = new KitBadge('Épica', 'rarity', 'epica');
    badgeRarity.position.set(156, 182);
    card1.addChild(badgeRarity);

    const stars = new KitStars(4, 5, 14);
    stars.position.set(234, 186);
    card1.addChild(stars);

    // 2. Card: Controles interactivos y ListRow
    const card2 = new KitCard({
      width: colW,
      height: 270,
      variant: 'smokedWood',
      title: t.sec_inputs,
    });
    card2.position.set(isTwoCol ? colW + 12 : 0, isTwoCol ? 0 : 220);
    screenFrame.contentRoot.addChild(card2);

    const stepper = new KitStepper(
      'Tier de Cuerpo',
      `T${this.galleryStepperVal}`,
      colW - 16,
      (dir) => {
        this.galleryStepperVal = Math.max(1, Math.min(5, this.galleryStepperVal + dir));
        this.renderActiveTab();
      }
    );
    stepper.position.set(8, 34);
    card2.addChild(stepper);

    const toggle = new KitToggle(
      'Sincronía Activa',
      this.galleryToggleVal,
      colW - 16,
      (val) => {
        this.galleryToggleVal = val;
        this.renderActiveTab();
      }
    );
    toggle.position.set(8, 82);
    card2.addChild(toggle);

    const slider = new KitSlider(
      'Volumen Ki',
      this.gallerySliderVal,
      colW - 16,
      (r) => {
        this.gallerySliderVal = r;
        this.renderActiveTab();
      }
    );
    slider.position.set(8, 130);
    card2.addChild(slider);

    const dropdown = new KitDropdown(
      'Material',
      ['Madera', 'Hierro', 'Piedra', 'Cristal', 'Arcano'],
      this.galleryDropdownIdx,
      colW - 16,
      (idx) => {
        this.galleryDropdownIdx = idx;
        this.renderActiveTab();
      }
    );
    dropdown.position.set(8, 178);
    card2.addChild(dropdown);

    const textInput = new KitTextInput(
      'Apodo',
      this.galleryNickname,
      'Escribe apodo...',
      colW - 16,
      () => this.openGalleryModal('TextPrompt')
    );
    textInput.position.set(8, 222);
    card2.addChild(textInput);

    // 3. Card: StatBoxes, Barras, Silueta y Ranuras
    const card3Y = isTwoCol ? 220 : 500;
    const card3 = new KitCard({
      width: colW,
      height: 250,
      variant: 'parchment',
      title: t.sec_stats,
    });
    card3.position.set(0, card3Y);
    screenFrame.contentRoot.addChild(card3);

    const statIds: Array<{ id: 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed'; lbl: string; val: number }> = [
      { id: 'hp', lbl: 'PS', val: 142 },
      { id: 'atk', lbl: 'ATQ', val: 68 },
      { id: 'def', lbl: 'DEF', val: 74 },
      { id: 'spAtk', lbl: 'ATQ.E', val: 115 },
      { id: 'spDef', lbl: 'DEF.E', val: 92 },
      { id: 'speed', lbl: 'VEL', val: 88 },
    ];
    const sbW = Math.floor((colW - 28) / 3);
    statIds.forEach((st, idx) => {
      const sb = new KitStatBox(st.id, st.lbl, st.val, sbW, 46, idx === 3 ? '+15' : undefined);
      sb.position.set(8 + (idx % 3) * (sbW + 6), 36 + Math.floor(idx / 3) * 52);
      card3.addChild(sb);
    });

    const hpBar = new KitBar('hp', 0.78, colW - 92, 18, 4, '110/142');
    hpBar.position.set(8, 146);
    card3.addChild(hpBar);

    const expBar = new KitBar('exp', 0.62, colW - 92, 14, 0);
    expBar.position.set(8, 170);
    card3.addChild(expBar);

    const hearts = new KitHearts(4, 5, 14);
    hearts.position.set(8, 192);
    card3.addChild(hearts);

    const sil = new KitPartsSilhouette();
    sil.position.set(colW - 64, 144);
    sil.scale.set(1.2);
    sil.updateParts(
      { head: 20, torso: 45, arms: 8, legs: 25 },
      { head: 20, torso: 45, arms: 20, legs: 25 }
    );
    card3.addChild(sil);

    const slot1 = new KitItemSlot('bottle', 10, 'comun');
    slot1.position.set(100, 192);
    card3.addChild(slot1);

    const slot2 = new KitItemSlot('relic', 2, 'rara');
    slot2.position.set(154, 192);
    card3.addChild(slot2);

    const slot3 = new KitItemSlot('crystal', 1, 'epica');
    slot3.position.set(208, 192);
    card3.addChild(slot3);

    // 4. Card: IconRegistry & Modales Estándar
    const card4Y = isTwoCol ? 280 : 760;
    const card4 = new KitCard({
      width: colW,
      height: 250,
      variant: 'smokedWood',
      title: t.sec_icons,
    });
    card4.position.set(isTwoCol ? colW + 12 : 0, card4Y);
    screenFrame.contentRoot.addChild(card4);

    const iconIds = IconRegistry.getAllIds().slice(0, 12);
    iconIds.forEach((id, idx) => {
      const ic = IconRegistry.create(id, 20);
      ic.position.set(12 + idx * 28, 38);
      card4.addChild(ic);
    });

    const modalTypes: Array<{ type: KitModalType; label: string }> = [
      { type: 'Confirm', label: t.modal_confirm },
      { type: 'Alert', label: t.modal_alert },
      { type: 'ItemPicker', label: t.modal_picker },
      { type: 'Quantity', label: t.modal_qty },
      { type: 'TextPrompt', label: t.modal_prompt },
      { type: 'Reward', label: t.modal_reward },
    ];

    const mBtnW = Math.floor((colW - 24) / 2);
    modalTypes.forEach((m, idx) => {
      const mb = new KitButton({
        label: m.label,
        variant: idx === 0 ? 'primary' : 'secondary',
        width: mBtnW,
        height: 44,
        onClick: () => this.openGalleryModal(m.type),
      });
      mb.position.set(8 + (idx % 2) * (mBtnW + 8), 72 + Math.floor(idx / 2) * 50);
      card4.addChild(mb);
    });

    // 5. Card: BLOQUE 42 — CHECKPOINT GLOBAL (Grupos A, B, C y D)
    const card5Y = isTwoCol ? 540 : 1020;
    const card5W = cw;
    const card5 = new KitCard({
      width: card5W,
      height: 220,
      variant: 'smokedWood',
      title: '5. CHECKPOINT BLOQUE 42 — PANTALLAS UNIFICADAS (A/B/C/D)',
    });
    card5.position.set(0, card5Y);
    screenFrame.contentRoot.addChild(card5);

    const groupAScreens: Array<{ label: string; scene: string }> = [
      { label: 'TÍTULO / OPCIONES / SLOTS', scene: 'Title' },
      { label: 'EQUIPO (PARTY)', scene: 'Party' },
      { label: 'FICHA UNIDAD (B40)', scene: 'CreatureDetail' },
      { label: 'MOCHILA (BAG)', scene: 'Bag' },
      { label: 'CÓDICE DE ALMAS', scene: 'Pokedex' },
      { label: 'MISIONES (QUESTS)', scene: 'QuestLog' },
      { label: 'TALLER ARTÍFICES', scene: 'Workshop' },
      { label: 'MERCADO ARTÍFICES', scene: 'Shop' },
      { label: 'ALMACÉN ALMAS/CUERPOS', scene: 'StorageBox' },
      { label: 'VINCULAR ALMA', scene: 'SoulBinding' },
      { label: 'FIN DE DEMO (CREDITS)', scene: 'Credits' },
      { label: 'MENÚ PAUSA (OVERWORLD)', scene: 'Overworld' },
    ];

    const gCols = isTwoCol ? 4 : 2;
    const gBtnW = Math.floor((card5W - 16 - (gCols - 1) * 6) / gCols);
    groupAScreens.forEach((sc, idx) => {
      const col = idx % gCols;
      const row = Math.floor(idx / gCols);
      const sb = new KitButton({
        label: sc.label,
        variant: idx === 1 ? 'primary' : 'secondary',
        width: gBtnW,
        height: 44,
        onClick: () => {
          if (sc.scene === 'Title' || sc.scene === 'Overworld') {
            GlobalSceneManager.changeScene(sc.scene);
          } else {
            GlobalSceneManager.pushScene(sc.scene);
          }
        },
      });
      sb.position.set(8 + col * (gBtnW + 6), 36 + row * 50);
      card5.addChild(sb);
    });

    // Ejecutar Linter en Tiempo de Ejecución sobre el árbol del Kit (Bloque 41 Req 8 & Bloque 42)
    const lintIssues = UIKitLinter.inspectTree(screenFrame, 'SouldollsUIKitGallery_Unified');
    const lintBanner = new KitBadge(
      lintIssues.length === 0 ? t.linter_ok : `${t.linter_warn} (${lintIssues.length})`,
      lintIssues.length === 0 ? 'tier' : 'element',
      lintIssues.length === 0 ? 'tier' : 'fuego'
    );
    lintBanner.position.set(8, 222);
    card4.addChild(lintBanner);

    const totalH = isTwoCol ? 780 : 1310;
    screenFrame.setContentTotalHeight(totalH);
    this.maxScrollY = 0;
  }

  private openGalleryModal(type: KitModalType): void {
    if (this.galleryActiveModal) {
      this.galleryActiveModal.destroy({ children: true });
      this.galleryActiveModal = null;
    }

    const w = GlobalPixiRenderer.width;
    const h = GlobalPixiRenderer.height;

    const modal = new KitModal(w, h, {
      type,
      title: `DEMO MODAL: ${type.toUpperCase()}`,
      bodyText:
        type === 'Reward'
          ? 'Has obtenido: Cuerpo de Hierro Forjado (T2) y 2x Soul Bottle Plata.'
          : 'Patrón único de modal del Souldolls UI Kit con foco atrapado y animación de 180 ms.',
      confirmLabel: 'ACEPTAR',
      cancelLabel: type === 'Alert' ? undefined : 'CANCELAR',
      items: [
        { id: 'baculo_fuego', title: 'Báculo de Fuego', subtitle: '+12 ATQ.E', value: 'Arma', iconId: 'sword' },
        { id: 'reliquia_eco', title: 'Reliquia del Eco', subtitle: 'Regenera Ki', value: 'Reliquia', iconId: 'relic' },
        { id: 'cristal_mana', title: 'Cristal de Maná', subtitle: '+Velocidad', value: 'Cristal', iconId: 'crystal' },
      ],
      initialQuantity: 3,
      maxQuantity: 20,
      initialText: this.galleryNickname,
      onConfirm: (res) => {
        if (type === 'TextPrompt' && typeof res === 'string') {
          this.galleryNickname = res;
        }
        if (this.galleryActiveModal) {
          this.galleryActiveModal.destroy({ children: true });
          this.galleryActiveModal = null;
        }
        this.renderActiveTab();
      },
      onCancel: () => {
        if (this.galleryActiveModal) {
          this.galleryActiveModal.destroy({ children: true });
          this.galleryActiveModal = null;
        }
      },
    });

    this.galleryActiveModal = modal;
    this.container.addChild(modal);
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
