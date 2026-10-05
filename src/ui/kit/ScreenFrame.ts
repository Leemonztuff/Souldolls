import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS, SPACING, RADII } from '../styles';
import { KitButton, KitCurrencyChip } from './KitPrimitives';
import { KitIconId } from './icons/IconRegistry';

export interface ScreenFrameAction {
  label: string;
  iconId?: KitIconId;
  onClick: () => void;
  disabled?: boolean;
}

export interface ScreenFrameConfig {
  width: number;
  height: number;
  title: string;
  currencies?: Array<{ iconId: KitIconId; value: number | string }>;
  onClose?: () => void;
  secondaryAction?: ScreenFrameAction;
  primaryAction?: ScreenFrameAction;
}

/**
 * BLOQUE 41 Req 3 & 4: Anatomía común de cualquier pantalla (ScreenFrame).
 * - Barra superior de madera tallada con marco de bronce (título en Cinzel, chips de monedas opcionales, botón cerrar).
 * - Área central de contenido con soporte de scroll vertical con inercia y máscara.
 * - Barra inferior de acciones: botón Secundario/Cancelar a la izquierda y un único botón Primario a la derecha.
 */
export class ScreenFrame extends Container {
  public readonly contentRoot: Container = new Container();
  public readonly contentWidth: number;
  public readonly contentHeight: number;
  public readonly isTwoColumn: boolean;

  private scrollMask: Graphics = new Graphics();
  private scrollY = 0;
  private maxScrollY = 0;
  private velocityY = 0;
  private dragLastY: number | null = null;

  constructor(config: ScreenFrameConfig) {
    super();
    this.roundPixels = true;

    const w = Math.round(config.width);
    const h = Math.round(config.height);
    this.isTwoColumn = w >= 720;

    // 1. Carved Wood & Crypt Backdrop
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    bg.roundRect(4, 4, w - 8, h - 8, RADII.lg);
    bg.stroke({ color: COLOR_NUM.bronze, width: 3 });
    bg.roundRect(7, 7, w - 14, h - 14, RADII.md);
    bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.55 });
    bg.eventMode = 'static';
    this.addChild(bg);

    // 2. Top Wooden Header Bar
    const headerH = 56;
    const header = new Container();
    header.roundPixels = true;
    header.position.set(8, 8);
    this.addChild(header);

    const headerW = w - 16;
    const hBg = new Graphics();
    hBg.roundRect(0, 0, headerW, headerH, RADII.md);
    hBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    hBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    header.addChild(hBg);

    const titleTxt = new Text({
      text: config.title.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 20,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    titleTxt.roundPixels = true;
    titleTxt.anchor.set(0, 0.5);
    titleTxt.position.set(16, Math.round(headerH / 2));
    header.addChild(titleTxt);

    let rightCursor = headerW - 8;
    if (config.onClose) {
      const closeBtn = new KitButton({
        iconId: 'close',
        variant: 'danger',
        width: 44,
        height: 44,
        onClick: config.onClose,
      });
      closeBtn.position.set(rightCursor - 44, 6);
      header.addChild(closeBtn);
      rightCursor -= 52;
    }

    if (config.currencies && config.currencies.length > 0) {
      for (let i = config.currencies.length - 1; i >= 0; i--) {
        const cur = config.currencies[i];
        const chip = new KitCurrencyChip(cur.iconId, cur.value, 92);
        chip.position.set(rightCursor - 92, 14);
        header.addChild(chip);
        rightCursor -= 98;
      }
    }

    // 3. Bottom Action Bar (Secondary on Left, Single Primary on Right)
    const hasFooter = Boolean(config.secondaryAction || config.primaryAction);
    const footerH = hasFooter ? 56 : 0;
    const footerY = h - 8 - footerH;

    if (hasFooter) {
      const footer = new Container();
      footer.roundPixels = true;
      footer.position.set(8, footerY);
      this.addChild(footer);

      const fBg = new Graphics();
      fBg.roundRect(0, 0, headerW, footerH, RADII.md);
      fBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
      fBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      footer.addChild(fBg);

      if (config.secondaryAction) {
        const secBtn = new KitButton({
          label: config.secondaryAction.label,
          iconId: config.secondaryAction.iconId,
          variant: 'secondary',
          width: 156,
          height: 44,
          disabled: config.secondaryAction.disabled,
          onClick: config.secondaryAction.onClick,
        });
        secBtn.position.set(8, 6);
        footer.addChild(secBtn);
      }

      if (config.primaryAction) {
        const priBtn = new KitButton({
          label: config.primaryAction.label,
          iconId: config.primaryAction.iconId,
          variant: 'primary',
          width: 172,
          height: 44,
          disabled: config.primaryAction.disabled,
          onClick: config.primaryAction.onClick,
        });
        priBtn.position.set(headerW - 180, 6);
        footer.addChild(priBtn);
      }
    }

    // 4. Scrollable Content Area with Mask & Inertia
    const contentX = 12;
    const contentY = 8 + headerH + SPACING.sm;
    this.contentWidth = w - 24;
    this.contentHeight = (hasFooter ? footerY - SPACING.sm : h - 12) - contentY;

    const viewport = new Container();
    viewport.roundPixels = true;
    viewport.position.set(contentX, contentY);
    this.addChild(viewport);

    this.scrollMask.rect(0, 0, this.contentWidth, this.contentHeight);
    this.scrollMask.fill({ color: COLOR_NUM.white });
    viewport.addChild(this.scrollMask);

    this.contentRoot.roundPixels = true;
    this.contentRoot.mask = this.scrollMask;
    viewport.addChild(this.contentRoot);

    viewport.eventMode = 'static';
    viewport.on('pointerdown', (e) => {
      this.dragLastY = e.global.y;
      this.velocityY = 0;
    });
    viewport.on('pointermove', (e) => {
      if (this.dragLastY !== null && this.maxScrollY > 0) {
        const dy = e.global.y - this.dragLastY;
        this.dragLastY = e.global.y;
        this.velocityY = dy;
        this.setScroll(this.scrollY - dy);
      }
    });
    viewport.on('pointerup', () => {
      this.dragLastY = null;
    });
    viewport.on('pointerupoutside', () => {
      this.dragLastY = null;
    });
  }

  public setContentTotalHeight(totalH: number): void {
    this.maxScrollY = Math.max(0, Math.round(totalH - this.contentHeight));
    this.setScroll(this.scrollY);
  }

  public setScroll(newScrollY: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, Math.round(newScrollY)));
    this.contentRoot.position.y = -this.scrollY;
  }

  public updateInertia(): void {
    if (this.dragLastY === null && Math.abs(this.velocityY) > 0.5 && this.maxScrollY > 0) {
      this.setScroll(this.scrollY - this.velocityY);
      this.velocityY *= 0.9;
    }
  }
}
