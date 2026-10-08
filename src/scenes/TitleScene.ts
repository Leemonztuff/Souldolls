import * as THREE from 'three';
import { Container, Graphics, Text, TextStyle, Texture, Sprite, Assets } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalI18n } from '../services/I18n';
import { SaveSlotSummary } from '../types';
import {
  ScreenFrame,
  KitCard,
  KitButton,
  KitListRow,
  KitSlider,
  KitDropdown,
  KitBadge,
  KitDivider,
  KitModal,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildOptionsVM, buildSaveSlotsVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../ui/styles';
import { isDebugEnabled, registerVersionTapForDebug } from '../core/DebugGate';
import { GlobalEventBus } from '../core/EventBus';
import esText from '../data/text/es.json';

interface MenuItem {
  id: string;
  label: string;
  iconId: 'sword' | 'soul_orb' | 'settings_gear' | 'codex_book' | 'workshop_anvil';
  action: () => void;
  enabled?: boolean;
}

/**
 * BLOQUE 42 (GRUPO A): Pantalla de Título, Opciones y Guardar/Cargar migradas 100% al Souldolls UI Kit.
 * - Mantiene el diorama 3D de Three.js y el logotipo de Souldolls con llama de ki.
 * - Elimina todo color hexadecimal/fuente/emoji fuera de los tokens.
 * - Usa ScreenFrame, KitCard, KitButton, KitListRow, KitSlider, KitDropdown, KitBadge, KitModal y FocusManager.
 */
export class TitleScene implements IScene {
  public name = 'Title';

  private container: Container = new Container();
  private islandGroup!: THREE.Group;
  private kiParticlesGroup!: THREE.Group;

  private menuItems: MenuItem[] = [];
  private selectedIndex = 0;
  private focusManager: FocusManager = new FocusManager();

  // Sub-screens state ('main' | 'options' | 'slots')
  private currentSubScreen: 'main' | 'options' | 'slots' = 'main';
  private activeScreenFrame: ScreenFrame | null = null;
  private activeModal: KitModal | null = null;
  private selectedSlotIndex = 0;
  private slotSummaries: SaveSlotSummary[] = [];

  private islandRotationSpeed = 0.15;
  private logoSprite!: Sprite;
  private logoThreadGraphics!: Graphics;
  private timeElapsed = 0;

  public async enter(): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    this.container.roundPixels = true;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.setupThreeDiorama();
    this.refreshMenuDefinitions();
    this.buildCurrentView();

    if (!Assets.cache.has('/assets/SoulDollslogo.png')) {
      Assets.load('/assets/SoulDollslogo.png')
        .then((tex: Texture) => {
          if (tex && this.logoSprite && !this.logoSprite.destroyed) {
            const width = GlobalPixiRenderer.width || 960;
            const height = GlobalPixiRenderer.height || 720;
            this.logoSprite.texture = tex;
            this.logoSprite.scale.set(
              this.calculateLogoScale(width, height, tex.width || 2043, tex.height || 770)
            );
          }
        })
        .catch(() => {});
    }

    GlobalAudioService.playTitleBgm();
  }

  public pause(): void {
    if (this.container && !this.container.destroyed) {
      this.container.visible = false;
    }
  }

  public async resume(): Promise<void> {
    if (!this.container || this.container.destroyed) {
      this.container = new Container();
      this.container.roundPixels = true;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.refreshMenuDefinitions();
    this.buildCurrentView();
  }

  private refreshMenuDefinitions(): void {
    this.slotSummaries = GlobalSaveService.getSlotSummaries();
    const hasAnySave = this.slotSummaries.some((s) => s.exists);

    this.menuItems = [
      {
        id: 'new_game',
        label: GlobalI18n.t('menu.new_game'),
        iconId: 'sword',
        action: () => this.handleNewGame(),
      },
      {
        id: 'continue',
        label: GlobalI18n.t('menu.continue'),
        iconId: 'soul_orb',
        enabled: hasAnySave,
        action: () => this.handleContinue(),
      },
      {
        id: 'options',
        label: GlobalI18n.t('menu.settings'),
        iconId: 'settings_gear',
        action: () => {
          this.currentSubScreen = 'options';
          this.buildCurrentView();
        },
      },
      {
        id: 'slots',
        label: GlobalI18n.t('menu.slots'),
        iconId: 'codex_book',
        action: () => {
          this.currentSubScreen = 'slots';
          this.buildCurrentView();
        },
      },
    ];

    if (isDebugEnabled()) {
      this.menuItems.push({
        id: 'debug',
        label: 'GALERÍA Y DEBUG (F2)',
        iconId: 'workshop_anvil',
        action: async () => {
          GlobalAudioService.playSfx('confirm');
          try {
            if (!GlobalSceneManager.hasScene('Debug')) {
              const mod = await import('./DebugScene');
              GlobalSceneManager.registerScene('Debug', () => new mod.DebugScene());
            }
            GlobalSceneManager.pushScene('Debug');
          } catch (err) {
            console.warn('[TitleScene] Optional DebugScene could not be loaded:', err);
          }
        },
      });
    }
  }

  private setupThreeDiorama(): void {
    const { scene, camera } = GlobalThreeRenderer;
    GlobalThreeRenderer.clearScene();

    const fogColor = COLOR_NUM.inkCrypt;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.035);

    camera.position.set(0, 10, 16);
    camera.lookAt(0, 1.8, 0);

    const ambientLight = new THREE.AmbientLight(COLOR_NUM.smokedWood, 1.2);
    scene.add(ambientLight);

    const goldSpotLight = new THREE.DirectionalLight(COLOR_NUM.gold, 1.8);
    goldSpotLight.position.set(5, 12, 5);
    scene.add(goldSpotLight);

    const cyanSpotLight = new THREE.PointLight(COLOR_NUM.cyan, 2.5, 15);
    cyanSpotLight.position.set(-2, 3, 2);
    scene.add(cyanSpotLight);

    this.islandGroup = new THREE.Group();
    scene.add(this.islandGroup);

    const baseGeo = new THREE.CylinderGeometry(7, 8, 2.5, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLOR_NUM.smokedWood,
      roughness: 0.9,
      flatShading: true,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -1;
    this.islandGroup.add(base);

    const pillarGeo = new THREE.CylinderGeometry(0.6, 0.7, 4.5, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: COLOR_NUM.bronze,
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
      if (idx === 0) p.rotation.z = 0.12;
      if (idx === 1) p.rotation.x = -0.15;
      this.islandGroup.add(p);
    });

    this.kiParticlesGroup = new THREE.Group();
    scene.add(this.kiParticlesGroup);

    const pGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const cyanMat = new THREE.MeshBasicMaterial({ color: COLOR_NUM.cyan });
    const violetMat = new THREE.MeshBasicMaterial({ color: COLOR_NUM.soulViolet });

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

  private generateLogoTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const cy = 72;

    //Marionette crossbar above the logo
    ctx.strokeStyle = COLOR_HEX.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 18);
    ctx.lineTo(440, 18);
    ctx.stroke();

    // Small golden attachment rings along the crossbar and letters
    const ringX = [110, 260, 410];
    ringX.forEach((rx) => {
      ctx.fillStyle = COLOR_HEX.gold;
      ctx.beginPath();
      ctx.arc(rx, 18, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.shadowColor = COLOR_HEX.black;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    ctx.font = `bold 52px ${FONTS.title}`;
    ctx.fillStyle = COLOR_HEX.parchment;
    ctx.letterSpacing = '6px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText('S', 102, cy);
    ctx.fillText('ULDOLLS', 332, cy);

    // Golden outline accent on title typography
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLOR_HEX.gold;
    ctx.lineWidth = 1.2;
    ctx.strokeText('S', 102, cy);
    ctx.strokeText('ULDOLLS', 332, cy);

    // Ki Soul Flame replacing the "O"
    const ox = 148;
    const oy = cy;

    ctx.fillStyle = COLOR_HEX.soulViolet;
    ctx.beginPath();
    ctx.moveTo(ox, oy + 22);
    ctx.quadraticCurveTo(ox - 19, oy, ox - 16, oy - 14);
    ctx.quadraticCurveTo(ox - 11, oy - 28, ox, oy - 34);
    ctx.quadraticCurveTo(ox + 11, oy - 28, ox + 16, oy - 14);
    ctx.quadraticCurveTo(ox + 19, oy, ox, oy + 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLOR_HEX.cyan;
    ctx.beginPath();
    ctx.moveTo(ox, oy + 14);
    ctx.quadraticCurveTo(ox - 12, oy, ox - 10, oy - 10);
    ctx.quadraticCurveTo(ox - 7, oy - 20, ox, oy - 24);
    ctx.quadraticCurveTo(ox + 7, oy - 20, ox + 10, oy - 10);
    ctx.quadraticCurveTo(ox + 12, oy, ox, oy + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLOR_HEX.white;
    ctx.beginPath();
    ctx.arc(ox, oy + 2, 5, 0, Math.PI * 2);
    ctx.fill();

    return Texture.from(canvas);
  }

  private buildCurrentView(): void {
    this.container.removeChildren();
    this.focusManager.clear();
    this.activeScreenFrame = null;

    if (this.currentSubScreen === 'options') {
      this.buildOptionsScreen();
    } else if (this.currentSubScreen === 'slots') {
      this.buildSlotsScreen();
    } else {
      this.buildTitleUI();
    }

    if (this.activeModal) {
      this.container.addChild(this.activeModal);
    }
  }

  private getBaseLogoY(height: number): number {
    return height < 520
      ? Math.max(40, Math.round(height * 0.11))
      : Math.max(60, Math.round(height * 0.13));
  }

  private calculateLogoScale(
    width: number,
    height: number,
    nativeW: number,
    nativeH = 770
  ): number {
    const nw = Math.max(1, nativeW);
    const nh = Math.max(1, nativeH);

    // Ensure logo never exceeds 40% of screen width or 40% of screen height
    const maxW = width * 0.40;
    const maxH = height * 0.40;

    const scaleX = maxW / nw;
    const scaleY = maxH / nh;

    // Maintain aspect ratio by picking the smaller scale factor
    const uniformScale = Math.min(scaleX, scaleY);
    return Math.max(0.08, uniformScale);
  }

  private buildTitleUI(): void {
    const width = GlobalPixiRenderer.width || 960;
    const height = GlobalPixiRenderer.height || 720;
    const isShortScreen = height < 520;

    // 1. Thread Graphics & Logo
    this.logoThreadGraphics = new Graphics();
    this.container.addChild(this.logoThreadGraphics);

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
      const nativeW = logoTexture.width || 2043;
      const nativeH = logoTexture.height || 770;
      this.logoSprite.scale.set(this.calculateLogoScale(width, height, nativeW, nativeH));
    } else {
      const generatedTex = this.generateLogoTexture();
      this.logoSprite = new Sprite(generatedTex);
      this.logoSprite.anchor.set(0.5);
      this.logoSprite.scale.set(this.calculateLogoScale(width, height, 520, 128));
    }

    if (logoTexture && logoTexture.width <= 10) {
      logoTexture.once('update', () => {
        if (this.logoSprite && !this.logoSprite.destroyed) {
          const nw = logoTexture.width || 2043;
          const nh = logoTexture.height || 770;
          this.logoSprite.scale.set(this.calculateLogoScale(width, height, nw, nh));
        }
      });
    }

    const logoY = this.getBaseLogoY(height);
    this.logoSprite.position.set(Math.round(width / 2), logoY);
    this.container.addChild(this.logoSprite);

    // 2. Subtitle & Age Badge directly on screen (Frameless Layout)
    const logoHalfH = Math.round((this.logoSprite.height || 80) / 2);
    const logoBottom = logoY + logoHalfH;

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
    subTitle.position.set(Math.round(width / 2), logoBottom + 8);
    this.container.addChild(subTitle);

    const ageBadge = new KitBadge(esText.app.age_warning, 'element', 'fuego');
    const badgeW = (ageBadge as any).badgeWidth || ageBadge.width || 200;
    const badgeY = subTitle.y + 24;
    ageBadge.position.set(Math.round((width - badgeW) / 2), badgeY);
    this.container.addChild(ageBadge);

    // 3. Menu Buttons — ALL EXACT SAME UNIFORM WIDTH, Frameless Layout
    const btnW = Math.min(340, width - 48);
    const btnH = isShortScreen ? 38 : 44;
    const stepY = isShortScreen ? 44 : 50;
    const startY = badgeY + 34;

    const menuContainer = new Container();
    menuContainer.roundPixels = true;
    this.container.addChild(menuContainer);

    this.menuItems.forEach((item, idx) => {
      const isEnabled = item.enabled !== false;
      const btn = new KitButton({
        label: item.label,
        iconId: item.iconId,
        variant: idx === 0 ? 'primary' : 'secondary',
        width: btnW,
        height: btnH,
        disabled: !isEnabled,
        onClick: () => {
          this.selectedIndex = idx;
          item.action();
        },
      });
      const btnX = Math.round((width - btnW) / 2);
      const btnY = startY + idx * stepY;
      btn.position.set(btnX, btnY);
      menuContainer.addChild(btn);

      this.focusManager.register({
        container: btn,
        width: btnW,
        height: btnH,
        disabled: !isEnabled,
        onActivate: () => {
          this.selectedIndex = idx;
          item.action();
        },
      });
    });

    this.focusManager.setFocus(this.selectedIndex, false);

    // Version & Faction Footer
    const verText = new Text({
      text: `${esText.app.version} • ${esText.factions.gremio.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 14,
        fill: COLOR_HEX.smoke,
      }),
    });
    verText.roundPixels = true;
    verText.anchor.set(0.5, 1);
    verText.position.set(Math.round(width / 2), height - 10);
    this.container.addChild(verText);

    UIKitLinter.inspectTree(menuContainer, 'TitleScene');
  }

  // =========================================================================
  // OPTIONS SCREEN (MIGRATED TO SCREENFRAME + KIT CARDS)
  // =========================================================================
  private buildOptionsScreen(): void {
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const vm = buildOptionsVM(state);

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      onClose: () => {
        GlobalSaveService.save();
        this.currentSubScreen = 'main';
        this.buildCurrentView();
      },
      secondaryAction: {
        label: vm.btnCancel,
        iconId: 'chevron_left',
        onClick: () => {
          this.currentSubScreen = 'main';
          this.buildCurrentView();
        },
      },
      primaryAction: {
        label: vm.btnSave,
        iconId: 'check',
        onClick: () => {
          GlobalSaveService.save();
          this.currentSubScreen = 'main';
          this.buildCurrentView();
        },
      },
    });
    this.activeScreenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = frame.isTwoColumn;
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    // Card 1: Audio Sliders
    const audioCard = new KitCard({
      width: colW,
      height: 204,
      variant: 'smokedWood',
      title: vm.secAudio,
    });
    audioCard.position.set(0, 0);
    frame.contentRoot.addChild(audioCard);

    const tOpt = (esText as any).terms.group_a.options;
    const masterSlider = new KitSlider(tOpt.master_vol, vm.masterVolume, colW - 16, (r) => {
      state.settings.masterVolume = r;
      GlobalAudioService.setMasterVolume(r);
      this.buildCurrentView();
    });
    masterSlider.position.set(8, 38);
    audioCard.addChild(masterSlider);
    this.focusManager.register({
      container: masterSlider,
      width: colW - 16,
      height: 44,
      onActivate: () => {},
      onStep: (dir) => {
        state.settings.masterVolume = Math.max(0, Math.min(1, state.settings.masterVolume + dir * 0.1));
        GlobalAudioService.setMasterVolume(state.settings.masterVolume);
        this.buildCurrentView();
      },
    });

    const sfxSlider = new KitSlider(tOpt.sfx_vol, vm.sfxVolume, colW - 16, (r) => {
      state.settings.sfxVolume = r;
      GlobalAudioService.setSfxVolume(r);
      this.buildCurrentView();
    });
    sfxSlider.position.set(8, 90);
    audioCard.addChild(sfxSlider);
    this.focusManager.register({
      container: sfxSlider,
      width: colW - 16,
      height: 44,
      onActivate: () => {},
      onStep: (dir) => {
        state.settings.sfxVolume = Math.max(0, Math.min(1, state.settings.sfxVolume + dir * 0.1));
        GlobalAudioService.setSfxVolume(state.settings.sfxVolume);
        this.buildCurrentView();
      },
    });

    const bgmSlider = new KitSlider(tOpt.bgm_vol, vm.bgmVolume, colW - 16, (r) => {
      state.settings.bgmVolume = r;
      GlobalAudioService.setBgmVolume(r);
      this.buildCurrentView();
    });
    bgmSlider.position.set(8, 142);
    audioCard.addChild(bgmSlider);
    this.focusManager.register({
      container: bgmSlider,
      width: colW - 16,
      height: 44,
      onActivate: () => {},
      onStep: (dir) => {
        state.settings.bgmVolume = Math.max(0, Math.min(1, state.settings.bgmVolume + dir * 0.1));
        GlobalAudioService.setBgmVolume(state.settings.bgmVolume);
        this.buildCurrentView();
      },
    });

    // Card 2: Visual & Presentation
    const visualCard = new KitCard({
      width: colW,
      height: 248,
      variant: 'parchment',
      title: vm.secVisual,
    });
    visualCard.position.set(isTwoCol ? colW + 12 : 0, isTwoCol ? 0 : 216);
    frame.contentRoot.addChild(visualCard);

    const outfitDrop = new KitDropdown(
      tOpt.outfit_style,
      vm.outfitOptions,
      vm.outfitSelectedIndex,
      colW - 16,
      (idx) => {
        state.settings.outfitStyle = idx === 1 ? 'atrevido' : 'clasico';
        this.buildCurrentView();
      }
    );
    outfitDrop.position.set(8, 38);
    visualCard.addChild(outfitDrop);
    this.focusManager.register({
      container: outfitDrop,
      width: colW - 16,
      height: 44,
      onActivate: () => {
        state.settings.outfitStyle = state.settings.outfitStyle === 'clasico' ? 'atrevido' : 'clasico';
        this.buildCurrentView();
      },
      onStep: () => {
        state.settings.outfitStyle = state.settings.outfitStyle === 'clasico' ? 'atrevido' : 'clasico';
        this.buildCurrentView();
      },
    });

    const bustModes: Array<'off' | 'subtle' | 'normal'> = ['off', 'subtle', 'normal'];
    const bustDrop = new KitDropdown(
      tOpt.bust_anim,
      vm.bustOptions,
      vm.bustSelectedIndex,
      colW - 16,
      (idx) => {
        state.settings.bustAnimation = bustModes[idx] || 'subtle';
        this.buildCurrentView();
      }
    );
    bustDrop.position.set(8, 90);
    visualCard.addChild(bustDrop);
    this.focusManager.register({
      container: bustDrop,
      width: colW - 16,
      height: 44,
      onActivate: () => {},
      onStep: (dir) => {
        const next = (vm.bustSelectedIndex + dir + bustModes.length) % bustModes.length;
        state.settings.bustAnimation = bustModes[next];
        this.buildCurrentView();
      },
    });

    const div = new KitDivider(colW - 24);
    div.position.set(12, 144);
    visualCard.addChild(div);

    const descTxt = new Text({
      text: vm.descriptionText,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 19,
        fill: COLOR_HEX.inkCrypt,
        wordWrap: true,
        wordWrapWidth: colW - 24,
      }),
    });
    descTxt.roundPixels = true;
    descTxt.position.set(12, 158);
    visualCard.addChild(descTxt);

    const discTxt = new Text({
      text: vm.disclaimerText,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.rift,
        wordWrap: true,
        wordWrapWidth: colW - 24,
      }),
    });
    discTxt.roundPixels = true;
    discTxt.position.set(12, 206);
    visualCard.addChild(discTxt);

    // Card 3: Bloque 43 Controls & HUD Exploration Settings + 5-tap Version Debug Unlock
    const controlsCardY = isTwoCol ? 260 : 476;
    const controlsCardH = 382;
    const controlsCard = new KitCard({
      width: cw,
      height: controlsCardH,
      variant: 'smokedWood',
      title: vm.secControls,
    });
    controlsCard.position.set(0, controlsCardY);
    frame.contentRoot.addChild(controlsCard);

    const runDrop = new KitDropdown(
      tOpt.run_mode,
      vm.runModeOptions,
      vm.runModeSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.runMode = idx === 1 ? 'toggle' : 'hold';
        GlobalSaveService.save();
        this.buildCurrentView();
      }
    );
    runDrop.position.set(8, 38);
    controlsCard.addChild(runDrop);

    const camBtnDrop = new KitDropdown(
      tOpt.camera_button,
      vm.cameraBtnOptions,
      vm.cameraBtnSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.showCameraButton = idx === 0;
        GlobalSaveService.save();
        this.buildCurrentView();
      }
    );
    camBtnDrop.position.set(8, 90);
    controlsCard.addChild(camBtnDrop);

    const objHintDrop = new KitDropdown(
      tOpt.objective_hint,
      vm.objectiveHintOptions,
      vm.objectiveHintSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.showObjectiveHint = idx === 0;
        GlobalSaveService.save();
        this.buildCurrentView();
      }
    );
    objHintDrop.position.set(8, 142);
    controlsCard.addChild(objHintDrop);

    const scaleRatio = Math.max(0, Math.min(1, ((vm.touchScale || 1) - 0.8) / 0.5));
    const scaleSlider = new KitSlider(tOpt.touch_scale, scaleRatio, cw - 16, (r) => {
      state.settings.touchScale = Number((0.8 + r * 0.5).toFixed(2));
      GlobalSaveService.save();
      this.buildCurrentView();
    });
    scaleSlider.position.set(8, 194);
    controlsCard.addChild(scaleSlider);

    const posModes: Array<'compact' | 'normal' | 'wide'> = ['compact', 'normal', 'wide'];
    const posDrop = new KitDropdown(
      tOpt.touch_position,
      vm.touchPosOptions,
      vm.touchPosSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.touchPosition = posModes[idx] || 'normal';
        GlobalSaveService.save();
        this.buildCurrentView();
      }
    );
    posDrop.position.set(8, 246);
    controlsCard.addChild(posDrop);

    const sepPanelDrop = new KitDropdown(
      tOpt.separate_panel,
      vm.separatePanelOptions,
      vm.separatePanelSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.separateControlPanel = idx === 1;
        GlobalSaveService.save();
        this.buildCurrentView();
      }
    );
    sepPanelDrop.position.set(8, 298);
    controlsCard.addChild(sepPanelDrop);

    const verTouchContainer = new Container();
    verTouchContainer.position.set(8, 346);
    verTouchContainer.eventMode = 'static';
    verTouchContainer.cursor = 'pointer';

    const verBg = new Graphics();
    verBg.roundRect(0, 0, cw - 16, 28, 6);
    verBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.75 });
    verTouchContainer.addChild(verBg);

    const verLabel = new Text({
      text: `${esText.app.version} • ${esText.factions.gremio.toUpperCase()}${isDebugEnabled() ? ' [DEBUG]' : ''}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fill: isDebugEnabled() ? COLOR_HEX.cyan : COLOR_HEX.smoke,
      }),
    });
    verLabel.roundPixels = true;
    verLabel.anchor.set(0.5);
    verLabel.position.set(Math.round((cw - 16) / 2), 14);
    verTouchContainer.addChild(verLabel);

    verTouchContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      const activated = registerVersionTapForDebug();
      if (activated) {
        GlobalAudioService.playSfx('levelUp');
        this.refreshMenuDefinitions();
        this.buildCurrentView();
      } else {
        GlobalAudioService.playSfx('select');
      }
    });
    controlsCard.addChild(verTouchContainer);

    const totalH = controlsCardY + controlsCardH + 20;
    frame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(frame, 'OptionsScreen');
  }

  // =========================================================================
  // SAVE / LOAD SLOTS SCREEN (MIGRATED TO SCREENFRAME + KIT CARDS)
  // =========================================================================
  private buildSlotsScreen(): void {
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    this.slotSummaries = GlobalSaveService.getSlotSummaries();
    const vm = buildSaveSlotsVM(this.slotSummaries);
    const selectedSlot = vm.slots[this.selectedSlotIndex] || vm.slots[0];

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      onClose: () => {
        this.currentSubScreen = 'main';
        this.refreshMenuDefinitions();
        this.buildCurrentView();
      },
      secondaryAction: {
        label: vm.btnBack,
        iconId: 'chevron_left',
        onClick: () => {
          this.currentSubScreen = 'main';
          this.refreshMenuDefinitions();
          this.buildCurrentView();
        },
      },
      primaryAction: {
        label: selectedSlot?.exists ? vm.btnLoad : vm.btnNew,
        iconId: 'check',
        onClick: () => this.activateSlot(this.selectedSlotIndex),
      },
    });
    this.activeScreenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const card = new KitCard({
      width: cw,
      height: 256,
      variant: 'smokedWood',
      title: esText.menu.select_slot,
    });
    card.position.set(0, 0);
    frame.contentRoot.addChild(card);

    vm.slots.forEach((slot, idx) => {
      const row = new KitListRow({
        width: cw - 16,
        height: 62,
        iconId: slot.exists ? 'guild_seal' : 'soul_orb',
        title: slot.title,
        subtitle: slot.subtitle,
        value: slot.valueText,
        selected: idx === this.selectedSlotIndex,
        onClick: () => {
          if (this.selectedSlotIndex === idx) {
            this.activateSlot(idx);
          } else {
            this.selectedSlotIndex = idx;
            this.buildCurrentView();
          }
        },
      });
      row.position.set(8, 38 + idx * 70);
      card.addChild(row);

      this.focusManager.register({
        container: row,
        width: cw - 16,
        height: 62,
        onActivate: () => {
          this.selectedSlotIndex = idx;
          this.activateSlot(idx);
        },
      });
    });

    this.focusManager.setFocus(this.selectedSlotIndex, false);
    frame.setContentTotalHeight(270);

    UIKitLinter.inspectTree(frame, 'SaveSlotsScreen');
  }

  private activateSlot(index: number): void {
    const slotId = index + 1;
    const summary = this.slotSummaries[index];
    const t = (esText as any).terms.group_a.slots;

    if (summary && summary.exists) {
      GlobalSaveService.load(slotId);
    } else {
      const initial = GlobalSaveService.createNewGameState('Protagonista');
      GlobalSaveService.save(slotId, initial);
    }

    this.refreshMenuDefinitions();
    this.currentSubScreen = 'main';
    this.buildCurrentView();
    this.showKitModalAlert(
      vmTitleOrDefault(t.title),
      t.loaded_msg.replace('{id}', String(slotId))
    );
  }

  private showKitModalAlert(title: string, bodyText: string): void {
    if (this.activeModal) {
      this.activeModal.destroy({ children: true });
      this.activeModal = null;
    }
    const w = GlobalPixiRenderer.width;
    const h = GlobalPixiRenderer.height;
    this.activeModal = new KitModal(w, h, {
      type: 'Alert',
      title,
      bodyText,
      onConfirm: () => {
        if (this.activeModal) {
          this.activeModal.destroy({ children: true });
          this.activeModal = null;
        }
      },
    });
    this.container.addChild(this.activeModal);
  }

  public update(dt: number): void {
    this.timeElapsed += dt;

    if (this.islandGroup) {
      this.islandGroup.rotation.y += this.islandRotationSpeed * dt;
    }
    if (this.kiParticlesGroup) {
      this.kiParticlesGroup.rotation.y -= this.islandRotationSpeed * 0.3 * dt;
      this.kiParticlesGroup.children.forEach((p, idx) => {
        p.position.y += Math.sin(this.timeElapsed * 1.5 + idx) * 0.005;
      });
    }

    if (this.currentSubScreen === 'main' && this.logoThreadGraphics && this.logoSprite) {
      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const baseLogoY = this.getBaseLogoY(height);
      const bobY = Math.sin(this.timeElapsed * 2.0) * 3.0;
      const swayX = Math.cos(this.timeElapsed * 1.4) * 2.0;

      this.logoSprite.position.set(Math.round(width / 2 + swayX), Math.round(baseLogoY + bobY));

      const logoW = this.logoSprite.width || 300;
      const logoH = this.logoSprite.height || 80;
      const letterTopY = this.logoSprite.y - logoH / 2;
      const span = logoW * 0.45;

      const tX1 = this.logoSprite.x - span;
      const tX2 = this.logoSprite.x - span * 0.35;
      const tX3 = this.logoSprite.x + span * 0.35;
      const tX4 = this.logoSprite.x + span;

      this.logoThreadGraphics.clear();

      // Pulsing Ki energy factor based on time
      const kiPulse = Math.sin(this.timeElapsed * 5.0) * 0.25 + 0.75;
      const glowAlpha = 0.40 * kiPulse;
      const coreAlpha = 0.90 * kiPulse;

      // Originating from inside/top edge of the logo body extending upward behind the logo
      const stringLen = 65;
      const topY = letterTopY - stringLen;

      const bX1 = this.logoSprite.x - span * 0.5;
      const bX2 = this.logoSprite.x - span * 0.2;
      const bX3 = this.logoSprite.x + span * 0.2;
      const bX4 = this.logoSprite.x + span * 0.5;

      const topX1 = this.logoSprite.x - span * 0.35;
      const topX2 = this.logoSprite.x - span * 0.15;
      const topX3 = this.logoSprite.x + span * 0.15;
      const topX4 = this.logoSprite.x + span * 0.35;

      // 1. Cyan Ki Glow Pass (Behind)
      this.logoThreadGraphics
        .moveTo(topX1, topY)
        .lineTo(bX1, letterTopY + 4)
        .moveTo(topX2, topY)
        .lineTo(bX2, letterTopY + 4)
        .moveTo(topX3, topY)
        .lineTo(bX3, letterTopY + 4)
        .moveTo(topX4, topY)
        .lineTo(bX4, letterTopY + 4)
        .stroke({ color: COLOR_NUM.cyan, width: 4.5, alpha: glowAlpha });

      // 2. Soul Violet Core Pass (On top of glow)
      this.logoThreadGraphics
        .moveTo(topX1, topY)
        .lineTo(bX1, letterTopY + 4)
        .moveTo(topX2, topY)
        .lineTo(bX2, letterTopY + 4)
        .moveTo(topX3, topY)
        .lineTo(bX3, letterTopY + 4)
        .moveTo(topX4, topY)
        .lineTo(bX4, letterTopY + 4)
        .stroke({ color: COLOR_NUM.soulViolet, width: 2.0, alpha: coreAlpha });
    }

    if (this.activeScreenFrame) {
      this.activeScreenFrame.updateInertia();
    }

    if (this.activeModal) {
      this.activeModal.updateTween(dt);
      if (GlobalInput.justPressed('CONFIRM') || GlobalInput.justPressed('CANCEL')) {
        this.activeModal.destroy({ children: true });
        this.activeModal = null;
      }
      return;
    }

    if (GlobalInput.justPressed('UP')) {
      this.focusManager.move(-1);
    } else if (GlobalInput.justPressed('DOWN')) {
      this.focusManager.move(1);
    } else if (GlobalInput.justPressed('LEFT')) {
      this.focusManager.stepCurrent(-1);
    } else if (GlobalInput.justPressed('RIGHT')) {
      this.focusManager.stepCurrent(1);
    } else if (GlobalInput.justPressed('CONFIRM')) {
      this.focusManager.activateCurrent();
    } else if (GlobalInput.justPressed('CANCEL') && this.currentSubScreen !== 'main') {
      GlobalAudioService.playSfx('cancel');
      this.currentSubScreen = 'main';
      this.refreshMenuDefinitions();
      this.buildCurrentView();
    }
  }

  private handleNewGame(): void {
    const emptyIndex = this.slotSummaries.findIndex((s) => !s.exists);
    const slotToUse = emptyIndex >= 0 ? emptyIndex + 1 : 1;

    const initialState = GlobalSaveService.createNewGameState('Protagonista');
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

  public onResize(_width: number, _height: number): void {
    this.buildCurrentView();
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}

function vmTitleOrDefault(t: string): string {
  return t || 'RANURAS DE GUARDADO';
}
