import * as THREE from 'three';
import { Container, Graphics, Text, TextStyle, Texture, Sprite } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalI18n } from '../services/I18n';
import { SaveSlotSummary, GameState } from '../types';
import { GlobalTheme } from '../data/theme/ThemeManager';
import { BrassPanel } from '../render/ui/kit/BrassPanel';
import { BrassButton } from '../render/ui/kit/BrassButton';

interface MenuItem {
  id: string;
  label: string;
  action: () => void;
  enabled?: boolean;
}

export class TitleScene implements IScene {
  public name = 'Title';

  private container: Container = new Container();
  private islandGroup!: THREE.Group;
  private kiParticlesGroup!: THREE.Group;

  private menuItems: MenuItem[] = [];
  private selectedIndex = 0;
  private menuGraphics: Container[] = [];
  private cursorGraphic!: Graphics;
  private cursorAnimationTimer = 0;

  // Modals state
  private showSlotModal = false;
  private slotModalContainer: Container | null = null;
  private selectedSlotIndex = 0;
  private slotSummaries: SaveSlotSummary[] = [];

  private showOptionsModal = false;
  private optionsModalContainer: Container | null = null;
  private selectedOptionIndex = 0;

  private islandRotationSpeed = 0.15;
  private logoSprite!: Sprite;
  private logoThreadGraphics!: Graphics;
  private timeElapsed = 0;

  public async enter(): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    // 1. Setup Three.js 3D Diorama (Mystic ruins + Floating ki particles)
    this.setupThreeDiorama();

    // 2. Setup menu item structure
    this.slotSummaries = GlobalSaveService.getSlotSummaries();
    const hasAnySave = this.slotSummaries.some((s) => s.exists);

    this.menuItems = [
      {
        id: 'new_game',
        label: GlobalI18n.t('menu.new_game'),
        action: () => this.handleNewGame(),
      },
      {
        id: 'continue',
        label: GlobalI18n.t('menu.continue'),
        enabled: hasAnySave,
        action: () => this.handleContinue(),
      },
      {
        id: 'options',
        label: GlobalI18n.t('menu.settings') || 'OPCIONES',
        action: () => this.openOptionsModal(),
      },
      {
        id: 'slots',
        label: GlobalI18n.t('menu.slots'),
        action: () => this.openSlotsModal(),
      },
      {
        id: 'debug',
        label: '🛠 VISOR DE ARTE (F2)',
        action: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.pushScene('Debug');
        },
      },
    ];

    // 3. Build UI
    this.buildTitleUI();

    // Start background title track loop (gentle celesta/strings synthetic arpeggios)
    GlobalAudioService.playTitleBgm();
  }

  /**
   * Setup low poly ruins with floating blue and purple ki particles
   */
  private setupThreeDiorama(): void {
    const { scene, camera } = GlobalThreeRenderer;
    GlobalThreeRenderer.clearScene();

    // Deep dark violet / inkCrypt background fog
    const fogColor = 0x14101c;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.035);

    camera.position.set(0, 10, 16);
    camera.lookAt(0, 1.8, 0);

    // Lighting (Dark mood lighting with gold/cyan accents)
    const ambientLight = new THREE.AmbientLight(0x2a1f2d, 1.2);
    scene.add(ambientLight);

    const goldSpotLight = new THREE.DirectionalLight(0xe8b84a, 1.8);
    goldSpotLight.position.set(5, 12, 5);
    scene.add(goldSpotLight);

    const cyanSpotLight = new THREE.PointLight(0x5fe3d2, 2.5, 15);
    cyanSpotLight.position.set(-2, 3, 2);
    scene.add(cyanSpotLight);

    this.islandGroup = new THREE.Group();
    scene.add(this.islandGroup);

    // Dark stony island base (Ruins)
    const baseGeo = new THREE.CylinderGeometry(7, 8, 2.5, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f2d, // smokedWood
      roughness: 0.9,
      flatShading: true,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -1;
    this.islandGroup.add(base);

    // Stone Pillars / Ruins
    const pillarGeo = new THREE.CylinderGeometry(0.6, 0.7, 4.5, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      flatShading: true,
    });

    const pillarPositions = [
      { x: -3.5, z: -3 },
      { x: 3.5, z: -3.5 },
      { x: -4, z: 2 },
    ];

    pillarPositions.forEach((pos, idx) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(pos.x, 1.5, pos.z);
      // Give some ruin tilt / broken top look
      if (idx === 0) p.rotation.z = 0.12;
      if (idx === 1) p.rotation.x = -0.15;
      this.islandGroup.add(p);
    });

    // Floating Ki Particles (Cyan & Violet)
    this.kiParticlesGroup = new THREE.Group();
    scene.add(this.kiParticlesGroup);

    const pGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x5fe3d2 });
    const violetMat = new THREE.MeshBasicMaterial({ color: 0x9b6bff });

    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(pGeo, i % 2 === 0 ? cyanMat : violetMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 5;
      p.position.set(
        Math.cos(angle) * radius,
        1 + Math.random() * 5,
        Math.sin(angle) * radius
      );
      this.kiParticlesGroup.add(p);
    }
  }

  /**
   * Generates logo with a canvas drawing "SOULDOLLS"
   */
  private generateLogoTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 110;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Outer Text Shadow
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Draw main logo text with 'O' as a soul flame
    ctx.font = 'bold 50px "Cinzel Decorative", Cinzel, serif';
    ctx.fillStyle = GlobalTheme.Tokens.colors.base.parchment;
    ctx.letterSpacing = '6px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // We split "SOULDOLLS" into "S", "O", "ULDOLLS" to draw the flame
    ctx.fillText('S', 95, 55);
    ctx.fillText('ULDOLLS', 320, 55);

    // Draw stylized O flame in cyan / violet
    const ox = 135;
    const oy = 55;
    ctx.shadowBlur = 0; // Disable shadow for precise details

    // Outer flame loop (Violet)
    ctx.fillStyle = '#9b6bff';
    ctx.beginPath();
    ctx.moveTo(ox, oy + 20);
    ctx.quadraticCurveTo(ox - 18, oy, ox - 16, oy - 14);
    ctx.quadraticCurveTo(ox - 11, oy - 26, ox, oy - 30); // peak
    ctx.quadraticCurveTo(ox + 11, oy - 26, ox + 16, oy - 14);
    ctx.quadraticCurveTo(ox + 18, oy, ox, oy + 20);
    ctx.closePath();
    ctx.fill();

    // Inner flame core (Cyan)
    ctx.fillStyle = '#5fe3d2';
    ctx.beginPath();
    ctx.moveTo(ox, oy + 14);
    ctx.quadraticCurveTo(ox - 11, oy, ox - 9, oy - 10);
    ctx.quadraticCurveTo(ox - 7, oy - 18, ox, oy - 22); // peak
    ctx.quadraticCurveTo(ox + 7, oy - 18, ox + 9, oy - 10);
    ctx.quadraticCurveTo(ox + 11, oy, ox, oy + 14);
    ctx.closePath();
    ctx.fill();

    // Small bright white core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox, oy + 2, 5, 0, Math.PI * 2);
    ctx.fill();

    return Texture.from(canvas);
  }

  private buildTitleUI(): void {
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Logo layout
    const logoTexture = this.generateLogoTexture();
    this.logoSprite = new Sprite(logoTexture);
    this.logoSprite.anchor.set(0.5);
    this.logoSprite.position.set(width / 2, 70);
    this.container.addChild(this.logoSprite);

    // Thread Graphics (puppet hilos)
    this.logoThreadGraphics = new Graphics();
    this.container.addChild(this.logoThreadGraphics);

    // Badge Under-text (Mobile First: enlarged & prominent)
    const badgeText = new Text({
      text: '✦ RPG DE CAPTURA DE ALMAS Y MARIONETAS ✦',
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.hudFont,
        fontSize: 13,
        fontWeight: 'bold',
        fill: GlobalTheme.Tokens.colors.base.gold,
        letterSpacing: 2.5,
        stroke: { color: GlobalTheme.Tokens.colors.base.inkCrypt, width: 3 },
      }),
    });
    badgeText.anchor.set(0.5);
    badgeText.position.set(width / 2, 134);
    this.container.addChild(badgeText);

    // Suggested Age Warning label (+18 content)
    const ageWarning = new Text({
      text: 'AVISO: CONTENIDO SUGERENTE - RECOMENDADO PARA ADULTOS (+18)',
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.hudFont,
        fontSize: 11,
        fontWeight: 'bold',
        fill: GlobalTheme.Tokens.colors.ki.rift,
        stroke: { color: GlobalTheme.Tokens.colors.base.inkCrypt, width: 3 },
        letterSpacing: 1.5,
      }),
    });
    ageWarning.anchor.set(0.5);
    ageWarning.position.set(width / 2, 158);
    this.container.addChild(ageWarning);

    // Menu Container (Elevated to avoid mobile touch HUD overlap at bottom)
    const menuContainer = new Container();
    menuContainer.position.set(width / 2, 215);
    this.container.addChild(menuContainer);

    this.menuGraphics = [];
    const itemHeight = 58;

    this.menuItems.forEach((item, index) => {
      const itemContainer = new Container();
      itemContainer.position.set(0, index * itemHeight);
      itemContainer.eventMode = 'static';
      itemContainer.cursor = 'pointer';

      // Button background card (Mobile First: 380px wide x 50px tall touch target)
      const bg = new Graphics();
      bg.roundRect(-190, -25, 380, 50, 10);
      bg.fill({ color: index === this.selectedIndex ? GlobalTheme.bronzeNum : GlobalTheme.smokedWoodNum, alpha: 0.95 });
      bg.stroke({ color: index === this.selectedIndex ? 0xffffff : GlobalTheme.bronzeNum, width: 2 });
      itemContainer.addChild(bg);

      // Label text (Mobile First: bold 18px legible on phones)
      const isEnabled = item.enabled !== false;
      const labelText = new Text({
        text: item.label,
        style: new TextStyle({
          fontFamily: GlobalTheme.Tokens.typography.hudFont,
          fontSize: 18,
          fontWeight: 'bold',
          fill: isEnabled ? (index === this.selectedIndex ? '#ffffff' : GlobalTheme.Tokens.colors.base.smoke) : '#52525b',
          letterSpacing: 2,
        }),
      });
      labelText.anchor.set(0.5);
      itemContainer.addChild(labelText);

      // Mobile Touch Feedback: tactile press scaling
      itemContainer.on('pointerdown', () => {
        itemContainer.scale.set(0.97);
        if (isEnabled) {
          this.selectedIndex = index;
          this.updateMenuHighlight();
        }
      });

      const releasePress = () => {
        itemContainer.scale.set(1.0);
      };
      itemContainer.on('pointerup', () => {
        releasePress();
        if (isEnabled) {
          this.selectedIndex = index;
          item.action();
        } else {
          GlobalAudioService.playSfx('cancel');
        }
      });
      itemContainer.on('pointerupoutside', releasePress);
      itemContainer.on('pointercancel', releasePress);

      itemContainer.on('pointerenter', () => {
        if (this.selectedIndex !== index && isEnabled) {
          this.selectedIndex = index;
          GlobalAudioService.playSfx('select');
          this.updateMenuHighlight();
        }
      });

      menuContainer.addChild(itemContainer);
      this.menuGraphics.push(itemContainer);
    });

    // Cursor indicator (Mobile First: larger 7px glowing marker)
    this.cursorGraphic = new Graphics();
    this.cursorGraphic.circle(0, 0, 7);
    this.cursorGraphic.fill({ color: GlobalTheme.kiCyanNum });
    this.cursorGraphic.stroke({ color: 0xffffff, width: 2 });
    menuContainer.addChild(this.cursorGraphic);

    this.updateMenuHighlight();

    // Version label in corner
    const verText = new Text({
      text: 'v1.29.0 - Souldolls Brand Edition',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: GlobalTheme.Tokens.colors.base.smoke,
      }),
    });
    verText.position.set(20, height - 26);
    this.container.addChild(verText);

    // Footer copyright
    const copyText = new Text({
      text: '© 2026 GREMIO DE ARTÍFICES • ANIMA ISEKAI',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: GlobalTheme.Tokens.colors.base.smoke,
      }),
    });
    copyText.anchor.set(1, 0);
    copyText.position.set(width - 20, height - 26);
    this.container.addChild(copyText);
  }

  private updateMenuHighlight(): void {
    const itemHeight = 58;
    this.menuGraphics.forEach((container, idx) => {
      const bg = container.children[0] as Graphics;
      const text = container.children[1] as Text;
      const isSelected = idx === this.selectedIndex;
      const item = this.menuItems[idx];
      const isEnabled = item.enabled !== false;

      bg.clear();
      bg.roundRect(-190, -25, 380, 50, 10);
      bg.fill({ color: isSelected ? GlobalTheme.bronzeNum : GlobalTheme.smokedWoodNum, alpha: 0.95 });
      bg.stroke({
        color: isSelected ? GlobalTheme.goldNum : GlobalTheme.bronzeNum,
        width: isSelected ? 2.5 : 1.5,
      });

      text.style.fill = isEnabled ? (isSelected ? '#ffffff' : GlobalTheme.Tokens.colors.base.smoke) : '#52525b';
    });

    if (this.cursorGraphic) {
      this.cursorGraphic.position.set(-215, this.selectedIndex * itemHeight);
    }
  }

  public update(dt: number): void {
    this.timeElapsed += dt;

    // 1. Rotate 3D diorama & bob particles
    if (this.islandGroup) {
      this.islandGroup.rotation.y += this.islandRotationSpeed * dt;
    }
    if (this.kiParticlesGroup) {
      this.kiParticlesGroup.rotation.y -= (this.islandRotationSpeed * 0.3) * dt;
      this.kiParticlesGroup.children.forEach((p, idx) => {
        p.position.y += Math.sin(this.timeElapsed * 1.5 + idx) * 0.005;
      });
    }

    // 2. Animate logo threads (hanging strings)
    if (this.logoThreadGraphics && this.logoSprite) {
      this.logoThreadGraphics.clear();
      this.logoThreadGraphics.strokeStyle = { color: 0xffffff, width: 0.8, alpha: 0.35 };

      // Three threads hanging from puppet control down to logo letters
      const width = GlobalPixiRenderer.width;
      const tX1 = width / 2 - 130;
      const tX2 = width / 2;
      const tX3 = width / 2 + 130;

      // Bobbing amplitude
      const bob = Math.sin(this.timeElapsed * 2) * 5;

      this.logoThreadGraphics.moveTo(tX1, -20);
      this.logoThreadGraphics.lineTo(tX1 + bob, 55);

      this.logoThreadGraphics.moveTo(tX2, -20);
      this.logoThreadGraphics.lineTo(tX2 - bob * 0.6, 55);

      this.logoThreadGraphics.moveTo(tX3, -20);
      this.logoThreadGraphics.lineTo(tX3 + bob * 0.8, 55);

      this.logoThreadGraphics.stroke();
    }

    // 3. Cursor Bobbing
    if (this.cursorGraphic && !this.showSlotModal && !this.showOptionsModal) {
      const bobX = Math.sin(this.timeElapsed * 6) * 4;
      this.cursorGraphic.position.x = -215 + bobX;
    }

    // 4. Input Handling
    if (this.showSlotModal) {
      this.handleSlotModalInput();
    } else if (this.showOptionsModal) {
      this.handleOptionsModalInput();
    } else {
      this.handleMenuInput();
    }
  }

  private handleMenuInput(): void {
    if (GlobalInput.justPressed('UP')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      GlobalAudioService.playSfx('select');
      this.updateMenuHighlight();
    } else if (GlobalInput.justPressed('DOWN')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      GlobalAudioService.playSfx('select');
      this.updateMenuHighlight();
    }

    if (GlobalInput.justPressed('CONFIRM')) {
      const current = this.menuItems[this.selectedIndex];
      if (current && current.enabled !== false) {
        GlobalAudioService.playSfx('confirm');
        current.action();
      } else {
        GlobalAudioService.playSfx('cancel');
      }
    }
  }

  // =========================================================================
  // OPTIONS MODAL IMPLEMENTATION
  // =========================================================================
  private openOptionsModal(): void {
    this.showOptionsModal = true;
    this.selectedOptionIndex = 0;
    this.renderOptionsModal();
  }

  private closeOptionsModal(): void {
    this.showOptionsModal = false;
    if (this.optionsModalContainer) {
      this.optionsModalContainer.destroy({ children: true });
      this.optionsModalContainer = null;
    }
  }

  private renderOptionsModal(): void {
    if (this.optionsModalContainer) {
      this.optionsModalContainer.destroy({ children: true });
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.optionsModalContainer = new Container();
    this.optionsModalContainer.zIndex = 120;
    this.container.addChild(this.optionsModalContainer);

    // Background Dim
    const overlay = new Graphics();
    overlay.rect(0, 0, width, height);
    overlay.fill({ color: 0x000000, alpha: 0.82 });
    overlay.eventMode = 'static';
    this.optionsModalContainer.addChild(overlay);

    // Use our customized BrassPanel kit (Mobile First: 560px wide x 490px tall)
    const modalWidth = 560;
    const modalHeight = 490;
    const p = new BrassPanel({
      width: modalWidth,
      height: modalHeight,
      title: 'OPCIONES DE MARCA',
      backgroundType: 'smokedWood',
    });
    p.position.set((width - modalWidth) / 2, (height - modalHeight) / 2);
    this.optionsModalContainer.addChild(p);

    const startX = (width - modalWidth) / 2 + 35;
    const startY = (height - modalHeight) / 2 + 55;

    // Get current save state settings
    const state = GlobalSaveService.getCurrentState();

    // 1. Master Volume
    this.drawOptionRow(
      'VOLUMEN PRINCIPAL',
      `${Math.round(state.settings.masterVolume * 100)}%`,
      startX,
      startY,
      0,
      () => {
        this.adjustOptionValue(-1, state);
        this.renderOptionsModal();
      },
      () => {
        this.adjustOptionValue(1, state);
        this.renderOptionsModal();
      }
    );

    // 2. SFX Volume
    this.drawOptionRow(
      'VOLUMEN EFECTOS (SFX)',
      `${Math.round(state.settings.sfxVolume * 100)}%`,
      startX,
      startY,
      1,
      () => {
        this.adjustOptionValue(-1, state);
        this.renderOptionsModal();
      },
      () => {
        this.adjustOptionValue(1, state);
        this.renderOptionsModal();
      }
    );

    // 3. BGM Volume
    this.drawOptionRow(
      'VOLUMEN MÚSICA (BGM)',
      `${Math.round(state.settings.bgmVolume * 100)}%`,
      startX,
      startY,
      2,
      () => {
        this.adjustOptionValue(-1, state);
        this.renderOptionsModal();
      },
      () => {
        this.adjustOptionValue(1, state);
        this.renderOptionsModal();
      }
    );

    // 4. Outfit Style (Clásico / Atrevido)
    const styleLabel = state.settings.outfitStyle === 'atrevido' ? 'ATREVIDO ✦' : 'CLÁSICO';
    this.drawOptionRow(
      'ESTILO DE ATUENDOS',
      styleLabel,
      startX,
      startY,
      3,
      () => {
        this.adjustOptionValue(-1, state);
        this.renderOptionsModal();
      },
      () => {
        this.adjustOptionValue(1, state);
        this.renderOptionsModal();
      }
    );

    // Description text under options (Mobile First: 13px readable font)
    const descBox = new Text({
      text:
        state.settings.outfitStyle === 'atrevido'
          ? 'Estilo ATREVIDO: habilita cortes glamorosos y de fantasía mística con auras de ki sugerentes.'
          : 'Estilo CLÁSICO: trajes tradicionales de clase de batalla respetuosos del lore de Anima.',
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.bodyFont,
        fontSize: 13,
        fill: GlobalTheme.Tokens.colors.base.smoke,
        wordWrap: true,
        wordWrapWidth: modalWidth - 70,
      }),
    });
    descBox.position.set(startX, startY + 230);
    this.optionsModalContainer.addChild(descBox);

    // Content age disclaimer inside options
    const disclaimer = new Text({
      text: '* Esta opción respeta la clasificación sugerida para adultos (+18).',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: GlobalTheme.Tokens.colors.ki.rift,
        fontStyle: 'italic',
      }),
    });
    disclaimer.position.set(startX, startY + 300);
    this.optionsModalContainer.addChild(disclaimer);

    // Guardar & Cerrar Button (Mobile First: 180px x 46px touch target)
    const saveBtn = new BrassButton({
      width: 180,
      height: 46,
      fontSize: 16,
      label: 'ACEPTAR',
      onClick: () => {
        GlobalSaveService.save(); // Save settings to localStorage
        this.closeOptionsModal();
      },
    });
    saveBtn.position.set(width / 2 - 90, (height - modalHeight) / 2 + modalHeight - 60);
    this.optionsModalContainer.addChild(saveBtn);
  }

  private drawOptionRow(
    label: string,
    value: string,
    x: number,
    y: number,
    index: number,
    onPrev?: () => void,
    onNext?: () => void
  ): void {
    if (!this.optionsModalContainer) return;

    const rowY = y + index * 52;
    const isSelected = index === this.selectedOptionIndex;

    const cursorMarker = new Graphics();
    if (isSelected) {
      cursorMarker.circle(x - 14, rowY + 14, 5);
      cursorMarker.fill({ color: GlobalTheme.kiCyanNum });
    }
    this.optionsModalContainer.addChild(cursorMarker);

    const lbl = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.hudFont,
        fontSize: 14,
        fontWeight: 'bold',
        fill: isSelected ? '#ffffff' : GlobalTheme.Tokens.colors.base.smoke,
        letterSpacing: 1,
      }),
    });
    lbl.position.set(x, rowY + 2);
    lbl.eventMode = 'static';
    lbl.cursor = 'pointer';
    lbl.on('pointerdown', () => {
      this.selectedOptionIndex = index;
      GlobalAudioService.playSfx('select');
      this.renderOptionsModal();
    });
    this.optionsModalContainer.addChild(lbl);

    // Stepper container for mobile touch interactions
    const stepperContainer = new Container();
    stepperContainer.position.set(x + 280, rowY - 4);

    // Prev Button [-]
    const prevBtn = new Graphics();
    prevBtn.roundRect(0, 0, 36, 34, 6);
    prevBtn.fill({ color: 0x2a1f2d, alpha: 0.95 });
    prevBtn.stroke({ color: GlobalTheme.bronzeNum, width: 1.5 });
    prevBtn.eventMode = 'static';
    prevBtn.cursor = 'pointer';
    prevBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      this.selectedOptionIndex = index;
      GlobalAudioService.playSfx('select');
      onPrev?.();
    });
    const prevText = new Text({
      text: '◀',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: GlobalTheme.Tokens.colors.base.gold,
      }),
    });
    prevText.anchor.set(0.5);
    prevText.position.set(18, 17);
    prevBtn.addChild(prevText);
    stepperContainer.addChild(prevBtn);

    // Value text
    const val = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.hudFont,
        fontSize: 15,
        fontWeight: '900',
        fill: isSelected ? GlobalTheme.Tokens.colors.base.gold : GlobalTheme.Tokens.colors.base.parchment,
      }),
    });
    val.anchor.set(0.5, 0);
    val.position.set(92, 7);
    stepperContainer.addChild(val);

    // Next Button [+]
    const nextBtn = new Graphics();
    nextBtn.roundRect(148, 0, 36, 34, 6);
    nextBtn.fill({ color: 0x2a1f2d, alpha: 0.95 });
    nextBtn.stroke({ color: GlobalTheme.bronzeNum, width: 1.5 });
    nextBtn.eventMode = 'static';
    nextBtn.cursor = 'pointer';
    nextBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      this.selectedOptionIndex = index;
      GlobalAudioService.playSfx('select');
      onNext?.();
    });
    const nextText = new Text({
      text: '▶',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: GlobalTheme.Tokens.colors.base.gold,
      }),
    });
    nextText.anchor.set(0.5);
    nextText.position.set(166, 17);
    nextBtn.addChild(nextText);
    stepperContainer.addChild(nextBtn);

    this.optionsModalContainer.addChild(stepperContainer);
  }

  private handleOptionsModalInput(): void {
    const state = GlobalSaveService.getCurrentState();

    if (GlobalInput.justPressed('UP')) {
      this.selectedOptionIndex = (this.selectedOptionIndex - 1 + 4) % 4;
      GlobalAudioService.playSfx('select');
      this.renderOptionsModal();
    } else if (GlobalInput.justPressed('DOWN')) {
      this.selectedOptionIndex = (this.selectedOptionIndex + 1) % 4;
      GlobalAudioService.playSfx('select');
      this.renderOptionsModal();
    }

    if (GlobalInput.justPressed('LEFT')) {
      // Modify value left
      GlobalAudioService.playSfx('select');
      this.adjustOptionValue(-1, state);
      this.renderOptionsModal();
    } else if (GlobalInput.justPressed('RIGHT')) {
      // Modify value right
      GlobalAudioService.playSfx('select');
      this.adjustOptionValue(1, state);
      this.renderOptionsModal();
    }

    if (GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('cancel');
      this.closeOptionsModal();
    }
  }

  private adjustOptionValue(dir: number, state: GameState): void {
    if (this.selectedOptionIndex === 0) {
      state.settings.masterVolume = Math.max(0, Math.min(1, state.settings.masterVolume + dir * 0.1));
      GlobalAudioService.setMasterVolume(state.settings.masterVolume);
    } else if (this.selectedOptionIndex === 1) {
      state.settings.sfxVolume = Math.max(0, Math.min(1, state.settings.sfxVolume + dir * 0.1));
      GlobalAudioService.setSfxVolume(state.settings.sfxVolume);
    } else if (this.selectedOptionIndex === 2) {
      state.settings.bgmVolume = Math.max(0, Math.min(1, state.settings.bgmVolume + dir * 0.1));
      GlobalAudioService.setBgmVolume(state.settings.bgmVolume);
    } else if (this.selectedOptionIndex === 3) {
      state.settings.outfitStyle = state.settings.outfitStyle === 'clasico' ? 'atrevido' : 'clasico';
    }
  }

  // =========================================================================
  // SLOTS MODAL IMPLEMENTATION
  // =========================================================================
  private openSlotsModal(): void {
    this.showSlotModal = true;
    this.slotSummaries = GlobalSaveService.getSlotSummaries();
    this.renderSlotModal();
  }

  private closeSlotsModal(): void {
    this.showSlotModal = false;
    if (this.slotModalContainer) {
      this.slotModalContainer.destroy({ children: true });
      this.slotModalContainer = null;
    }
    this.slotSummaries = GlobalSaveService.getSlotSummaries();
    const hasAnySave = this.slotSummaries.some((s) => s.exists);
    this.menuItems[1].enabled = hasAnySave;
    this.updateMenuHighlight();
  }

  private renderSlotModal(): void {
    if (this.slotModalContainer) {
      this.slotModalContainer.destroy({ children: true });
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.slotModalContainer = new Container();
    this.slotModalContainer.zIndex = 100;
    this.container.addChild(this.slotModalContainer);

    // Dim Background Overlay
    const overlay = new Graphics();
    overlay.rect(0, 0, width, height);
    overlay.fill({ color: 0x000000, alpha: 0.75 });
    overlay.eventMode = 'static';
    this.slotModalContainer.addChild(overlay);

    // Modal Window Box (Mobile First: 580px wide x 510px tall)
    const boxWidth = 580;
    const boxHeight = 510;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    const p = new BrassPanel({
      width: boxWidth,
      height: boxHeight,
      title: 'RANURAS DE GUARDADO',
      backgroundType: 'inkCrypt',
    });
    p.position.set(boxX, boxY);
    this.slotModalContainer.addChild(p);

    // Render Slots (Mobile First: 98px card height, large legible typography)
    const slotCardHeight = 98;
    this.slotSummaries.forEach((slot, index) => {
      const cardY = boxY + 68 + index * (slotCardHeight + 14);
      const card = new Container();
      card.position.set(boxX + 24, cardY);
      card.eventMode = 'static';
      card.cursor = 'pointer';

      const isSelected = index === this.selectedSlotIndex;
      const cardBg = new Graphics();
      cardBg.roundRect(0, 0, boxWidth - 48, slotCardHeight, 10);
      cardBg.fill({ color: isSelected ? 0x1e293b : 0x131d33, alpha: 0.95 });
      cardBg.stroke({
        color: isSelected ? GlobalTheme.goldNum : GlobalTheme.bronzeNum,
        width: isSelected ? 2.5 : 1.5,
      });
      card.addChild(cardBg);

      // Slot Index Label
      const slotNumText = new Text({
        text: `SLOT ${slot.id}`,
        style: new TextStyle({
          fontFamily: GlobalTheme.Tokens.typography.hudFont,
          fontSize: 14,
          fontWeight: 'bold',
          fill: isSelected ? GlobalTheme.Tokens.colors.base.gold : GlobalTheme.Tokens.colors.base.smoke,
        }),
      });
      slotNumText.position.set(18, 14);
      card.addChild(slotNumText);

      if (slot.exists) {
        const nameText = new Text({
          text: `${slot.playerName}`,
          style: new TextStyle({
            fontFamily: GlobalTheme.Tokens.typography.bodyFont,
            fontSize: 18,
            fontWeight: 'bold',
            fill: '#ffffff',
          }),
        });
        nameText.position.set(18, 44);
        card.addChild(nameText);

        const statsText = new Text({
          text: `💰 $${slot.money}  •  ⏱ ${slot.playtimeFormatted}  •  🎖 Sellos: ${slot.badgesCount}`,
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: 13,
            fill: GlobalTheme.Tokens.colors.base.smoke,
          }),
        });
        statsText.position.set(180, 48);
        card.addChild(statsText);
      } else {
        const emptyText = new Text({
          text: '— Ranura Vacía (Toca para crear partida) —',
          style: new TextStyle({
            fontFamily: GlobalTheme.Tokens.typography.bodyFont,
            fontSize: 16,
            fontStyle: 'italic',
            fill: '#64748b',
          }),
        });
        emptyText.position.set(18, 46);
        card.addChild(emptyText);
      }

      card.on('pointerdown', () => {
        this.selectedSlotIndex = index;
        GlobalAudioService.playSfx('select');
        this.refreshSlotModalUI();
      });

      this.slotModalContainer?.addChild(card);
    });

    // Close button (Mobile First: 160px x 46px touch target)
    const closeBtn = new BrassButton({
      width: 160,
      height: 46,
      fontSize: 15,
      label: 'CERRAR',
      onClick: () => {
        this.closeSlotsModal();
      },
    });
    closeBtn.position.set(width / 2 - 80, boxY + boxHeight - 56);
    this.slotModalContainer.addChild(closeBtn);
  }

  private refreshSlotModalUI(): void {
    if (this.showSlotModal) {
      this.renderSlotModal();
    }
  }

  private handleSlotModalInput(): void {
    if (GlobalInput.justPressed('UP')) {
      this.selectedSlotIndex = (this.selectedSlotIndex - 1 + 3) % 3;
      GlobalAudioService.playSfx('select');
      this.refreshSlotModalUI();
    } else if (GlobalInput.justPressed('DOWN')) {
      this.selectedSlotIndex = (this.selectedSlotIndex + 1) % 3;
      GlobalAudioService.playSfx('select');
      this.refreshSlotModalUI();
    }

    if (GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('cancel');
      this.closeSlotsModal();
    }

    if (GlobalInput.justPressed('CONFIRM')) {
      const slotId = this.selectedSlotIndex + 1;
      const summary = this.slotSummaries[this.selectedSlotIndex];

      if (summary.exists) {
        GlobalSaveService.load(slotId);
      } else {
        const initial = GlobalSaveService.createInitialState();
        GlobalSaveService.save(slotId, initial);
      }
      this.closeSlotsModal();
      this.showToast(`Ranura ${slotId} cargada.`);
    }
  }

  private handleNewGame(): void {
    const emptyIndex = this.slotSummaries.findIndex((s) => !s.exists);
    const slotToUse = emptyIndex >= 0 ? emptyIndex + 1 : 1;

    const initialState = GlobalSaveService.createInitialState('Protagonista');
    GlobalSaveService.save(slotToUse, initialState);

    GlobalAudioService.playSfx('start');
    GlobalAudioService.stopBgm();
    GlobalSceneManager.changeScene('Overworld');
  }

  private handleContinue(): void {
    const firstActive = this.slotSummaries.find((s) => s.exists);
    if (firstActive) {
      GlobalSaveService.load(firstActive.id);
      GlobalAudioService.playSfx('start');
      GlobalAudioService.stopBgm();
      GlobalSceneManager.changeScene('Overworld');
    } else {
      GlobalAudioService.playSfx('cancel');
    }
  }

  private showToast(message: string): void {
    const toast = new Container();
    const width = GlobalPixiRenderer.width;

    const bg = new Graphics();
    bg.roundRect(-180, -22, 360, 44, 8);
    bg.fill({ color: GlobalTheme.bronzeNum, alpha: 0.95 });
    bg.stroke({ color: 0xffffff, width: 2 });
    toast.addChild(bg);

    const txt = new Text({
      text: message,
      style: new TextStyle({
        fontFamily: GlobalTheme.Tokens.typography.hudFont,
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#ffffff',
      }),
    });
    txt.anchor.set(0.5);
    toast.addChild(txt);

    toast.position.set(width / 2, 45);
    this.container.addChild(toast);

    setTimeout(() => {
      toast.destroy({ children: true });
    }, 2000);
  }

  public render(): void {
    // Handled in main render loop
  }

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
