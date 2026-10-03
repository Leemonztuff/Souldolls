import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, COLOR_SEMANTIC, FONTS } from '../../../ui/styles';

export interface ProgressBarConfig {
  width: number;
  height: number;
  type: 'hp' | 'exp' | 'ki';
  value: number; // 0 to 1
  maxValue?: number;
  currentValue?: number;
  showText?: boolean;
}

export class ThemeProgressBar extends Container {
  private config: ProgressBarConfig;
  private bgGraphics: Graphics;
  private barGraphics: Graphics;
  private valueText?: Text;

  constructor(config: ProgressBarConfig) {
    super();
    this.config = config;

    this.bgGraphics = new Graphics();
    this.addChild(this.bgGraphics);

    this.barGraphics = new Graphics();
    this.addChild(this.barGraphics);

    if (config.showText) {
      this.valueText = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: Math.max(9, config.height - 4),
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
          stroke: { color: COLOR_HEX.inkCrypt, width: 2.5 },
        }),
      });
      this.valueText.anchor.set(1, 0.5);
      this.valueText.position.set(config.width - 6, config.height / 2);
      this.addChild(this.valueText);
    }

    this.draw();
  }

  public setValue(val: number, current?: number, max?: number): void {
    this.config.value = Math.max(0, Math.min(1, val));
    if (current !== undefined) this.config.currentValue = current;
    if (max !== undefined) this.config.maxValue = max;
    this.draw();
  }

  private draw(): void {
    const w = this.config.width;
    const h = this.config.height;
    const val = this.config.value;

    this.bgGraphics.clear();
    this.barGraphics.clear();

    // 1. Draw outer brass frame
    this.bgGraphics.roundRect(0, 0, w, h, 4);
    this.bgGraphics.fill({ color: COLOR_NUM.smokedWood });
    this.bgGraphics.stroke({ color: COLOR_NUM.bronze, width: 1.5 });

    // 2. Draw progress fill
    if (val > 0) {
      let fillColor = COLOR_NUM.cyan;
      if (this.config.type === 'hp') {
        if (val > 0.5) fillColor = COLOR_SEMANTIC.ok; // Green
        else if (val > 0.2) fillColor = COLOR_SEMANTIC.warning; // Yellow
        else fillColor = COLOR_SEMANTIC.danger; // Red
      } else if (this.config.type === 'exp') {
        fillColor = COLOR_NUM.soulViolet;
      } else if (this.config.type === 'ki') {
        fillColor = COLOR_NUM.cyan;
      }

      const fillW = Math.max(2, (w - 4) * val);
      
      // Shadow / Backing glow inside the bar
      this.barGraphics.roundRect(2, 2, fillW, h - 4, 2);
      this.barGraphics.fill({ color: fillColor });

      // Shiny highlight line at top of bar
      this.barGraphics.rect(2, 2, fillW, 2);
      this.barGraphics.fill({ color: COLOR_NUM.white, alpha: 0.35 });
    }

    // 3. Update Text label
    if (this.valueText && this.config.currentValue !== undefined && this.config.maxValue !== undefined) {
      this.valueText.text = `${this.config.currentValue}/${this.config.maxValue}`;
    }
  }
}
