import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GlobalPixiRenderer } from '../../render/PixiRenderer';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalSceneManager } from '../../core/SceneManager';
import { GlobalQuestSystem } from '../../systems/quest/QuestSystem';
import { KitCard, IconRegistry } from '../kit';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../styles';
import esText from '../../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Pantalla dedicada de Opciones ("OptionsScene")
 * - Permite abrir Opciones tanto desde el Menú de Título como desde el Menú Principal del Overworld.
 * - Incluye todas las opciones del Bloque 43:
 *   - Correr: mantener / alternar (por defecto mantener)
 *   - Botón de cámara: activado / desactivado (por defecto activado en táctil)
 *   - Pista de objetivo: activado / desactivado (por defecto activado)
 *   - Escala y posición de los controles táctiles
 *   - Panel de controles aparte (franja inferior reservada)
 *   - Gesto oculto de 5 toques sobre el número de versión para activar el modo DEBUG.
 */
import {
  ScreenFrame,
  KitSlider,
  KitDropdown,
  KitDivider,
  FocusManager,
  UIKitLinter,
} from '../kit';
import { IScene } from '../../scenes/IScene';
import { buildOptionsVM } from '../viewmodels/GroupAViewModels';
import { GlobalInput } from '../../core/Input';
import { registerVersionTapForDebug, isDebugEnabled } from '../../core/DebugGate';
import { GlobalEventBus } from '../../core/EventBus';

export class OptionsScene implements IScene {
  public name = 'Options';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1050;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.buildUI();
    GlobalAudioService.playSfx('confirm');
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
      this.container.zIndex = 1050;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.buildUI();
  }

  public onResize(_width: number, _height: number): void {
    this.buildUI();
  }

  public buildUI(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const vm = buildOptionsVM(state);
    const tOpt = (esText as any).terms.group_a.options;

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      onClose: () => {
        GlobalSaveService.save();
        GlobalAudioService.playSfx('cancel');
        GlobalSceneManager.popScene();
      },
      secondaryAction: {
        label: vm.btnCancel,
        iconId: 'chevron_left',
        onClick: () => {
          GlobalAudioService.playSfx('cancel');
          GlobalSceneManager.popScene();
        },
      },
      primaryAction: {
        label: vm.btnSave,
        iconId: 'check',
        onClick: () => {
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.popScene();
        },
      },
    });
    this.screenFrame = frame;
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

    const masterSlider = new KitSlider(tOpt.master_vol, vm.masterVolume, colW - 16, (r) => {
      state.settings.masterVolume = r;
      GlobalAudioService.setMasterVolume(r);
      this.buildUI();
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
        this.buildUI();
      },
    });

    const sfxSlider = new KitSlider(tOpt.sfx_vol, vm.sfxVolume, colW - 16, (r) => {
      state.settings.sfxVolume = r;
      GlobalAudioService.setSfxVolume(r);
      this.buildUI();
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
        this.buildUI();
      },
    });

    const bgmSlider = new KitSlider(tOpt.bgm_vol, vm.bgmVolume, colW - 16, (r) => {
      state.settings.bgmVolume = r;
      GlobalAudioService.setBgmVolume(r);
      this.buildUI();
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
        this.buildUI();
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
        this.buildUI();
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
        this.buildUI();
      },
      onStep: () => {
        state.settings.outfitStyle = state.settings.outfitStyle === 'clasico' ? 'atrevido' : 'clasico';
        this.buildUI();
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
        this.buildUI();
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
        this.buildUI();
      },
    });

    const div = new KitDivider(colW - 24);
    div.position.set(12, 144);
    visualCard.addChild(div);

    const descTxt = new Text({
      text: vm.descriptionText,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 18,
        fill: COLOR_HEX.inkCrypt,
        wordWrap: true,
        wordWrapWidth: colW - 24,
      }),
    });
    descTxt.roundPixels = true;
    descTxt.position.set(12, 156);
    visualCard.addChild(descTxt);

    // Card 3: Bloque 43 Controls & HUD Exploration Settings
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
        this.buildUI();
      }
    );
    runDrop.position.set(8, 38);
    controlsCard.addChild(runDrop);
    this.focusManager.register({
      container: runDrop,
      width: cw - 16,
      height: 44,
      onActivate: () => {
        state.settings.runMode = state.settings.runMode === 'toggle' ? 'hold' : 'toggle';
        GlobalSaveService.save();
        this.buildUI();
      },
    });

    const camBtnDrop = new KitDropdown(
      tOpt.camera_button,
      vm.cameraBtnOptions,
      vm.cameraBtnSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.showCameraButton = idx === 0;
        GlobalSaveService.save();
        this.buildUI();
      }
    );
    camBtnDrop.position.set(8, 90);
    controlsCard.addChild(camBtnDrop);
    this.focusManager.register({
      container: camBtnDrop,
      width: cw - 16,
      height: 44,
      onActivate: () => {
        state.settings.showCameraButton = !state.settings.showCameraButton;
        GlobalSaveService.save();
        this.buildUI();
      },
    });

    const objHintDrop = new KitDropdown(
      tOpt.objective_hint,
      vm.objectiveHintOptions,
      vm.objectiveHintSelectedIndex,
      cw - 16,
      (idx) => {
        state.settings.showObjectiveHint = idx === 0;
        GlobalSaveService.save();
        this.buildUI();
      }
    );
    objHintDrop.position.set(8, 142);
    controlsCard.addChild(objHintDrop);
    this.focusManager.register({
      container: objHintDrop,
      width: cw - 16,
      height: 44,
      onActivate: () => {
        state.settings.showObjectiveHint = !state.settings.showObjectiveHint;
        GlobalSaveService.save();
        this.buildUI();
      },
    });

    const scaleRatio = Math.max(0, Math.min(1, ((vm.touchScale || 1) - 0.8) / 0.5));
    const scaleSlider = new KitSlider(tOpt.touch_scale, scaleRatio, cw - 16, (r) => {
      state.settings.touchScale = Number((0.8 + r * 0.5).toFixed(2));
      GlobalSaveService.save();
      this.buildUI();
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
        this.buildUI();
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
        this.buildUI();
      }
    );
    sepPanelDrop.position.set(8, 298);
    controlsCard.addChild(sepPanelDrop);

    // Version badge at bottom of Controls card: 5 taps unlock DEBUG mode (Bloque 43 Req. 2)
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
        GlobalEventBus.emit('toast:message', {
          text: tOpt.debug_unlocked || 'Modo DEBUG activado',
          duration: 2600,
        });
        this.buildUI();
      } else {
        GlobalAudioService.playSfx('select');
      }
    });
    controlsCard.addChild(verTouchContainer);

    frame.setContentTotalHeight(controlsCardY + controlsCardH + 20);
    UIKitLinter.inspectTree(frame, 'OptionsScene');
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }
    this.focusManager.update();
    if (GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('cancel');
      GlobalSceneManager.popScene();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
