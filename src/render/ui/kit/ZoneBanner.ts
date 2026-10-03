import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../../../ui/styles';

export class ZoneBanner extends Container {
  private bannerBg: Graphics;
  private labelText: Text;
  private targetY = -80;
  private currentY = -80;
  private visibleDuration = 0;

  constructor() {
    super();

    // Width is full screen, centered on 540 max width or current canvas
    const width = 360;
    const height = 48;

    this.bannerBg = new Graphics();
    
    // Draw parchment/bronze scroll banner
    this.bannerBg.roundRect(-width / 2, -height / 2, width, height, 8);
    this.bannerBg.fill({ color: COLOR_NUM.bronze });
    this.bannerBg.stroke({ color: COLOR_NUM.gold, width: 2 });

    // Inner details / rivets
    this.bannerBg.rect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12);
    this.bannerBg.stroke({ color: COLOR_NUM.parchment, width: 1, alpha: 0.3 });

    this.addChild(this.bannerBg);

    this.labelText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 3,
        stroke: { color: COLOR_HEX.inkCrypt, width: 3 },
      }),
    });
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);

    this.position.set(270, this.currentY); // Centered default
  }

  /**
   * Show banner for a specific zone name
   */
  public show(zoneName: string): void {
    this.labelText.text = zoneName.toUpperCase();
    this.targetY = 60; // Slid down position
    this.visibleDuration = 3000; // Show for 3 seconds
  }

  /**
   * Updates transition animation
   */
  public update(dt: number): void {
    const deltaMs = dt * 1000;

    if (this.visibleDuration > 0) {
      this.visibleDuration -= deltaMs;
      if (this.visibleDuration <= 0) {
        this.targetY = -80; // Slide back up
      }
    }

    // Smooth lerp Y position
    const lerpSpeed = 0.15;
    this.currentY += (this.targetY - this.currentY) * lerpSpeed;
    this.position.y = this.currentY;
  }
}
