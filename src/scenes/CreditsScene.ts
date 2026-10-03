import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../ui/styles';

export class CreditsScene implements IScene {
  public name = 'Credits';
  private container: Container = new Container();

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    this.container.addChild(bg);

    // Header / Banner
    const headerBg = new Graphics();
    headerBg.roundRect(width / 2 - 380, 40, 760, 100, 12);
    headerBg.fill({ color: COLOR_NUM.smokedWood });
    headerBg.stroke({ color: COLOR_NUM.gold, width: 2.5 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '🎉 ¡FIN DE LA DEMO - EPÍLOGO!',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 26,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
        letterSpacing: 2,
        stroke: { color: COLOR_HEX.inkCrypt, width: 3 },
      }),
    });
    titleText.anchor.set(0.5);
    titleText.position.set(width / 2, 75);
    this.container.addChild(titleText);

    const subText = new Text({
      text: 'Has superado al Guardián del Eco y obtenido el Sello sagrado de Gremio.',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.parchment,
      }),
    });
    subText.anchor.set(0.5);
    subText.position.set(width / 2, 112);
    this.container.addChild(subText);

    // Stats Box
    const statsBg = new Graphics();
    statsBg.roundRect(width / 2 - 320, 165, 640, 260, 12);
    statsBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    statsBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    
    // Inner ornate line
    statsBg.roundRect(width / 2 - 316, 169, 632, 252, 10);
    statsBg.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.3 });
    this.container.addChild(statsBg);

    const saveState = GlobalSaveService.getCurrentState();
    const codex = (saveState as any).soulCodex || saveState.pokedex || {};
    const caughtCount = Object.keys(codex).filter(
      (id) => codex[id]?.caught
    ).length;
    const totalSpecies = Object.keys(CREATURES_DATA).length;
    const pokedexPct = Math.round((caughtCount / totalSpecies) * 100);

    const statsContent = [
      `📊 ESTADÍSTICAS FINALES DE LA AVENTURA`,
      `────────────────────────────────────────`,
      `• Almas Registradas en Códice      : ${caughtCount} / ${totalSpecies} (${pokedexPct}%)`,
      `• Souldolls en Equipo Actual       : ${saveState.party.length} muñecas`,
      `• Ki / Dinero Acumulado            : ¥${saveState.player.money}`,
      `• Sello de Gremio del Eco          : ${saveState.keyItems?.includes('sello_eco') ? '✅ OBTENIDO' : '❌ PENDIENTE'}`,
      `• Misiones Principales             : ¡Completadas con honor!`,
    ].join('\n');

    const statsTxt = new Text({
      text: statsContent,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 14,
        lineHeight: 22,
        fill: COLOR_HEX.parchment,
      }),
    });
    statsTxt.position.set(width / 2 - 290, 190);
    this.container.addChild(statsTxt);

    // Continue / Explore Button
    const continueBtn = this.createButton(
      '✨ CONTINUAR EXPLORANDO EL MUNDO',
      width / 2 - 200,
      450,
      400,
      50,
      COLOR_NUM.bronze,
      () => {
        GlobalAudioService.playSfx('confirm');
        GlobalSceneManager.popScene();
      }
    );
    this.container.addChild(continueBtn);

    GlobalAudioService.playVictoryTheme();
    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    onClick: () => void
  ): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.smokedWood });
    bg.stroke({ color: COLOR_NUM.gold, width: 2 });
    
    // Inner line highlight
    bg.roundRect(2, 2, w - 4, h - 4, 6);
    bg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.2 });
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 0.5,
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(w / 2, h / 2);
    btn.addChild(txt);

    btn.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick();
    });

    return btn;
  }

  public update(_dt: number): void {}
  public render(_alpha: number): void {}
  public onResize(_width: number, _height: number): void {}

  public async exit(): Promise<void> {
    if (this.container.parent) {
      this.container.parent.removeChildren();
    }
  }
}
