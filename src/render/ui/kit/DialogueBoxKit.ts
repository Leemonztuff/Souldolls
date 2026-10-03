import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../../../ui/styles';

export interface DialogueBoxConfig {
  width: number;
  height: number;
  onComplete?: () => void;
}

export class DialogueBoxKit extends Container {
  private frame: Graphics;
  private speakerText: Text;
  private messageText: Text;
  private arrow: Graphics;
  private portraitContainer: Container;
  private portraitBg: Graphics;
  private portraitSprite: Graphics; // Placeholder or sprite for portrait

  private fullMessage = '';
  private currentMessage = '';
  private charIndex = 0;
  private isTyping = false;
  private typeTimer = 0;
  private typeSpeed = 30; // ms per char

  private onCompleteCallback?: () => void;

  constructor(config: DialogueBoxConfig) {
    super();

    this.onCompleteCallback = config.onComplete;

    // Speaker Name Box
    this.speakerText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        stroke: { color: COLOR_HEX.inkCrypt, width: 3 },
      }),
    });
    this.speakerText.position.set(24, -14);
    this.addChild(this.speakerText);

    // Main frame graphics
    this.frame = new Graphics();
    this.addChild(this.frame);

    // Portrait frame (on the left)
    this.portraitContainer = new Container();
    this.portraitContainer.position.set(20, 20);
    this.addChild(this.portraitContainer);

    this.portraitBg = new Graphics();
    this.portraitContainer.addChild(this.portraitBg);

    this.portraitSprite = new Graphics();
    this.portraitContainer.addChild(this.portraitSprite);

    // Message text (offset for portrait)
    this.messageText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: config.width - 150,
        lineHeight: 20,
      }),
    });
    this.messageText.position.set(124, 24);
    this.addChild(this.messageText);

    // Animated indicator arrow
    this.arrow = new Graphics();
    this.arrow.poly([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 }
    ]);
    this.arrow.fill({ color: COLOR_NUM.gold });
    this.arrow.position.set(config.width - 24, config.height - 20);
    this.arrow.visible = false;
    this.addChild(this.arrow);

    this.drawFrame(config.width, config.height);
  }

  private drawFrame(w: number, h: number): void {
    this.frame.clear();

    // Box background
    this.frame.roundRect(0, 0, w, h, 8);
    this.frame.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });

    // Bronze outer border
    this.frame.roundRect(0, 0, w, h, 8);
    this.frame.stroke({ color: COLOR_NUM.bronze, width: 2.5 });

    // Gold inner line
    this.frame.roundRect(3, 3, w - 6, h - 6, 6);
    this.frame.stroke({ color: COLOR_NUM.gold, width: 1 });

    // Corner Ornaments
    const corners = [
      { x: 3, y: 3, dx: 1, dy: 1 },
      { x: w - 3, y: 3, dx: -1, dy: 1 },
      { x: 3, y: h - 3, dx: 1, dy: -1 },
      { x: w - 3, y: h - 3, dx: -1, dy: -1 },
    ];
    corners.forEach((c) => {
      this.frame.circle(c.x + 4 * c.dx, c.y + 4 * c.dy, 2);
      this.frame.fill({ color: COLOR_NUM.gold });
    });

    // Drawing portrait box
    this.portraitBg.clear();
    this.portraitBg.rect(0, 0, 80, h - 40);
    this.portraitBg.fill({ color: COLOR_NUM.smokedWood });
    this.portraitBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
  }

  public showMessage(speaker: string, message: string, portraitType?: string): void {
    this.speakerText.text = speaker.toUpperCase();
    this.fullMessage = message;
    this.currentMessage = '';
    this.charIndex = 0;
    this.isTyping = true;
    this.arrow.visible = false;
    this.messageText.text = '';

    // Draw procedural face portrait placeholder
    this.portraitSprite.clear();
    const faceColor = portraitType === 'player' ? COLOR_NUM.cyan : COLOR_NUM.soulViolet;
    this.portraitSprite.circle(40, (this.frame.height - 40) / 2, 22);
    this.portraitSprite.fill({ color: faceColor, alpha: 0.8 });
    this.portraitSprite.circle(40, (this.frame.height - 40) / 2 - 2, 18);
    this.portraitSprite.fill({ color: COLOR_NUM.white, alpha: 0.1 });
  }

  public skipTypewriter(): void {
    if (this.isTyping) {
      this.isTyping = false;
      this.messageText.text = this.fullMessage;
      this.arrow.visible = true;
      if (this.onCompleteCallback) this.onCompleteCallback();
    }
  }

  public update(dt: number): void {
    if (this.isTyping) {
      this.typeTimer += dt * 1000;
      if (this.typeTimer >= this.typeSpeed) {
        this.typeTimer = 0;
        this.currentMessage += this.fullMessage[this.charIndex];
        this.charIndex++;
        this.messageText.text = this.currentMessage;

        if (this.charIndex >= this.fullMessage.length) {
          this.isTyping = false;
          this.arrow.visible = true;
          if (this.onCompleteCallback) this.onCompleteCallback();
        }
      }
    }

    // Bounce next arrow
    if (this.arrow.visible) {
      this.arrow.position.y = this.parent ? this.parent.y + 110 + Math.sin(Date.now() * 0.008) * 3 : 110;
    }
  }
}
