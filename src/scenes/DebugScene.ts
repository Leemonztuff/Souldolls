import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { CHARACTER_PALETTES } from '../render/procedural/CharacterFactory';
import { ALL_TILE_TYPES } from '../render/procedural/TileFactory';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { Direction } from '../types';
import { SoulDollSpriteFactory, ChassisMaterial, SpriteView } from '../render/procedural/SoulDollSpriteFactory';

type DebugTab = 'creatures' | 'characters' | 'tiles' | 'lab';

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
  private labSpeciesId = 'flamin';
  private labChassisMat: ChassisMaterial = 'wood';
  private labWeaponId = 'baculo_fuego';
  private labView: SpriteView = 'front';
  private labFrame = 0;
  private labBrokenParts = { head: 15, torso: 40, arms: 20, legs: 25 };

  public async enter(): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.buildUI();
    GlobalAudioService.playSfx('confirm');
  }

  private buildUI(): void {
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
    ];

    tabs.forEach((tab, index) => {
      const tabBtn = new Container();
      tabBtn.position.set(240 + index * 165, 10);
      tabBtn.eventMode = 'static';
      tabBtn.cursor = 'pointer';

      const isActive = tab.id === this.activeTab;
      const tabBg = new Graphics();
      tabBg.roundRect(0, 0, 195, 48, 8);
      tabBg.fill({ color: isActive ? 0x0284c7 : 0x1e293b });
      tabBg.stroke({ color: isActive ? 0xffffff : 0x334155, width: 2 });
      tabBtn.addChild(tabBg);

      const tabLabel = new Text({
        text: tab.label,
        style: new TextStyle({
          fontFamily: 'monospace, system-ui',
          fontSize: 16,
          fontWeight: '900',
          fill: isActive ? '#ffffff' : '#94a3b8',
        }),
      });
      tabLabel.anchor.set(0.5);
      tabLabel.position.set(97, 24);
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
        evoBg.roundRect(0, 0, 140, 28, 6);
        evoBg.fill({ color: 0x0284c7 });
        evoBg.stroke({ color: 0xffffff, width: 1.5 });
        evoBtn.addChild(evoBg);

        const evoTxt = new Text({
          text: '⚡ EVOLUCIONAR',
          style: new TextStyle({
            fontFamily: 'system-ui, sans-serif',
            fontSize: 11,
            fontWeight: '900',
            fill: '#ffffff',
          }),
        });
        evoTxt.anchor.set(0.5);
        evoTxt.position.set(70, 14);
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

      this.contentContainer.addChild(card);
    });

    this.maxScrollY = Math.max(0, Math.ceil(speciesList.length / cols) * (cardHeight + padding) - 580);
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

    const views: SpriteView[] = ['front', 'back', 'icon', 'attack'];
    views.forEach((v, idx) => {
      const isSel = this.labView === v;
      const btn = new Container();
      btn.position.set(16 + idx * 110, 365);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, 102, 26, 4);
      bg.fill({ color: isSel ? 0x7e22ce : 0x1e293b });
      bg.stroke({ color: isSel ? 0xffffff : 0x334155, width: 1.5 });
      btn.addChild(bg);

      const label = new Text({
        text: v.toUpperCase(),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: '#ffffff' }),
      });
      label.anchor.set(0.5);
      label.position.set(51, 13);
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

    const tex = Texture.from({ resource: previewCanvas });
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.position.set(180, 140);
    sprite.scale.set(3.5);
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

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
