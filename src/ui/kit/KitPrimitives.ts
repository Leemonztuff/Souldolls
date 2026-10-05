import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  COLOR_NUM,
  COLOR_HEX,
  COLOR_SEMANTIC,
  COLOR_STATS,
  COLOR_RARITY,
  COLOR_ELEMENT,
  FONTS,
  SPACING,
  RADII,
} from '../styles';
import { IconRegistry, KitIconId } from './icons/IconRegistry';
import { GlobalAudioService } from '../../services/AudioService';
import { HumanoidPartSilhouette } from '../../render/ui/HumanoidPartSilhouette';

// ============================================================================
// 1. CARD, CARD TITLE, ORNAMENTAL DIVIDER
// ============================================================================
export interface KitCardConfig {
  width: number;
  height: number;
  variant?: 'parchment' | 'smokedWood' | 'inkCrypt';
  title?: string;
  showCorners?: boolean;
}

export class KitCard extends Container {
  private bg: Graphics = new Graphics();

  constructor(config: KitCardConfig) {
    super();
    this.roundPixels = true;

    const w = Math.round(config.width);
    const h = Math.round(config.height);
    const fillCol =
      config.variant === 'parchment'
        ? COLOR_NUM.parchment
        : config.variant === 'inkCrypt'
        ? COLOR_NUM.inkCrypt
        : COLOR_NUM.smokedWood;

    this.bg.roundRect(0, 0, w, h, RADII.md);
    this.bg.fill({ color: fillCol, alpha: 0.96 });
    this.bg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });

    // Inner gold hairline
    this.bg.roundRect(3, 3, w - 6, h - 6, RADII.sm);
    this.bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.65 });

    // Ornamental corners
    if (config.showCorners !== false) {
      const cs = 10;
      const corners = [
        { x: 3, y: 3, dx: 1, dy: 1 },
        { x: w - 3, y: 3, dx: -1, dy: 1 },
        { x: 3, y: h - 3, dx: 1, dy: -1 },
        { x: w - 3, y: h - 3, dx: -1, dy: -1 },
      ];
      corners.forEach((c) => {
        this.bg.moveTo(c.x, c.y);
        this.bg.lineTo(c.x + cs * c.dx, c.y);
        this.bg.lineTo(c.x, c.y + cs * c.dy);
        this.bg.closePath();
        this.bg.fill({ color: COLOR_NUM.gold, alpha: 0.3 });
      });
    }

    this.addChild(this.bg);

    if (config.title) {
      const titleComp = new KitCardTitle(
        config.title,
        w - 16,
        config.variant === 'parchment' ? 'dark' : 'gold'
      );
      titleComp.position.set(8, 8);
      this.addChild(titleComp);
    }
  }
}

export class KitCardTitle extends Container {
  constructor(text: string, maxWidth = 240, tone: 'gold' | 'dark' | 'parchment' = 'gold') {
    super();
    this.roundPixels = true;

    const fillHex =
      tone === 'dark'
        ? COLOR_HEX.inkCrypt
        : tone === 'parchment'
        ? COLOR_HEX.parchment
        : COLOR_HEX.gold;

    const lbl = new Text({
      text: text.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 16,
        fontWeight: 'bold',
        fill: fillHex,
      }),
    });
    lbl.roundPixels = true;
    if (lbl.width > maxWidth) {
      lbl.style.fontSize = 14;
    }
    this.addChild(lbl);
  }
}

export class KitDivider extends Container {
  constructor(width: number) {
    super();
    this.roundPixels = true;
    const g = new Graphics();
    const mid = Math.round(width / 2);
    g.moveTo(0, 4).lineTo(mid - 8, 4);
    g.moveTo(mid + 8, 4).lineTo(width, 4);
    g.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    // Center diamond
    g.poly([
      { x: mid, y: 0 },
      { x: mid + 5, y: 4 },
      { x: mid, y: 8 },
      { x: mid - 5, y: 4 },
    ]);
    g.fill({ color: COLOR_NUM.gold });
    this.addChild(g);
  }
}

// ============================================================================
// 2. BUTTON (primary, secondary, danger, icon) - min touch target 44x44
// ============================================================================
export type KitButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon';

export interface KitButtonConfig {
  label?: string;
  iconId?: KitIconId;
  variant?: KitButtonVariant;
  width?: number;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  onClick: () => void;
}

export class KitButton extends Container {
  private bg: Graphics = new Graphics();
  private labelText?: Text;
  private isHovered = false;
  private isPressed = false;
  private isFocused = false;
  private isDisabled: boolean;
  private btnW: number;
  private btnH: number;
  private variant: KitButtonVariant;
  private onClickCb: () => void;

  constructor(config: KitButtonConfig) {
    super();
    this.roundPixels = true;
    this.variant = config.variant || 'secondary';
    this.btnW = Math.max(SPACING.minTouchTarget, Math.round(config.width || (this.variant === 'icon' ? 44 : 136)));
    this.btnH = Math.max(SPACING.minTouchTarget, Math.round(config.height || 44));
    this.isDisabled = Boolean(config.disabled);
    this.onClickCb = config.onClick;

    this.eventMode = 'static';
    this.cursor = this.isDisabled ? 'not-allowed' : 'pointer';

    this.addChild(this.bg);

    const content = new Container();
    content.roundPixels = true;
    this.addChild(content);

    let offsetX = 0;
    if (config.iconId) {
      const icon = IconRegistry.create(config.iconId, 16);
      if (config.label) {
        icon.position.set(12, Math.round((this.btnH - 16) / 2));
        offsetX = 28;
      } else {
        icon.position.set(Math.round((this.btnW - 16) / 2), Math.round((this.btnH - 16) / 2));
      }
      content.addChild(icon);
    }

    if (config.label) {
      const hasParentheses = config.label.includes('(') || config.label.includes(')');
      this.labelText = new Text({
        text: config.label.toUpperCase(),
        style: new TextStyle({
          fontFamily: hasParentheses ? FONTS.body : FONTS.hud,
          fontSize: config.fontSize || 14,
          fontWeight: 'bold',
          fill: this.isDisabled ? COLOR_HEX.disabledText : COLOR_HEX.parchment,
        }),
      });
      this.labelText.roundPixels = true;
      if (config.iconId) {
        this.labelText.anchor.set(0.5);
        const textAreaLeft = 34;
        const textAreaRight = this.btnW - 8;
        const textAreaW = Math.max(24, textAreaRight - textAreaLeft);
        if (this.labelText.width > textAreaW) {
          this.labelText.style.fontSize = 12;
        }
        this.labelText.position.set(
          Math.round(textAreaLeft + textAreaW / 2),
          Math.round(this.btnH / 2)
        );
      } else {
        this.labelText.anchor.set(0.5);
        this.labelText.position.set(Math.round(this.btnW / 2 + offsetX / 2), Math.round(this.btnH / 2));
      }
      content.addChild(this.labelText);
    }

    this.on('pointerover', () => {
      if (this.isDisabled) return;
      this.isHovered = true;
      GlobalAudioService.playSfx('select');
      this.draw();
    });
    this.on('pointerout', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.draw();
    });
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      if (this.isDisabled) {
        GlobalAudioService.playSfx('cancel');
        return;
      }
      this.isPressed = true;
      this.draw();
    });
    this.on('pointerup', (e) => {
      e.stopPropagation();
      if (this.isDisabled || !this.isPressed) return;
      this.isPressed = false;
      this.draw();
      GlobalAudioService.playSfx('confirm');
      config.onClick();
    });

    this.draw();
  }

  public setFocused(focused: boolean): void {
    this.isFocused = focused;
    this.draw();
  }

  public setDisabled(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cursor = disabled ? 'not-allowed' : 'pointer';
    if (this.labelText) {
      this.labelText.style.fill = disabled ? COLOR_HEX.disabledText : COLOR_HEX.parchment;
    }
    this.draw();
  }

  public toFocusable() {
    return {
      container: this,
      width: this.btnW,
      height: this.btnH,
      disabled: this.isDisabled,
      onActivate: () => this.onClickCb(),
    };
  }

  private draw(): void {
    this.bg.clear();

    let fillCol = COLOR_NUM.bronze;
    let borderCol = COLOR_NUM.gold;

    if (this.isDisabled) {
      fillCol = COLOR_NUM.disabledBg;
      borderCol = COLOR_NUM.disabledBorder;
    } else if (this.variant === 'primary') {
      fillCol = this.isPressed ? COLOR_NUM.smokedWood : COLOR_NUM.bronze;
      borderCol = this.isHovered ? COLOR_NUM.cyan : COLOR_NUM.gold;
    } else if (this.variant === 'danger') {
      fillCol = COLOR_NUM.rift;
      borderCol = COLOR_NUM.gold;
    } else {
      fillCol = COLOR_NUM.smokedWood;
      borderCol = this.isHovered ? COLOR_NUM.gold : COLOR_NUM.bronze;
    }

    if (this.isFocused && !this.isDisabled) {
      this.bg.roundRect(-3, -3, this.btnW + 6, this.btnH + 6, RADII.md + 2);
      this.bg.stroke({ color: COLOR_NUM.gold, width: 2.5 });
    }

    this.bg.roundRect(0, 0, this.btnW, this.btnH, RADII.md);
    this.bg.fill({ color: fillCol, alpha: 0.96 });
    this.bg.stroke({ color: borderCol, width: 2 });

    if (!this.isDisabled) {
      this.bg.roundRect(2, 2, this.btnW - 4, this.btnH - 4, RADII.sm);
      this.bg.stroke({ color: COLOR_NUM.white, width: 1, alpha: this.isHovered ? 0.35 : 0.15 });
    }
  }
}

// ============================================================================
// 3. TAB BAR
// ============================================================================
export interface KitTabItem {
  id: string;
  label: string;
  iconId?: KitIconId;
}

export interface KitTabBarConfig {
  tabs: KitTabItem[];
  activeId: string;
  width: number;
  absX?: number;
  onSelect: (id: string) => void;
}

export class KitTabBar extends Container {
  constructor(
    tabsOrConfig: KitTabItem[] | KitTabBarConfig,
    activeIdArg?: string,
    totalWidthArg?: number,
    onSelectArg?: (id: string) => void
  ) {
    super();
    this.roundPixels = true;

    const isObj =
      !Array.isArray(tabsOrConfig) && typeof tabsOrConfig === 'object' && tabsOrConfig !== null;
    const tabs: KitTabItem[] = isObj ? tabsOrConfig.tabs || [] : tabsOrConfig || [];
    const activeId = isObj ? tabsOrConfig.activeId : activeIdArg || '';
    const totalWidth = isObj ? tabsOrConfig.width : totalWidthArg ?? 320;
    const onSelect = isObj ? tabsOrConfig.onSelect : onSelectArg || (() => {});

    const gap = SPACING.xs;
    const tabW = Math.floor((totalWidth - gap * (tabs.length - 1)) / Math.max(1, tabs.length));

    tabs.forEach((t, idx) => {
      const isAct = t.id === activeId;
      const btn = new KitButton({
        label: t.label,
        iconId: t.iconId,
        variant: isAct ? 'primary' : 'secondary',
        width: tabW,
        height: 44,
        onClick: () => onSelect(t.id),
      });
      btn.position.set(idx * (tabW + gap), 0);
      this.addChild(btn);
    });
  }
}

// ============================================================================
// 4. LIST ROW (icon, title, subtitle, value, chevron)
// ============================================================================
export interface KitListRowConfig {
  width: number;
  height?: number;
  iconId?: KitIconId;
  title: string;
  subtitle?: string;
  value?: string;
  valueText?: string;
  selected?: boolean;
  onClick?: () => void;
}

export class KitListRow extends Container {
  constructor(config: KitListRowConfig) {
    super();
    this.roundPixels = true;

    const w = Math.round(config.width);
    const h = Math.max(SPACING.minTouchTarget, Math.round(config.height || 52));

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, RADII.md);
    bg.fill({ color: config.selected ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({
      color: config.selected ? COLOR_NUM.gold : COLOR_NUM.bronze,
      width: config.selected ? 2.5 : 1.5,
    });
    this.addChild(bg);

    let textX = 12;
    if (config.iconId) {
      const ic = IconRegistry.create(config.iconId, 20);
      ic.position.set(10, Math.round((h - 20) / 2));
      this.addChild(ic);
      textX = 38;
    }

    const titleTxt = new Text({
      text: config.title,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    titleTxt.roundPixels = true;
    titleTxt.position.set(textX, config.subtitle ? 6 : Math.round((h - 18) / 2));
    this.addChild(titleTxt);

    if (config.subtitle) {
      const subTxt = new Text({
        text: config.subtitle,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.smoke,
        }),
      });
      subTxt.roundPixels = true;
      subTxt.position.set(textX, 26);
      this.addChild(subTxt);
    }

    const valStr = config.value ?? config.valueText;
    if (valStr) {
      const valTxt = new Text({
        text: valStr,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.gold,
        }),
      });
      valTxt.roundPixels = true;
      valTxt.anchor.set(1, 0.5);
      valTxt.position.set(w - 28, Math.round(h / 2));
      this.addChild(valTxt);
    }

    const chev = IconRegistry.create('chevron_right', 14);
    chev.position.set(w - 20, Math.round((h - 14) / 2));
    this.addChild(chev);

    if (config.onClick) {
      this.eventMode = 'static';
      this.cursor = 'pointer';
      this.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('confirm');
        config.onClick!();
      });
    }
  }
}

// ============================================================================
// 5. STEPPER (+/-), TOGGLE, SLIDER, DROPDOWN, TEXT INPUT
// ============================================================================
export interface KitStepperConfig {
  label?: string;
  value?: number;
  valueText?: string;
  min?: number;
  max?: number;
  width?: number;
  onChange?: (newVal: number) => void;
  onStep?: (dir: -1 | 1) => void;
}

export class KitStepper extends Container {
  constructor(
    labelOrConfig: string | KitStepperConfig,
    valueTextArg?: string,
    widthArg?: number,
    onStepArg?: (dir: -1 | 1) => void
  ) {
    super();
    this.roundPixels = true;

    const isObj = typeof labelOrConfig === 'object' && labelOrConfig !== null;
    const label = isObj ? labelOrConfig.label || '' : labelOrConfig;
    const width = isObj ? labelOrConfig.width ?? 140 : widthArg ?? 220;
    const valueText = isObj
      ? labelOrConfig.valueText ?? `x${labelOrConfig.value ?? 1}`
      : valueTextArg ?? '';
    const onStep: (dir: -1 | 1) => void = isObj
      ? labelOrConfig.onStep ||
        ((dir: -1 | 1) => {
          const cur = labelOrConfig.value ?? 1;
          const min = labelOrConfig.min ?? 1;
          const max = labelOrConfig.max ?? 99;
          const next = Math.max(min, Math.min(max, cur + dir));
          if (labelOrConfig.onChange) labelOrConfig.onChange(next);
        })
      : onStepArg || (() => {});

    const h = 44;
    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    this.addChild(bg);

    if (label) {
      const lbl = new Text({
        text: label,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      lbl.roundPixels = true;
      lbl.position.set(12, 12);
      this.addChild(lbl);
    }

    const compact = !label || width <= 160;
    const minusX = compact ? 0 : width - 156;
    const valX = compact ? Math.round(width / 2) : width - 84;
    const plusX = width - 44;

    const minusBtn = new KitButton({
      iconId: 'chevron_left',
      variant: 'icon',
      width: 44,
      height: 44,
      onClick: () => onStep(-1),
    });
    minusBtn.position.set(minusX, 0);
    this.addChild(minusBtn);

    const val = new Text({
      text: valueText,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    val.roundPixels = true;
    val.anchor.set(0.5);
    val.position.set(valX, 22);
    this.addChild(val);

    const plusBtn = new KitButton({
      iconId: 'chevron_right',
      variant: 'icon',
      width: 44,
      height: 44,
      onClick: () => onStep(1),
    });
    plusBtn.position.set(plusX, 0);
    this.addChild(plusBtn);
  }
}

export class KitToggle extends Container {
  constructor(label: string, checked: boolean, width: number, onChange: (val: boolean) => void) {
    super();
    this.roundPixels = true;

    const h = 44;
    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    this.addChild(bg);

    const lbl = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    lbl.roundPixels = true;
    lbl.position.set(12, 12);
    this.addChild(lbl);

    const pillW = 64;
    const pillH = 28;
    const pillX = width - pillW - 10;
    const pillY = 8;

    const track = new Graphics();
    track.roundRect(pillX, pillY, pillW, pillH, 14);
    track.fill({ color: checked ? COLOR_SEMANTIC.ok : COLOR_NUM.disabledBg });
    track.stroke({ color: COLOR_NUM.gold, width: 1.5 });

    const knobX = checked ? pillX + pillW - 14 : pillX + 14;
    track.circle(knobX, pillY + 14, 10);
    track.fill({ color: COLOR_NUM.parchment });
    this.addChild(track);

    const stateIcon = IconRegistry.create(checked ? 'check' : 'close', 12);
    stateIcon.position.set(checked ? pillX + 8 : pillX + pillW - 22, pillY + 8);
    this.addChild(stateIcon);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      GlobalAudioService.playSfx('confirm');
      onChange(!checked);
    });
  }
}

export class KitSlider extends Container {
  constructor(
    label: string,
    ratio01: number,
    width: number,
    onChange: (newRatio: number) => void
  ) {
    super();
    this.roundPixels = true;

    const h = 44;
    const clamped = Math.max(0, Math.min(1, ratio01));

    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    this.addChild(bg);

    const lbl = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    lbl.roundPixels = true;
    lbl.position.set(12, 12);
    this.addChild(lbl);

    const barX = Math.round(width * 0.48);
    const barW = Math.max(60, width - barX - 58);
    const barY = 17;

    const track = new Graphics();
    track.roundRect(barX, barY, barW, 10, 4);
    track.fill({ color: COLOR_NUM.smokedWood });
    track.stroke({ color: COLOR_NUM.bronze, width: 1 });
    if (clamped > 0) {
      track.roundRect(barX + 1, barY + 1, Math.max(4, Math.round((barW - 2) * clamped)), 8, 3);
      track.fill({ color: COLOR_NUM.cyan });
    }
    track.circle(barX + Math.round(barW * clamped), barY + 5, 8);
    track.fill({ color: COLOR_NUM.gold });
    track.stroke({ color: COLOR_NUM.inkCrypt, width: 1.5 });
    this.addChild(track);

    const pctTxt = new Text({
      text: `${Math.round(clamped * 100)}%`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    pctTxt.roundPixels = true;
    pctTxt.anchor.set(1, 0.5);
    pctTxt.position.set(width - 8, 22);
    this.addChild(pctTxt);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      const local = this.toLocal(e.global);
      const r = Math.max(0, Math.min(1, (local.x - barX) / barW));
      GlobalAudioService.playSfx('select');
      onChange(Number(r.toFixed(2)));
    });
  }
}

export class KitDropdown extends Container {
  constructor(
    label: string,
    options: string[],
    selectedIndex: number,
    width: number,
    onSelect: (newIdx: number) => void
  ) {
    super();
    this.roundPixels = true;
    const curVal = options[selectedIndex] || options[0] || '';
    const stepper = new KitStepper(label, curVal, width, (dir) => {
      const next = (selectedIndex + dir + options.length) % Math.max(1, options.length);
      onSelect(next);
    });
    this.addChild(stepper);
  }
}

export class KitTextInput extends Container {
  constructor(
    label: string,
    value: string,
    placeholder: string,
    width: number,
    onTriggerEdit: () => void
  ) {
    super();
    this.roundPixels = true;
    const h = 44;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    this.addChild(bg);

    const lbl = new Text({
      text: `${label}:`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.smoke,
      }),
    });
    lbl.roundPixels = true;
    lbl.position.set(12, 12);
    this.addChild(lbl);

    const val = new Text({
      text: value || placeholder,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: value ? COLOR_HEX.parchment : COLOR_HEX.disabledText,
      }),
    });
    val.roundPixels = true;
    val.position.set(16 + lbl.width, 12);
    this.addChild(val);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      GlobalAudioService.playSfx('confirm');
      onTriggerEdit();
    });
  }
}

// ============================================================================
// 6. STAT BOX, BAR, BADGE, STARS, HEARTS, PARTS SILHOUETTE
// ============================================================================
export interface KitStatBoxConfig {
  statKey?: keyof typeof COLOR_STATS;
  statId?: keyof typeof COLOR_STATS;
  label: string;
  value: number;
  width: number;
  height: number;
  modifierSymbol?: string;
  onClick?: () => void;
}

export class KitStatBox extends Container {
  constructor(
    statIdOrConfig: keyof typeof COLOR_STATS | KitStatBoxConfig,
    labelArg?: string,
    valueArg?: number,
    widthArg?: number,
    heightArg?: number,
    modifierSymbolArg?: string,
    onClickArg?: () => void
  ) {
    super();
    this.roundPixels = true;

    const isObj = typeof statIdOrConfig === 'object' && statIdOrConfig !== null;
    const statId: keyof typeof COLOR_STATS = isObj
      ? statIdOrConfig.statKey || statIdOrConfig.statId || 'hp'
      : statIdOrConfig;
    const label = isObj ? statIdOrConfig.label : labelArg || '';
    const value = isObj ? statIdOrConfig.value : valueArg ?? 0;
    const width = isObj ? statIdOrConfig.width : widthArg ?? 96;
    const height = isObj ? statIdOrConfig.height : heightArg ?? 52;
    const modifierSymbol = isObj ? statIdOrConfig.modifierSymbol : modifierSymbolArg;
    const onClick = isObj ? statIdOrConfig.onClick : onClickArg;

    const pal = COLOR_STATS[statId] || COLOR_STATS.hp;
    const g = new Graphics();
    g.roundRect(0, 0, width, height, RADII.sm);
    g.fill({ color: pal.bg, alpha: 0.96 });
    g.stroke({ color: pal.border, width: 1.5 });
    this.addChild(g);

    const hasSpecialPunctuation = label.includes('(') || label.includes(')') || label.includes('.');
    const lbl = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: hasSpecialPunctuation ? FONTS.body : FONTS.hud,
        fontSize: 14,
        fontWeight: 'bold',
        fill: pal.labelHex,
      }),
    });
    lbl.roundPixels = true;
    lbl.position.set(8, 4);
    this.addChild(lbl);

    if (modifierSymbol) {
      const modTxt = new Text({
        text: modifierSymbol,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.gold,
        }),
      });
      modTxt.roundPixels = true;
      modTxt.anchor.set(1, 0);
      modTxt.position.set(width - 6, 4);
      this.addChild(modTxt);
    }

    const valTxt = new Text({
      text: String(value),
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    valTxt.roundPixels = true;
    valTxt.anchor.set(1, 1);
    valTxt.position.set(width - 8, height - 4);
    this.addChild(valTxt);

    if (onClick) {
      this.eventMode = 'static';
      this.cursor = 'pointer';
      this.on('pointerdown', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
  }
}

export interface KitBarConfig {
  kind?: 'hp' | 'exp' | 'ki';
  value?: number;
  max?: number;
  ratio01?: number;
  width: number;
  height?: number;
  segments?: number;
  labelText?: string;
  showText?: boolean;
}

export class KitBar extends Container {
  constructor(
    typeOrConfig: 'hp' | 'exp' | 'ki' | KitBarConfig,
    ratio01Arg?: number,
    widthArg?: number,
    heightArg = 14,
    segmentsArg = 0,
    labelTextArg?: string
  ) {
    super();
    this.roundPixels = true;

    const isObj = typeof typeOrConfig === 'object' && typeOrConfig !== null;
    const type: 'hp' | 'exp' | 'ki' = isObj ? typeOrConfig.kind || 'hp' : typeOrConfig;
    const width = isObj ? typeOrConfig.width : widthArg ?? 120;
    const height = isObj ? typeOrConfig.height ?? 14 : heightArg;
    const segments = isObj ? typeOrConfig.segments ?? 0 : segmentsArg;
    const rawRatio = isObj
      ? typeOrConfig.ratio01 !== undefined
        ? typeOrConfig.ratio01
        : (typeOrConfig.max || 100) > 0
        ? (typeOrConfig.value ?? 0) / (typeOrConfig.max || 100)
        : 0
      : ratio01Arg ?? 0;
    const labelText = isObj
      ? typeOrConfig.labelText ||
        (typeOrConfig.showText && typeOrConfig.value !== undefined && typeOrConfig.max !== undefined
          ? `${typeOrConfig.value}/${typeOrConfig.max}`
          : undefined)
      : labelTextArg;

    const val = Math.max(0, Math.min(1, rawRatio));

    const g = new Graphics();
    g.roundRect(0, 0, width, height, RADII.sm);
    g.fill({ color: COLOR_NUM.smokedWood });
    g.stroke({ color: COLOR_NUM.bronze, width: 1.5 });

    let fillCol = COLOR_NUM.cyan;
    if (type === 'hp') {
      fillCol = val > 0.5 ? COLOR_SEMANTIC.ok : val > 0.2 ? COLOR_SEMANTIC.warning : COLOR_SEMANTIC.danger;
    } else if (type === 'exp') {
      fillCol = COLOR_NUM.soulViolet;
    }

    if (val > 0) {
      const fillW = Math.max(2, Math.round((width - 4) * val));
      g.roundRect(2, 2, fillW, height - 4, 2);
      g.fill({ color: fillCol });
    }

    if (segments > 1) {
      for (let i = 1; i < segments; i++) {
        const sx = Math.round((width / segments) * i);
        g.moveTo(sx, 2).lineTo(sx, height - 2);
        g.stroke({ color: COLOR_NUM.inkCrypt, width: 1 });
      }
    }

    this.addChild(g);

    if (labelText) {
      const txt = new Text({
        text: labelText,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      txt.roundPixels = true;
      txt.anchor.set(0.5);
      txt.position.set(Math.round(width / 2), Math.round(height / 2));
      this.addChild(txt);
    }
  }
}

export class KitBadge extends Container {
  public badgeWidth: number;

  constructor(
    label: string,
    kind: 'element' | 'rarity' | 'tier' = 'element',
    key = 'neutro'
  ) {
    super();
    this.roundPixels = true;

    let bgCol = COLOR_NUM.bronze;
    if (kind === 'element') {
      const norm = key
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') as keyof typeof COLOR_ELEMENT;
      bgCol = (COLOR_ELEMENT[norm] || COLOR_ELEMENT.neutro).primary;
    } else if (kind === 'rarity') {
      bgCol = COLOR_RARITY[key as keyof typeof COLOR_RARITY] || COLOR_RARITY.comun;
    } else {
      bgCol = COLOR_NUM.gold;
    }

    const hasParentheses = label.includes('(') || label.includes(')');
    const txt = new Text({
      text: label.toUpperCase(),
      style: new TextStyle({
        fontFamily: hasParentheses ? FONTS.body : FONTS.hud,
        fontSize: 14,
        fontWeight: 'bold',
        fill: kind === 'tier' || kind === 'rarity' ? COLOR_HEX.inkCrypt : COLOR_HEX.white,
      }),
    });
    txt.roundPixels = true;

    const w = Math.max(54, Math.round(txt.width + 16));
    this.badgeWidth = w;
    const h = 24;

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, RADII.sm);
    bg.fill({ color: bgCol });
    bg.stroke({ color: COLOR_NUM.inkCrypt, width: 1.5 });
    this.addChild(bg);

    txt.anchor.set(0.5);
    txt.position.set(Math.round(w / 2), Math.round(h / 2));
    this.addChild(txt);
  }
}

export class KitStars extends Container {
  constructor(filledCount: number, maxCount = 5, size = 14) {
    super();
    this.roundPixels = true;
    for (let i = 0; i < maxCount; i++) {
      const ic = IconRegistry.create(i < filledCount ? 'star_full' : 'star_empty', size);
      ic.position.set(i * (size + 2), 0);
      this.addChild(ic);
    }
  }
}

export class KitHearts extends Container {
  constructor(filledCount: number, maxCount = 5, size = 14) {
    super();
    this.roundPixels = true;
    for (let i = 0; i < maxCount; i++) {
      const ic = IconRegistry.create(i < filledCount ? 'heart_full' : 'heart_empty', size);
      ic.position.set(i * (size + 2), 0);
      this.addChild(ic);
    }
  }
}

export { HumanoidPartSilhouette as KitPartsSilhouette };

// ============================================================================
// 7. ITEM SLOT & CURRENCY CHIP
// ============================================================================
export class KitItemSlot extends Container {
  constructor(
    iconId: KitIconId,
    quantity: number,
    rarity: keyof typeof COLOR_RARITY = 'comun',
    onClick?: () => void
  ) {
    super();
    this.roundPixels = true;
    const size = 48;
    const borderCol = COLOR_RARITY[rarity] || COLOR_RARITY.comun;

    const bg = new Graphics();
    bg.roundRect(0, 0, size, size, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: borderCol, width: 2 });
    this.addChild(bg);

    const ic = IconRegistry.create(iconId, 22);
    ic.position.set(13, 8);
    this.addChild(ic);

    const qtyTxt = new Text({
      text: `x${quantity}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    qtyTxt.roundPixels = true;
    qtyTxt.anchor.set(1, 1);
    qtyTxt.position.set(size - 4, size - 2);
    this.addChild(qtyTxt);

    if (onClick) {
      this.eventMode = 'static';
      this.cursor = 'pointer';
      this.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        onClick();
      });
    }
  }
}

export class KitCurrencyChip extends Container {
  constructor(iconId: KitIconId, value: number | string, width = 92) {
    super();
    this.roundPixels = true;
    const h = 28;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, RADII.sm);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    this.addChild(bg);

    const ic = IconRegistry.create(iconId, 16);
    ic.position.set(6, 6);
    this.addChild(ic);

    const txt = new Text({
      text: String(value),
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    txt.roundPixels = true;
    txt.anchor.set(1, 0.5);
    txt.position.set(width - 8, 14);
    this.addChild(txt);
  }
}
