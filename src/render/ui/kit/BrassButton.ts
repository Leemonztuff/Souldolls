import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GlobalTheme } from '../../../data/theme/ThemeManager';
import { GlobalAudioService } from '../../../services/AudioService';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../../../ui/styles';

export interface BrassButtonConfig {
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  fontSize?: number;
  useKiGlow?: boolean;
}

export class BrassButton extends Container {
  private bgGraphics: Graphics;
  private labelText: Text;
  private onClickHandler: () => void;
  private isDisabled: boolean;
  private isHovered = false;
  private isPressed = false;
  private buttonWidth: number;
  private buttonHeight: number;
  private useKiGlow: boolean;

  constructor(config: BrassButtonConfig) {
    super();

    this.buttonWidth = config.width;
    this.buttonHeight = config.height;
    this.onClickHandler = config.onClick;
    this.isDisabled = !!config.disabled;
    this.useKiGlow = !!config.useKiGlow;

    this.eventMode = 'static';
    this.cursor = this.isDisabled ? 'not-allowed' : 'pointer';

    // Interactive Listeners
    this.on('pointerover', this.onPointerOver.bind(this));
    this.on('pointerout', this.onPointerOut.bind(this));
    this.on('pointerdown', this.onPointerDown.bind(this));
    this.on('pointerup', this.onPointerUp.bind(this));
    this.on('pointerupoutside', this.onPointerUpOutside.bind(this));

    // Base background & border graphics
    this.bgGraphics = new Graphics();
    this.addChild(this.bgGraphics);

    // Label Text
    this.labelText = new Text({
      text: config.label,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: config.fontSize || 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.white,
        letterSpacing: 1,
      }),
    });
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(this.buttonWidth / 2, this.buttonHeight / 2);
    this.addChild(this.labelText);

    this.renderState();
  }

  public setDisabled(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cursor = this.isDisabled ? 'not-allowed' : 'pointer';
    this.renderState();
  }

  private renderState(): void {
    this.bgGraphics.clear();

    const radius = 6;
    let mainColor = COLOR_NUM.bronze;
    let borderColor = COLOR_NUM.gold;
    let alpha = 0.95;
    let textColor = COLOR_HEX.parchment;

    if (this.isDisabled) {
      mainColor = COLOR_NUM.disabledBg;
      borderColor = COLOR_NUM.disabledBorder;
      textColor = COLOR_HEX.disabledText;
    } else if (this.isPressed) {
      // Pressed state (darker bronze / metallic look)
      mainColor = GlobalTheme.hexToNumber(GlobalTheme.adjustColor(COLOR_HEX.bronze, -20));
      borderColor = COLOR_NUM.gold;
      textColor = COLOR_HEX.white;
    } else if (this.isHovered) {
      // Hover state (brighter gold gleam)
      mainColor = GlobalTheme.hexToNumber(GlobalTheme.adjustColor(COLOR_HEX.bronze, 15));
      borderColor = COLOR_NUM.white;
      textColor = COLOR_HEX.white;
    }

    // Outer Glow / Shadow
    if (this.isHovered && !this.isDisabled) {
      const glowColor = this.useKiGlow ? COLOR_NUM.cyan : COLOR_NUM.gold;
      this.bgGraphics.roundRect(-2, -2, this.buttonWidth + 4, this.buttonHeight + 4, radius + 2);
      this.bgGraphics.fill({ color: glowColor, alpha: 0.25 });
    }

    // Main Fill
    this.bgGraphics.roundRect(0, 0, this.buttonWidth, this.buttonHeight, radius);
    this.bgGraphics.fill({ color: mainColor, alpha });
    
    // Outer Border
    this.bgGraphics.roundRect(0, 0, this.buttonWidth, this.buttonHeight, radius);
    this.bgGraphics.stroke({ color: borderColor, width: 2 });

    // Inner Hairline Highlights (brass shine)
    if (!this.isDisabled) {
      this.bgGraphics.roundRect(2, 2, this.buttonWidth - 4, this.buttonHeight - 4, radius - 1);
      this.bgGraphics.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: this.isHovered ? 0.4 : 0.2 });
    }

    this.labelText.style.fill = textColor;
  }

  private onPointerOver(): void {
    if (this.isDisabled) return;
    this.isHovered = true;
    GlobalAudioService.playSfx('select');
    this.renderState();
  }

  private onPointerOut(): void {
    this.isHovered = false;
    this.isPressed = false;
    this.renderState();
  }

  private onPointerDown(): void {
    if (this.isDisabled) return;
    this.isPressed = true;
    this.renderState();
  }

  private onPointerUp(): void {
    if (this.isDisabled || !this.isPressed) return;
    this.isPressed = false;
    this.renderState();
    
    // Play wood/glass mechanical click sound corresponding to our brand
    GlobalAudioService.playSfx('confirm');
    this.onClickHandler();
  }

  private onPointerUpOutside(): void {
    this.isPressed = false;
    this.renderState();
  }
}
