import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../../../ui/styles';

export interface BrassPanelConfig {
  width: number;
  height: number;
  title?: string;
  backgroundType?: 'inkCrypt' | 'smokedWood';
  showRivets?: boolean;
}

export class BrassPanel extends Container {
  private bgGraphics: Graphics;
  private borderGraphics: Graphics;
  private titleText?: Text;

  constructor(config: BrassPanelConfig) {
    super();

    const bgColor = config.backgroundType === 'smokedWood' 
      ? COLOR_NUM.smokedWood 
      : COLOR_NUM.inkCrypt;

    // Background
    this.bgGraphics = new Graphics();
    this.bgGraphics.roundRect(0, 0, config.width, config.height, 12);
    this.bgGraphics.fill({ color: bgColor, alpha: 0.95 });
    this.addChild(this.bgGraphics);

    // Frame Borders & Decorated Corners
    this.borderGraphics = new Graphics();
    
    // Outer bronze border
    this.borderGraphics.roundRect(0, 0, config.width, config.height, 12);
    this.borderGraphics.stroke({ color: COLOR_NUM.bronze, width: 3 });

    // Inner gold hairline border
    this.borderGraphics.roundRect(4, 4, config.width - 8, config.height - 8, 8);
    this.borderGraphics.stroke({ color: COLOR_NUM.gold, width: 1 });

    // Ornate Corners
    const size = 16;
    const goldColor = COLOR_NUM.gold;

    // Corner Ornaments (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
    const corners = [
      { x: 4, y: 4, dx: 1, dy: 1 },
      { x: config.width - 4, y: 4, dx: -1, dy: 1 },
      { x: 4, y: config.height - 4, dx: 1, dy: -1 },
      { x: config.width - 4, y: config.height - 4, dx: -1, dy: -1 },
    ];

    corners.forEach((c) => {
      this.borderGraphics.moveTo(c.x, c.y);
      this.borderGraphics.lineTo(c.x + size * c.dx, c.y);
      this.borderGraphics.lineTo(c.x, c.y + size * c.dy);
      this.borderGraphics.closePath();
      this.borderGraphics.fill({ color: goldColor, alpha: 0.25 });
      this.borderGraphics.stroke({ color: goldColor, width: 1.5 });

      if (config.showRivets !== false) {
        // Rivet dots in the corner
        this.borderGraphics.circle(c.x + 8 * c.dx, c.y + 8 * c.dy, 2.5);
        this.borderGraphics.fill({ color: COLOR_NUM.bronze });
        this.borderGraphics.stroke({ color: goldColor, width: 0.5 });
      }
    });

    this.addChild(this.borderGraphics);

    // Header Title Banner if provided
    if (config.title) {
      const bannerHeight = 28;
      const bannerY = -12;

      const bannerBg = new Graphics();
      bannerBg.roundRect((config.width - 240) / 2, bannerY, 240, bannerHeight, 6);
      bannerBg.fill({ color: COLOR_NUM.bronze });
      bannerBg.stroke({ color: goldColor, width: 1.5 });
      this.addChild(bannerBg);

      this.titleText = new Text({
        text: config.title.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 13,
          fontWeight: '900',
          fill: COLOR_HEX.parchment,
          letterSpacing: 2,
        }),
      });
      this.titleText.anchor.set(0.5);
      this.titleText.position.set(config.width / 2, bannerY + bannerHeight / 2);
      this.addChild(this.titleText);
    }
  }

  public updateSize(w: number, h: number): void {
    // Re-draw background and borders if needed
  }
}
