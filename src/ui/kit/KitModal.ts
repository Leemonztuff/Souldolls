import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS, RADII } from '../styles';
import { KitCard, KitButton, KitListRow, KitStepper } from './KitPrimitives';
import { KitIconId } from './icons/IconRegistry';
import { FocusManager } from './FocusManager';
import { GlobalAudioService } from '../../services/AudioService';

export type KitModalType =
  | 'Confirm'
  | 'Alert'
  | 'ItemPicker'
  | 'Quantity'
  | 'TextPrompt'
  | 'Reward'
  | 'Tutorial';

export type KitModalSize = 'S' | 'M' | 'L';

export interface KitModalConfig {
  type: KitModalType;
  size?: KitModalSize;
  title: string;
  bodyText?: string;
  critical?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  items?: Array<{ id: string; title: string; subtitle?: string; value?: string; iconId?: KitIconId }>;
  initialQuantity?: number;
  maxQuantity?: number;
  initialText?: string;
  onConfirm?: (payload?: any) => void;
  onCancel?: () => void;
}

/**
 * BLOQUE 41 Req 5: Patrón único de Modales (Confirm, Alert, ItemPicker, Quantity, TextPrompt, Reward, Tutorial).
 * - Fondo oscurecido (alpha 0.6) que bloquea la entrada del mundo.
 * - Panel centrado con marco de bronce (S, M, L), foco atrapado, Escape/B cierra salvo en críticos,
 *   y animación de entrada/salida de 150-200 ms.
 */
export class KitModal extends Container {
  public readonly focusManager: FocusManager = new FocusManager();
  private panelRoot: Container = new Container();
  private quantityVal = 1;
  private textVal = '';
  private animProgress = 0;
  private isClosing = false;
  private onCloseFinish?: () => void;

  constructor(screenWidth: number, screenHeight: number, config: KitModalConfig) {
    super();
    this.roundPixels = true;

    this.quantityVal = config.initialQuantity ?? 1;
    this.textVal = config.initialText ?? 'Maga';

    // 1. Dimmed backdrop (alpha 0.6) blocking world clicks
    const dimmer = new Graphics();
    dimmer.rect(0, 0, screenWidth, screenHeight);
    dimmer.fill({ color: COLOR_NUM.black, alpha: 0.6 });
    dimmer.eventMode = 'static';
    dimmer.on('pointerdown', (e) => {
      e.stopPropagation();
      if (!config.critical && config.onCancel) {
        this.closeWithTween(config.onCancel);
      }
    });
    this.addChild(dimmer);

    // 2. Determine size S / M / L
    const sizeMode: KitModalSize =
      config.size ||
      (config.type === 'Confirm' || config.type === 'Alert'
        ? 'S'
        : config.type === 'ItemPicker' || config.type === 'Reward' || config.type === 'Quantity'
        ? 'M'
        : 'L');

    const targetW =
      sizeMode === 'S'
        ? Math.min(380, screenWidth - 24)
        : sizeMode === 'M'
        ? Math.min(460, screenWidth - 24)
        : Math.min(540, screenWidth - 24);
    const targetH =
      sizeMode === 'S'
        ? 220
        : sizeMode === 'M'
        ? 340
        : 380;

    this.panelRoot.roundPixels = true;
    this.panelRoot.position.set(Math.round(screenWidth / 2), Math.round(screenHeight / 2));
    this.panelRoot.scale.set(0.92);
    this.alpha = 0;
    this.addChild(this.panelRoot);

    const card = new KitCard({
      width: targetW,
      height: targetH,
      variant: 'inkCrypt',
      title: config.title,
    });
    card.position.set(Math.round(-targetW / 2), Math.round(-targetH / 2));
    card.eventMode = 'static';
    this.panelRoot.addChild(card);

    // Body text
    if (config.bodyText) {
      const bodyTxt = new Text({
        text: config.bodyText,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.parchment,
          wordWrap: true,
          wordWrapWidth: targetW - 32,
          lineHeight: 20,
        }),
      });
      bodyTxt.roundPixels = true;
      bodyTxt.position.set(16, 40);
      card.addChild(bodyTxt);
    }

    // Specialized Modal Content
    if (config.type === 'ItemPicker' && config.items) {
      config.items.slice(0, 3).forEach((it, idx) => {
        const row = new KitListRow({
          width: targetW - 32,
          height: 48,
          iconId: it.iconId || 'relic',
          title: it.title,
          subtitle: it.subtitle,
          value: it.value,
          onClick: () => {
            this.closeWithTween(() => config.onConfirm?.(it.id));
          },
        });
        row.position.set(16, 76 + idx * 54);
        card.addChild(row);
        this.focusManager.register({
          container: row,
          width: targetW - 32,
          height: 48,
          onActivate: () => this.closeWithTween(() => config.onConfirm?.(it.id)),
        });
      });
    } else if (config.type === 'Quantity') {
      const maxQ = config.maxQuantity || 99;
      const stepRow = new KitStepper(
        'Cantidad seleccionada',
        `x${this.quantityVal}`,
        targetW - 32,
        (dir) => {
          this.quantityVal = Math.max(1, Math.min(maxQ, this.quantityVal + dir));
        }
      );
      stepRow.position.set(16, 96);
      card.addChild(stepRow);
    } else if (config.type === 'TextPrompt') {
      const presets = ['Maga', 'Ignis', 'Lumina', 'Nyx'];
      presets.forEach((pName, idx) => {
        const btn = new KitButton({
          label: pName,
          variant: this.textVal === pName ? 'primary' : 'secondary',
          width: Math.floor((targetW - 44) / 2),
          height: 44,
          onClick: () => {
            this.textVal = pName;
            this.closeWithTween(() => config.onConfirm?.(this.textVal));
          },
        });
        btn.position.set(16 + (idx % 2) * Math.floor((targetW - 20) / 2), 96 + Math.floor(idx / 2) * 52);
        card.addChild(btn);
      });
    }

    // Footer Buttons (Cancel/Back on Left, Primary Confirm on Right)
    const btnY = targetH - 56;
    if (config.cancelLabel && !config.critical) {
      const cancelBtn = new KitButton({
        label: config.cancelLabel,
        variant: 'secondary',
        width: 140,
        height: 44,
        onClick: () => {
          GlobalAudioService.playSfx('cancel');
          this.closeWithTween(() => config.onCancel?.());
        },
      });
      cancelBtn.position.set(16, btnY);
      card.addChild(cancelBtn);
      this.focusManager.register({
        container: cancelBtn,
        width: 140,
        height: 44,
        onActivate: () => this.closeWithTween(() => config.onCancel?.()),
      });
    }

    const confirmBtn = new KitButton({
      label: config.confirmLabel || 'ACEPTAR',
      variant: 'primary',
      width: 156,
      height: 44,
      onClick: () => {
        const res =
          config.type === 'Quantity'
            ? this.quantityVal
            : config.type === 'TextPrompt'
            ? this.textVal
            : true;
        this.closeWithTween(() => config.onConfirm?.(res));
      },
    });
    confirmBtn.position.set(targetW - 172, btnY);
    card.addChild(confirmBtn);
    this.focusManager.register({
      container: confirmBtn,
      width: 156,
      height: 44,
      onActivate: () => {
        const res =
          config.type === 'Quantity'
            ? this.quantityVal
            : config.type === 'TextPrompt'
            ? this.textVal
            : true;
        this.closeWithTween(() => config.onConfirm?.(res));
      },
    });
  }

  public closeWithTween(cb?: () => void): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.onCloseFinish = cb;
  }

  /**
   * Animación de entrada y salida de 180 ms con easeOutCubic
   */
  public updateTween(dt: number): void {
    const speed = 1 / 0.18; // ~180 ms
    if (!this.isClosing) {
      if (this.animProgress < 1) {
        this.animProgress = Math.min(1, this.animProgress + dt * speed);
        const ease = 1 - Math.pow(1 - this.animProgress, 3);
        this.alpha = ease;
        this.panelRoot.scale.set(0.92 + 0.08 * ease);
      }
    } else {
      this.animProgress = Math.max(0, this.animProgress - dt * speed);
      this.alpha = this.animProgress;
      this.panelRoot.scale.set(0.92 + 0.08 * this.animProgress);
      if (this.animProgress <= 0) {
        const fn = this.onCloseFinish;
        this.onCloseFinish = undefined;
        fn?.();
      }
    }
  }
}
