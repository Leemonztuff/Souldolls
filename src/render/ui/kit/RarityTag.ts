import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, COLOR_RARITY, FONTS } from '../../../ui/styles';

export class RarityTag extends Container {
  private bg: Graphics;
  private txt: Text;

  constructor(rarity: 'comun' | 'pocoComun' | 'rara' | 'epica') {
    super();

    const labelMap = {
      comun: 'COMÚN',
      pocoComun: 'POCO COMÚN',
      rara: 'RARA',
      epica: 'ÉPICA',
    };

    const label = labelMap[rarity] || 'COMÚN';
    const rarityColor = COLOR_RARITY[rarity] || COLOR_RARITY.comun;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 10,
        fontWeight: '900',
        fill: COLOR_HEX.inkCrypt,
        letterSpacing: 1,
      }),
    });
    this.txt.anchor.set(0.5);
    this.addChild(this.txt);

    // Calculate dynamic width based on text
    const textWidth = this.txt.width;
    const paddingX = 14;
    const width = textWidth + paddingX;
    const height = 18;

    this.bg.roundRect(-width / 2, -height / 2, width, height, 4);
    this.bg.fill({ color: rarityColor });
    
    // Epic / Rare shiny borders
    if (rarity === 'epica' || rarity === 'rara') {
      this.bg.roundRect(-width / 2, -height / 2, width, height, 4);
      this.bg.stroke({ color: COLOR_NUM.white, width: 1.5 });
    }

    this.txt.position.set(0, 0);
  }
}
