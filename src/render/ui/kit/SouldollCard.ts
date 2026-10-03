import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Souldoll } from '../../../types/souldolls';
import { CREATURES_DATA } from '../../../data/creatures/creatures';
import { ThemeProgressBar } from './ThemeProgressBar';
import { RarityTag } from './RarityTag';
import { COLOR_NUM, COLOR_HEX, COLOR_ELEMENT, COLOR_RARITY, FONTS } from '../../../ui/styles';

export class SouldollCard extends Container {
  private cardBg: Graphics;
  private nameText: Text;
  private lvlText: Text;
  private classText: Text;
  private hpBar: ThemeProgressBar;
  private expBar: ThemeProgressBar;

  constructor(souldoll: Souldoll, width = 150, height = 210) {
    super();

    const species = CREATURES_DATA[souldoll.speciesId] || CREATURES_DATA['maga'];
    const element = species.types[0] || 'neutro';
    
    // Determine rarity based on evolution tier or metadata
    let rarity: 'comun' | 'pocoComun' | 'rara' | 'epica' = 'comun';
    if (souldoll.level >= 25) {
      rarity = 'epica';
    } else if (souldoll.level >= 16) {
      rarity = 'rara';
    } else if (souldoll.level >= 10) {
      rarity = 'pocoComun';
    }

    // Background panel
    this.cardBg = new Graphics();
    this.addChild(this.cardBg);

    const elemColor = COLOR_ELEMENT[element as keyof typeof COLOR_ELEMENT] || COLOR_ELEMENT.neutro;
    
    // Draw background (shaded wood or dark field)
    this.cardBg.roundRect(0, 0, width, height, 10);
    this.cardBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });

    // Outer rarity frame border
    const rarityColor = COLOR_RARITY[rarity] || COLOR_RARITY.comun;
    this.cardBg.roundRect(0, 0, width, height, 10);
    this.cardBg.stroke({ color: rarityColor, width: 3 });

    // Inner elemental colored pinstripe
    this.cardBg.roundRect(4, 4, width - 8, height - 8, 8);
    this.cardBg.stroke({ color: elemColor.primary, width: 1.5 });

    // Portrait frame backing
    const portraitY = 36;
    const portraitH = 74;
    this.cardBg.roundRect(10, portraitY, width - 20, portraitH, 6);
    this.cardBg.fill({ color: COLOR_NUM.smokedWood });
    this.cardBg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });

    // Souldoll Name text (Cinzel)
    const displayName = souldoll.nickname || species.name || souldoll.speciesId;
    this.nameText = new Text({
      text: displayName.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 1,
      }),
    });
    this.nameText.position.set(12, 10);
    this.addChild(this.nameText);

    // Level Text (Mono)
    this.lvlText = new Text({
      text: `NIVEL ${souldoll.level}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 9,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    this.lvlText.anchor.set(1, 0);
    this.lvlText.position.set(width - 12, 12);
    this.addChild(this.lvlText);

    // Class / Element Subtitle
    this.classText = new Text({
      text: `${souldoll.speciesId.toUpperCase()} • ${element.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 8,
        fontWeight: 'bold',
        fill: COLOR_HEX.smoke,
      }),
    });
    this.classText.anchor.set(0.5, 0);
    this.classText.position.set(width / 2, 22);
    this.addChild(this.classText);

    // Progress Bars (HP & EXP)
    this.hpBar = new ThemeProgressBar({
      width: width - 24,
      height: 12,
      type: 'hp',
      value: souldoll.currentHp / souldoll.maxHp,
      currentValue: souldoll.currentHp,
      maxValue: souldoll.maxHp,
      showText: true,
    });
    this.hpBar.position.set(12, portraitY + portraitH + 10);
    this.addChild(this.hpBar);

    // EXP Bar calculation
    const currentExp = souldoll.currentExp || 0;
    const nextLevelExp = souldoll.level * 100;
    this.expBar = new ThemeProgressBar({
      width: width - 24,
      height: 6,
      type: 'exp',
      value: currentExp / nextLevelExp,
    });
    this.expBar.position.set(12, portraitY + portraitH + 28);
    this.addChild(this.expBar);

    // Sincronía (Friendship) badge or stats
    const syncText = new Text({
      text: `⚡ SINCRONÍA: ${souldoll.sync || souldoll.friendship || 70}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 8,
        fontWeight: 'bold',
        fill: COLOR_HEX.cyan,
      }),
    });
    syncText.position.set(12, height - 24);
    this.addChild(syncText);

    // Add Rarity Tag overlay
    const tag = new RarityTag(rarity);
    tag.scale.set(0.8);
    tag.position.set(width - 32, height - 16);
    this.addChild(tag);

    // Drawing a simple procedural face as avatar inside the portrait frame
    const avatar = new Graphics();
    avatar.circle(width / 2, portraitY + portraitH / 2, 20);
    avatar.fill({ color: elemColor.primary, alpha: 0.85 });
    avatar.circle(width / 2, portraitY + portraitH / 2, 17);
    avatar.fill({ color: COLOR_NUM.white, alpha: 0.1 });
    
    // Core gem
    avatar.circle(width / 2, portraitY + portraitH / 2 + 10, 3);
    avatar.fill({ color: COLOR_NUM.cyan });
    this.addChild(avatar);
  }
}
