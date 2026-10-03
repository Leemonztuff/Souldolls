import { Container, Graphics } from 'pixi.js';
import { PartBlock, BodyPart } from '../../types/bodies';
import { COLOR_NUM, COLOR_SEMANTIC } from '../../ui/styles';

export class HumanoidPartSilhouette extends Container {
  private headG: Graphics = new Graphics();
  private torsoG: Graphics = new Graphics();
  private armsG: Graphics = new Graphics();
  private legsG: Graphics = new Graphics();

  constructor() {
    super();
    this.addChild(this.headG);
    this.addChild(this.torsoG);
    this.addChild(this.armsG);
    this.addChild(this.legsG);
  }

  public updateParts(partHP?: PartBlock, maxPartHP?: PartBlock): void {
    if (!partHP || !maxPartHP) return;

    this.drawZone(this.headG, 'head', partHP.head, maxPartHP.head);
    this.drawZone(this.torsoG, 'torso', partHP.torso, maxPartHP.torso);
    this.drawZone(this.armsG, 'arms', partHP.arms, maxPartHP.arms);
    this.drawZone(this.legsG, 'legs', partHP.legs, maxPartHP.legs);
  }

  private drawZone(g: Graphics, part: BodyPart, hp: number, maxHp: number): void {
    g.clear();
    const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;

    let color = COLOR_SEMANTIC.ok; // Green
    if (ratio <= 0) {
      color = COLOR_NUM.smokedWood; // Broken Slate/dark wood
    } else if (ratio < 0.2) {
      color = COLOR_SEMANTIC.danger; // Red
    } else if (ratio < 0.5) {
      color = COLOR_SEMANTIC.warning; // Amber
    }

    const strokeColor = ratio <= 0 ? COLOR_SEMANTIC.danger : COLOR_NUM.inkCrypt;

    switch (part) {
      case 'head':
        // Head circle
        g.circle(18, 6, 6);
        g.fill({ color, alpha: ratio <= 0 ? 0.4 : 0.95 });
        g.stroke({ color: strokeColor, width: 1.5 });
        if (ratio <= 0) {
          // Cracks overlay
          g.moveTo(14, 4).lineTo(22, 8);
          g.moveTo(20, 3).lineTo(16, 9);
          g.stroke({ color: COLOR_SEMANTIC.danger, width: 1.5 });
        }
        break;

      case 'torso':
        // Torso rounded rect
        g.roundRect(12, 13, 12, 18, 3);
        g.fill({ color, alpha: ratio <= 0 ? 0.4 : 0.95 });
        g.stroke({ color: strokeColor, width: 1.5 });
        if (ratio <= 0) {
          g.moveTo(13, 15).lineTo(23, 29);
          g.moveTo(23, 15).lineTo(13, 29);
          g.stroke({ color: COLOR_SEMANTIC.danger, width: 1.5 });
        }
        break;

      case 'arms':
        // Left arm and Right arm
        g.roundRect(4, 14, 6, 16, 2);
        g.roundRect(26, 14, 6, 16, 2);
        g.fill({ color, alpha: ratio <= 0 ? 0.4 : 0.95 });
        g.stroke({ color: strokeColor, width: 1.5 });
        if (ratio <= 0) {
          g.moveTo(4, 15).lineTo(10, 29);
          g.moveTo(26, 15).lineTo(32, 29);
          g.stroke({ color: COLOR_SEMANTIC.danger, width: 1.5 });
        }
        break;

      case 'legs':
        // Left leg and Right leg
        g.roundRect(12, 32, 5, 18, 2);
        g.roundRect(19, 32, 5, 18, 2);
        g.fill({ color, alpha: ratio <= 0 ? 0.4 : 0.95 });
        g.stroke({ color: strokeColor, width: 1.5 });
        if (ratio <= 0) {
          g.moveTo(12, 33).lineTo(17, 49);
          g.moveTo(19, 33).lineTo(24, 49);
          g.stroke({ color: COLOR_SEMANTIC.danger, width: 1.5 });
        }
        break;
    }
  }

  public flashZone(part: BodyPart, flashColor = COLOR_NUM.white): void {
    let targetG: Graphics;
    if (part === 'head') targetG = this.headG;
    else if (part === 'torso') targetG = this.torsoG;
    else if (part === 'arms') targetG = this.armsG;
    else targetG = this.legsG;

    targetG.tint = flashColor;
    targetG.scale.set(1.2);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      targetG.scale.set(1.0 + (5 - step) * 0.04);
      if (step >= 5) {
        clearInterval(interval);
        targetG.tint = COLOR_NUM.white;
        targetG.scale.set(1.0);
      }
    }, 40);
  }
}
