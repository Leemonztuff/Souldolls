import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import * as THREE from 'three';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../ui/styles';

export class BootScene implements IScene {
  public name = 'Boot';

  private container: Container = new Container();
  private progressBarBg!: Graphics;
  private progressBarFill!: Graphics;
  private loadingText!: Text;
  private progress = 0;
  private totalDuration = 1.2; // seconds
  private elapsed = 0;

  public async enter(): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    // Setup basic Three.js empty dark scene for boot
    GlobalThreeRenderer.clearScene();
    GlobalThreeRenderer.scene.background = new THREE.Color(COLOR_NUM.inkCrypt);

    const cx = GlobalPixiRenderer.width / 2;
    const cy = GlobalPixiRenderer.height / 2;

    // Game Title in Boot
    const titleStyle = new TextStyle({
      fontFamily: FONTS.title,
      fontSize: 54,
      fontWeight: '900',
      fill: COLOR_HEX.gold,
      stroke: { color: COLOR_HEX.inkCrypt, width: 6 },
      letterSpacing: 6,
    });
    const title = new Text({ text: 'SOULDOLLS', style: titleStyle });
    title.anchor.set(0.5);
    title.position.set(cx, cy - 60);
    this.container.addChild(title);

    const subStyle = new TextStyle({
      fontFamily: FONTS.hud,
      fontSize: 14,
      fontWeight: 'bold',
      fill: COLOR_HEX.smoke,
      letterSpacing: 4,
    });
    const subtitle = new Text({ text: 'MUNDO DE ANIMA • INICIALIZANDO', style: subStyle });
    subtitle.anchor.set(0.5);
    subtitle.position.set(cx, cy - 10);
    this.container.addChild(subtitle);

    // Progress Bar Background
    this.progressBarBg = new Graphics();
    this.progressBarBg.roundRect(cx - 160, cy + 50, 320, 14, 7);
    this.progressBarBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.9 });
    this.progressBarBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    this.container.addChild(this.progressBarBg);

    // Progress Bar Fill
    this.progressBarFill = new Graphics();
    this.container.addChild(this.progressBarFill);

    // Loading status text
    this.loadingText = new Text({
      text: 'Resonando con el ki del alma...',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fill: COLOR_HEX.smoke,
      }),
    });
    this.loadingText.anchor.set(0.5);
    this.loadingText.position.set(cx, cy + 85);
    this.container.addChild(this.loadingText);
  }

  public update(dt: number): void {
    this.elapsed += dt;
    this.progress = Math.min(1.0, this.elapsed / this.totalDuration);

    const cx = GlobalPixiRenderer.width / 2;
    const cy = GlobalPixiRenderer.height / 2;

    this.progressBarFill.clear();
    if (this.progress > 0.02) {
      this.progressBarFill.roundRect(cx - 158, cy + 52, 316 * this.progress, 10, 5);
      this.progressBarFill.fill({ color: COLOR_NUM.cyan });
    }

    if (this.progress >= 1.0) {
      GlobalSceneManager.changeScene('Title');
    }
  }

  public render(): void {
    // Pixi and Three rendered centrally by Game
  }

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
