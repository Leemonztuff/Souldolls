import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../../../ui/styles';

export class ThemeTooltip extends Container {
  private bg: Graphics;
  private titleText: Text;
  private bodyText: Text;

  constructor() {
    super();
    this.visible = false;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.titleText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.titleText.position.set(10, 8);
    this.addChild(this.titleText);

    this.bodyText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 11,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: 180,
      }),
    });
    this.bodyText.position.set(10, 26);
    this.addChild(this.bodyText);
  }

  public show(title: string, content: string, x: number, y: number): void {
    this.titleText.text = title.toUpperCase();
    this.bodyText.text = content;
    this.visible = true;

    // Calculate tooltip dimensions
    const width = 200;
    const textHeight = this.bodyText.height;
    const height = 36 + textHeight;

    this.bg.clear();
    this.bg.roundRect(0, 0, width, height, 6);
    this.bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    this.bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });

    // Placement logic
    this.position.set(x, y);
  }

  public hide(): void {
    this.visible = false;
  }
}
