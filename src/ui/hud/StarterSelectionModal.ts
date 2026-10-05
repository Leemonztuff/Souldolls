import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import {
  ScreenFrame,
  KitCard,
  KitBadge,
  KitStatBox,
  KitButton,
  KitModal,
  IconRegistry,
  FocusManager,
  UIKitLinter,
} from '../kit';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_ELEMENT } from '../styles';
import { StarterLabSystem, StarterOptionInfo, StarterSpeciesId } from '../../systems/lab/StarterLabSystem';
import { GlobalAssetRegistry } from '../../render/procedural/AssetRegistry';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalRng } from '../../core/Rng';
import { Souldoll } from '../../types/souldolls';
import esText from '../../data/text/es.json';

export interface StarterSelectionModalCallbacks {
  onCancel: () => void;
  onStarterBound: (souldoll: Souldoll, rivalSpeciesId: StarterSpeciesId) => void;
}

/**
 * BLOQUE 35 R4.2, R4.3, R4.4: Modal de Selección de Soul Bottle Inicial y Vinculación con Cuerpo de Madera.
 * Construido 100% con el Souldolls UI Kit (Bloque 41) y tokens de theme.json (sin emojis ni colores fuera de tokens).
 */
export class StarterSelectionModal extends Container {
  public readonly focusManager: FocusManager = new FocusManager();
  private screenWidth: number;
  private screenHeight: number;
  private callbacks: StarterSelectionModalCallbacks;
  private options: StarterOptionInfo[];
  private selectedIndex = 0;
  private frame: ScreenFrame | null = null;
  private activeSubModal: KitModal | null = null;

  constructor(
    screenWidth: number,
    screenHeight: number,
    callbacks: StarterSelectionModalCallbacks
  ) {
    super();
    this.roundPixels = true;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.callbacks = callbacks;
    this.options = StarterLabSystem.getStarterOptions();
    this.buildUI();
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.buildUI();
  }

  public selectNext(delta: number): void {
    if (this.activeSubModal) return;
    this.selectedIndex = (this.selectedIndex + delta + this.options.length) % this.options.length;
    GlobalAudioService.playSfx('select');
    this.buildUI();
  }

  public confirmCurrent(): void {
    if (this.activeSubModal) return;
    const opt = this.options[this.selectedIndex];
    if (opt) {
      this.openConfirmModal(opt);
    }
  }

  private buildUI(): void {
    this.removeChildren();
    this.focusManager.clear();

    const w = this.screenWidth;
    const h = this.screenHeight;
    const isPortrait = w < 700 || h > w;
    const tLab = (esText as any).terms.lab;

    // 1. Telón de fondo oscuro que bloquea toques al overworld
    const dimmer = new Graphics();
    dimmer.rect(0, 0, w, h);
    dimmer.fill({ color: COLOR_NUM.black, alpha: 0.65 });
    dimmer.eventMode = 'static';
    this.addChild(dimmer);

    const frameW = Math.min(820, w - 16);
    const frameH = Math.min(680, h - 16);
    const frameX = Math.round((w - frameW) / 2);
    const frameY = Math.round((h - frameH) / 2);

    const selectedOpt = this.options[this.selectedIndex];

    const frame = new ScreenFrame({
      width: frameW,
      height: frameH,
      title: tLab.choose_title,
      onClose: () => {
        GlobalAudioService.playSfx('cancel');
        this.callbacks.onCancel();
      },
      secondaryAction: {
        label: esText.terms.group_a.options.btn_cancel,
        iconId: 'back',
        onClick: () => {
          GlobalAudioService.playSfx('cancel');
          this.callbacks.onCancel();
        },
      },
      primaryAction: {
        label: `ELEGIR ${selectedOpt.name.toUpperCase()}`,
        iconId: 'soul_bottle',
        onClick: () => this.openConfirmModal(selectedOpt),
      },
    });
    frame.position.set(frameX, frameY);
    this.frame = frame;
    this.addChild(frame);

    const cw = frame.contentWidth;
    let curY = 0;

    // 2. Banner de la Regla de Oro (Alma + Cuerpo = Souldoll)
    const bannerCard = new KitCard({
      width: cw,
      height: 44,
      variant: 'inkCrypt',
    });
    bannerCard.position.set(0, curY);
    frame.contentRoot.addChild(bannerCard);

    const bottleIcon = IconRegistry.create('soul_bottle', 20);
    bottleIcon.position.set(12, 12);
    bannerCard.addChild(bottleIcon);

    const bannerTxt = new Text({
      text: tLab.golden_rule_banner,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isPortrait ? 12 : 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        wordWrap: true,
        wordWrapWidth: cw - 44,
      }),
    });
    bannerTxt.anchor.set(0, 0.5);
    bannerTxt.position.set(38, 22);
    bannerCard.addChild(bannerTxt);

    curY += 52;

    // 3. Las 3 Tarjetas de Soul Bottle (Maga, Sacerdotisa, Hidromante)
    const gap = 10;
    const cardW = isPortrait ? cw : Math.floor((cw - gap * 2) / 3);
    const cardH = isPortrait ? 168 : 272;

    this.options.forEach((opt, idx) => {
      const isSel = idx === this.selectedIndex;
      const cardX = isPortrait ? 0 : idx * (cardW + gap);
      const cardY = isPortrait ? curY + idx * (cardH + gap) : curY;

      const elemColorNum =
        opt.element === 'Fuego'
          ? COLOR_ELEMENT.fuego.primary
          : opt.element === 'Planta'
          ? COLOR_ELEMENT.planta.primary
          : COLOR_ELEMENT.agua.primary;

      const card = new KitCard({
        width: cardW,
        height: cardH,
        variant: isSel ? 'parchment' : 'smokedWood',
        title: `${idx + 1}. ${opt.name.toUpperCase()}`,
      });
      card.position.set(cardX, cardY);
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.on('pointerdown', () => {
        if (this.selectedIndex !== idx) {
          this.selectedIndex = idx;
          GlobalAudioService.playSfx('select');
          this.buildUI();
        } else {
          this.openConfirmModal(opt);
        }
      });
      frame.contentRoot.addChild(card);

      // Pedestal circular + Sprite de la Souldoll con escala entera y pivote en los pies (I-07)
      const pedX = isPortrait ? 58 : Math.round(cardW / 2);
      const pedY = isPortrait ? 128 : 132;

      const pedGfx = new Graphics();
      pedGfx.ellipse(pedX, pedY, 34, 10);
      pedGfx.fill({ color: elemColorNum, alpha: isSel ? 0.45 : 0.25 });
      pedGfx.stroke({ color: COLOR_NUM.gold, width: isSel ? 2 : 1 });
      card.addChild(pedGfx);

      const tex = GlobalAssetRegistry.getCreatureSpritePixi(opt.speciesId);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 1.0); // Pivote en los pies (I-07)
      spr.scale.set(isPortrait ? 1 : 2); // Escala entera (I-07)
      spr.position.set(pedX, pedY);
      card.addChild(spr);

      // Insignia de Elemento y Cuerpo de Madera
      const elemBadge = new KitBadge(opt.element.toUpperCase(), 'element', opt.element.toLowerCase());
      elemBadge.position.set(isPortrait ? 114 : 12, isPortrait ? 38 : 36);
      card.addChild(elemBadge);

      const bodyBadge = new KitBadge('CUERPO DE MADERA T1', 'tier', 't1');
      bodyBadge.position.set(isPortrait ? 196 : cardW - 142, isPortrait ? 38 : 36);
      card.addChild(bodyBadge);

      // Rol y descripción
      const roleTxt = new Text({
        text: opt.roleDescription,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 13,
          fontWeight: 'bold',
          fill: isSel ? COLOR_HEX.inkCrypt : COLOR_HEX.gold,
          wordWrap: true,
          wordWrapWidth: isPortrait ? cardW - 126 : cardW - 24,
        }),
      });
      roleTxt.position.set(isPortrait ? 114 : 12, isPortrait ? 66 : 144);
      card.addChild(roleTxt);

      const loreTxt = new Text({
        text: opt.loreDescription,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: isSel ? COLOR_HEX.smokedWood : COLOR_HEX.parchmentDark,
          wordWrap: true,
          wordWrapWidth: isPortrait ? cardW - 126 : cardW - 24,
          lineHeight: 17,
        }),
      });
      loreTxt.position.set(isPortrait ? 114 : 12, isPortrait ? 88 : 168);
      card.addChild(loreTxt);

      // Stats resumidos (PS / ATQ / ESP / VEL)
      const statsY = isPortrait ? 132 : 226;
      const statW = Math.floor(((isPortrait ? cardW - 126 : cardW - 24) - 12) / 3);
      const statX0 = isPortrait ? 114 : 12;

      const hpBox = new KitStatBox({
        width: statW,
        height: 28,
        label: 'PS',
        value: opt.baseStats.hp,
      });
      hpBox.position.set(statX0, statsY);
      card.addChild(hpBox);

      const spBox = new KitStatBox({
        width: statW,
        height: 28,
        label: 'AT.ESP',
        value: opt.baseStats.spAtk,
      });
      spBox.position.set(statX0 + statW + 6, statsY);
      card.addChild(spBox);

      const spdBox = new KitStatBox({
        width: statW,
        height: 28,
        label: 'VEL',
        value: opt.baseStats.speed,
      });
      spdBox.position.set(statX0 + (statW + 6) * 2, statsY);
      card.addChild(spdBox);

      this.focusManager.register({
        container: card,
        width: cardW,
        height: cardH,
        onActivate: () => {
          this.selectedIndex = idx;
          this.openConfirmModal(opt);
        },
      });
    });

    const totalH = isPortrait
      ? curY + this.options.length * (cardH + gap) + 12
      : curY + cardH + 16;
    frame.setContentTotalHeight(totalH);
    this.focusManager.setFocus(this.selectedIndex, false);

    UIKitLinter.inspectTree(frame, 'StarterSelectionModal');
  }

  private openConfirmModal(opt: StarterOptionInfo): void {
    if (this.activeSubModal) {
      this.activeSubModal.destroy({ children: true });
      this.activeSubModal = null;
    }

    const tLab = (esText as any).terms.lab;
    const bodyText = tLab.confirm_bottle
      .replace('{name}', opt.name)
      .replace('{element}', opt.element);

    const modal = new KitModal(this.screenWidth, this.screenHeight, {
      type: 'Confirm',
      size: 'M',
      title: opt.name.toUpperCase(),
      bodyText: `${bodyText}\n\n${opt.roleDescription}`,
      confirmLabel: 'VINCULAR ALMA',
      cancelLabel: 'VOLVER',
      onConfirm: () => {
        this.activeSubModal = null;
        this.executeStarterBinding(opt);
      },
      onCancel: () => {
        this.activeSubModal = null;
      },
    });

    this.activeSubModal = modal;
    this.addChild(modal);
  }

  private executeStarterBinding(opt: StarterOptionInfo): void {
    const state = GlobalSaveService.getCurrentState();
    const { souldoll, rivalSpeciesId } = StarterLabSystem.chooseStarterBottle(
      state,
      opt.speciesId,
      GlobalRng
    );
    GlobalSaveService.save();

    // Sonidos de marca al encenderse el tubo de cristal y sellar el vínculo (B35 R4.3)
    GlobalAudioService.playSfx('crystal');
    GlobalAudioService.playSfx('soul_seal');

    // Abrir modal opcional de Apodo (Paso 4, máx 14 caracteres)
    const tLab = (esText as any).terms.lab;
    const promptModal = new KitModal(this.screenWidth, this.screenHeight, {
      type: 'TextPrompt',
      size: 'L',
      title: tLab.tube_activated.replace('{name}', opt.name),
      bodyText: `${tLab.items_received.replace('{name}', opt.name)}\n\n${tLab.nickname_prompt.replace('{name}', opt.name)}`,
      initialText: opt.name,
      confirmLabel: 'CONFIRMAR APODO',
      cancelLabel: 'CONSERVAR NOMBRE',
      onConfirm: (enteredText?: string) => {
        this.activeSubModal = null;
        StarterLabSystem.applyStarterNickname(state, enteredText);
        GlobalSaveService.save();
        this.callbacks.onStarterBound(souldoll, rivalSpeciesId);
      },
      onCancel: () => {
        this.activeSubModal = null;
        StarterLabSystem.applyStarterNickname(state, null);
        GlobalSaveService.save();
        this.callbacks.onStarterBound(souldoll, rivalSpeciesId);
      },
    });

    this.activeSubModal = promptModal;
    this.addChild(promptModal);
  }
}
